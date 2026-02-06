# HubRise Integration Guide - Multi-Tenant SaaS

## 🏗️ Architecture Overview

Your SaaS application serves **multiple restaurants (clients)**. Each restaurant needs their **own HubRise connection** with their own credentials and tokens.

### Key Concept: One HubRise Account Per Restaurant

```
Your SaaS Application (Scan-to-Serve)
├── Restaurant A (Client 1)
│   └── HubRise Account A (separate tokens)
├── Restaurant B (Client 2)
│   └── HubRise Account B (separate tokens)
└── Restaurant C (Client 3)
    └── HubRise Account C (separate tokens)
```

---

## 📊 Database Schema

### Table: `hubrise_connections`

```sql
CREATE TABLE hubrise_connections (
  id UUID PRIMARY KEY,
  organization_id VARCHAR(255) NOT NULL UNIQUE,  -- Your internal restaurant/client ID
  hubrise_account_id VARCHAR(255),               -- HubRise account ID
  hubrise_location_id VARCHAR(255),              -- HubRise location ID
  access_token TEXT NOT NULL,                    -- Encrypted access token
  refresh_token TEXT NOT NULL,                   -- Encrypted refresh token
  token_expires_at TIMESTAMP,
  account_name VARCHAR(255),                     -- Restaurant name from HubRise
  connected_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_org_id ON hubrise_connections(organization_id);
CREATE INDEX idx_hubrise_account ON hubrise_connections(hubrise_account_id);
```

---

## 🔄 Multi-Tenant Flow

### 1. **OAuth Flow - Per Restaurant**

Each restaurant goes through their own OAuth flow:

```
Restaurant A clicks "Connect to HubRise"
  ↓
Redirect to HubRise with state parameter containing organizationId
  ↓
Restaurant A logs into THEIR HubRise account
  ↓
HubRise redirects back with code + state
  ↓
Your backend:
  - Extracts organizationId from state
  - Exchanges code for tokens
  - Stores tokens linked to organizationId
```

**Modified OAuth URL with State:**
```javascript
const authUrl = new URL('https://manager.hubrise.com/oauth2/v1/authorize');
authUrl.searchParams.append('client_id', HUBRISE_CLIENT_ID);
authUrl.searchParams.append('redirect_uri', HUBRISE_REDIRECT_URI);
authUrl.searchParams.append('scope', HUBRISE_SCOPE);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('state', organizationId); // ← CRITICAL: Track which restaurant
```

---

## 🔐 Authentication Flow in Your Cloudflare Workers

### Step 1: User Initiates Connection

**Frontend (React):**
```typescript
const connect = () => {
  setIsLoading(true);
  
  // Get current user's organization ID from your auth system
  const organizationId = userClaims?.OrganizationID;
  
  const authUrl = new URL('https://manager.hubrise.com/oauth2/v1/authorize');
  authUrl.searchParams.append('client_id', HUBRISE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', HUBRISE_REDIRECT_URI);
  authUrl.searchParams.append('scope', HUBRISE_SCOPE);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', organizationId); // Track the restaurant
  
  window.location.href = authUrl.toString();
};
```

### Step 2: Handle OAuth Callback

**Cloudflare Worker: `/api/hubrise/callback`**

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const organizationId = url.searchParams.get('state'); // Get restaurant ID
    
    if (!code || !organizationId) {
      return new Response('Invalid callback', { status: 400 });
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://manager.hubrise.com/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.HUBRISE_CLIENT_ID,
        client_secret: env.HUBRISE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: env.HUBRISE_REDIRECT_URI
      })
    });
    
    const tokens = await tokenResponse.json();
    
    // Store tokens in database linked to organizationId
    await env.DB.prepare(`
      INSERT INTO hubrise_connections 
      (organization_id, hubrise_account_id, hubrise_location_id, access_token, refresh_token, token_expires_at, account_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      organizationId,
      tokens.account_id,
      tokens.location_id,
      encrypt(tokens.access_token), // Encrypt before storing
      encrypt(tokens.refresh_token),
      new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      'Restaurant Name' // Fetch from HubRise API
    ).run();
    
    // Redirect back to integrations page
    return Response.redirect(`${env.APP_URL}/admin/settings/integrations?connected=true`);
  }
};
```

---

## 🎯 How to Identify Which Restaurant in Each API Call

### Method 1: From User Session (Recommended)

```javascript
// In your Cloudflare Worker
async function getOrganizationFromSession(request, env) {
  // Extract JWT or session token from request
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  // Verify and decode token to get organizationId
  const decoded = await verifyJWT(token, env.JWT_SECRET);
  return decoded.organizationId;
}

// Use in your endpoints
export default {
  async fetch(request, env) {
    const organizationId = await getOrganizationFromSession(request, env);
    
    // Get HubRise tokens for THIS restaurant
    const connection = await env.DB.prepare(
      'SELECT * FROM hubrise_connections WHERE organization_id = ?'
    ).bind(organizationId).first();
    
    if (!connection) {
      return new Response('Not connected to HubRise', { status: 404 });
    }
    
    // Use connection.access_token for HubRise API calls
    const accessToken = decrypt(connection.access_token);
    // ... make HubRise API call
  }
};
```

### Method 2: From Webhook (HubRise → Your App)

```javascript
// When HubRise sends you an order via webhook
export default {
  async fetch(request, env) {
    const body = await request.text();
    const order = JSON.parse(body);
    
    // HubRise includes location_id in the order
    const hubriseLocationId = order.location_id;
    
    // Find which restaurant this belongs to
    const connection = await env.DB.prepare(
      'SELECT * FROM hubrise_connections WHERE hubrise_location_id = ?'
    ).bind(hubriseLocationId).first();
    
    if (!connection) {
      return new Response('Unknown location', { status: 404 });
    }
    
    const organizationId = connection.organization_id;
    
    // Save order to YOUR database for this restaurant
    await saveOrderToDatabase(organizationId, order);
    
    return new Response('OK', { status: 200 });
  }
};
```

---

## 📡 API Endpoints - Multi-Tenant Implementation

### 1. Check Connection Status

**Endpoint:** `GET /api/hubrise/status`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

**Worker Logic:**
```javascript
const organizationId = await getOrganizationFromSession(request, env);

const connection = await env.DB.prepare(
  'SELECT organization_id, account_name, connected_at, is_active FROM hubrise_connections WHERE organization_id = ?'
).bind(organizationId).first();

return Response.json({
  connected: !!connection,
  accountName: connection?.account_name,
  connectedAt: connection?.connected_at
});
```

**Response:**
```json
{
  "connected": true,
  "accountName": "Pizza Palace",
  "connectedAt": "2026-02-06T10:00:00Z"
}
```

---

### 2. Sync Menu to HubRise

**Endpoint:** `POST /api/hubrise/sync-menu`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

**Worker Logic:**
```javascript
const organizationId = await getOrganizationFromSession(request, env);

// Get HubRise connection for this restaurant
const connection = await env.DB.prepare(
  'SELECT * FROM hubrise_connections WHERE organization_id = ?'
).bind(organizationId).first();

if (!connection) {
  return Response.json({ error: 'Not connected to HubRise' }, { status: 404 });
}

// Get restaurant's menu from YOUR database
const menu = await getRestaurantMenu(organizationId, env);

// Transform to HubRise format
const hubriseMenu = transformToHubRiseCatalog(menu);

// Send to HubRise using THIS restaurant's token
const accessToken = decrypt(connection.access_token);
const response = await fetch(`https://api.hubrise.com/v1/catalogs/${connection.hubrise_location_id}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(hubriseMenu)
});

// Update last sync time
await env.DB.prepare(
  'UPDATE hubrise_connections SET last_synced_at = CURRENT_TIMESTAMP WHERE organization_id = ?'
).bind(organizationId).run();

return Response.json({ success: true });
```

---

### 3. Receive Orders (Webhook)

**Endpoint:** `POST /api/hubrise/webhook`

**Headers:**
```
X-Hubrise-Hmac-SHA256: <signature>
```

**Worker Logic:**
```javascript
const body = await request.text();
const signature = request.headers.get('X-Hubrise-Hmac-SHA256');

// Validate HMAC
if (!validateHMAC(body, signature, env.HUBRISE_WEBHOOK_SECRET)) {
  return new Response('Invalid signature', { status: 401 });
}

const webhook = JSON.parse(body);
const hubriseLocationId = webhook.location_id;

// Find which restaurant this order belongs to
const connection = await env.DB.prepare(
  'SELECT organization_id FROM hubrise_connections WHERE hubrise_location_id = ?'
).bind(hubriseLocationId).first();

if (!connection) {
  return new Response('Unknown location', { status: 404 });
}

const organizationId = connection.organization_id;

// Save order to YOUR database for THIS specific restaurant
await saveOrder(organizationId, webhook.order);

// Notify restaurant via WebSocket/Push notification
await notifyRestaurant(organizationId, webhook.order);

return new Response('OK', { status: 200 });
```

---

### 4. Update Order Status

**Endpoint:** `POST /api/hubrise/order-status`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

**Body:**
```json
{
  "hubriseOrderId": "order_123456",
  "status": "accepted",
  "expectedTime": "2026-02-06T11:15:00Z"
}
```

**Worker Logic:**
```javascript
const organizationId = await getOrganizationFromSession(request, env);
const { hubriseOrderId, status, expectedTime } = await request.json();

// Get HubRise connection for this restaurant
const connection = await env.DB.prepare(
  'SELECT * FROM hubrise_connections WHERE organization_id = ?'
).bind(organizationId).first();

const accessToken = decrypt(connection.access_token);

// Update order status in HubRise
await fetch(`https://api.hubrise.com/v1/orders/${hubriseOrderId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status, expected_time: expectedTime })
});

return Response.json({ success: true });
```

---

## 🔒 Security Best Practices

### 1. Token Encryption

```javascript
// Encrypt tokens before storing
async function encrypt(text, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}

// Decrypt when using
async function decrypt(encryptedText, secret) {
  // Implementation here
}
```

### 2. HMAC Validation for Webhooks

```javascript
function validateHMAC(body, signature, secret) {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return signature === hash;
}
```

---

## 📋 Testing Scenarios

### Scenario 1: Restaurant A Connects

1. Restaurant A logs in to your app
2. Clicks "Connect to HubRise"
3. Redirected to HubRise with `state=restaurant_a_org_id`
4. Logs into their HubRise account
5. Your callback stores tokens with `organization_id = restaurant_a_org_id`

### Scenario 2: Restaurant B Connects (Independent)

1. Restaurant B logs in to your app
2. Clicks "Connect to HubRise"
3. Redirected to HubRise with `state=restaurant_b_org_id`
4. Logs into their DIFFERENT HubRise account
5. Your callback stores tokens with `organization_id = restaurant_b_org_id`

### Scenario 3: Order Arrives for Restaurant A

1. Customer orders from Restaurant A via Uber Eats
2. HubRise sends webhook to your app with `location_id = restaurant_a_location`
3. Your worker looks up: `location_id → organization_id = restaurant_a_org_id`
4. Order saved to Restaurant A's orders only
5. Restaurant A sees the order in their dashboard

---

## 🎯 Summary

**Key Points:**
1. ✅ Each restaurant has their own HubRise account
2. ✅ Use `state` parameter in OAuth to track which restaurant
3. ✅ Store tokens per `organization_id` in database
4. ✅ Get `organization_id` from user session for API calls
5. ✅ Get `organization_id` from `location_id` for webhooks
6. ✅ Always use the correct restaurant's tokens for HubRise API calls

**Database Lookup Pattern:**
- User makes request → Get `organization_id` from JWT → Fetch HubRise tokens
- Webhook arrives → Get `location_id` from payload → Lookup `organization_id` → Process order

This ensures complete isolation between restaurants while using a single HubRise app integration!
