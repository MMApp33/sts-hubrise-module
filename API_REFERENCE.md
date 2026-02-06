# HubRise Integration - API Reference

## 🔗 Base URL
- **Development:** `https://devapi.scantoserve.com`
- **Production:** `https://api.scantoserve.com`

## 🔐 Authentication
All endpoints (except callback and webhook) require a Bearer token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 📡 Endpoints

### 1. Initiate HubRise Connection

Start the OAuth flow to connect a restaurant's HubRise account.

**Endpoint:** `GET /api/hubrise/connect`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:** `200 OK`
```json
{
  "authUrl": "https://manager.hubrise.com/oauth2/v1/authorize?client_id=...&state=...",
  "message": "Redirect user to this URL to connect HubRise"
}
```

**Frontend Usage:**
```javascript
const response = await fetch('/api/hubrise/connect', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { authUrl } = await response.json();
window.location.href = authUrl; // Redirect user
```

---

### 2. OAuth Callback

Handles the OAuth callback from HubRise (automatic, no manual call needed).

**Endpoint:** `GET /api/hubrise/callback`

**Query Parameters:**
- `code` - Authorization code from HubRise
- `state` - Organization ID passed in OAuth flow

**Response:** Redirects to `APP_URL/admin/settings/integrations?connected=true`

---

### 3. Get Connection Status

Check if a restaurant has an active HubRise connection.

**Endpoint:** `GET /api/hubrise/status`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:** `200 OK`
```json
{
  "connected": true,
  "accountName": "Pizza Palace",
  "accountId": "abc123",
  "connectedAt": "2026-02-06T10:00:00Z",
  "lastSyncedAt": "2026-02-06T11:30:00Z"
}
```

**If Not Connected:**
```json
{
  "connected": false,
  "message": "No HubRise connection found"
}
```

---

### 4. Disconnect HubRise

Disconnect a restaurant's HubRise integration.

**Endpoint:** `POST /api/hubrise/disconnect`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "HubRise disconnected successfully"
}
```

---

### 5. Sync Menu to HubRise

Sync the restaurant's menu to their HubRise catalog.

**Endpoint:** `POST /api/hubrise/sync-menu`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "itemsSynced": 45,
  "message": "Menu synced successfully to HubRise"
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "No active HubRise connection found"
}
```

---

### 6. Get HubRise Orders

Retrieve orders received from HubRise.

**Endpoint:** `GET /api/hubrise/orders`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `status` (optional) - Filter by order status: `new`, `accepted`, `in_progress`, `completed`, `cancelled`
- `limit` (optional) - Maximum number of orders (default: 50, max: 100)

**Example:**
```
GET /api/hubrise/orders?status=new&limit=20
```

**Response:** `200 OK`
```json
{
  "orders": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "hubrise_order_id": "order_abc123",
      "organization_id": "org_xyz",
      "status": "new",
      "customer_name": "John Doe",
      "total_amount": 25.50,
      "currency": "EUR",
      "created_at": "2026-02-06T12:00:00Z",
      "updated_at": "2026-02-06T12:00:00Z",
      "order_data": {
        "hubriseOrderId": "order_abc123",
        "status": "new",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "customerPhone": "+33612345678",
        "items": [
          {
            "name": "Margherita Pizza",
            "quantity": 2,
            "price": 12.00,
            "skuRef": "pizza_001"
          }
        ],
        "totalAmount": 25.50,
        "currency": "EUR",
        "serviceType": "delivery",
        "expectedTime": "2026-02-06T12:45:00Z",
        "createdAt": "2026-02-06T12:00:00Z"
      }
    }
  ],
  "count": 1
}
```

---

### 7. Update Order Status

Update the status of an order in HubRise.

**Endpoint:** `POST /api/hubrise/update-order-status`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "hubriseOrderId": "order_abc123",
  "status": "accepted",
  "expectedTime": "2026-02-06T12:45:00Z"
}
```

**Status Values:**
- `new` - Order received
- `accepted` - Order accepted by restaurant
- `in_progress` - Order being prepared
- `awaiting_shipment` - Ready for delivery
- `awaiting_collection` - Ready for pickup
- `completed` - Order completed
- `cancelled` - Order cancelled
- `rejected` - Order rejected

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Order status updated successfully"
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "No active HubRise connection found"
}
```

---

### 8. Webhook Endpoint

Receives webhooks from HubRise (automatic, called by HubRise).

**Endpoint:** `POST /api/hubrise/webhook`

**Headers:**
```
X-Hubrise-Hmac-SHA256: <signature>
Content-Type: application/json
```

**Request Body (Example):**
```json
{
  "event_type": "order.create",
  "location_id": "loc_123",
  "order": {
    "id": "order_abc123",
    "status": "new",
    "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+33612345678"
    },
    "items": [
      {
        "product_name": "Margherita Pizza",
        "quantity": 2,
        "price": 12.00,
        "sku_ref": "pizza_001"
      }
    ],
    "total": 25.50,
    "currency": "EUR",
    "service_type": "delivery",
    "created_at": "2026-02-06T12:00:00Z"
  }
}
```

**Response:** `200 OK`

---

## 🔄 Integration Workflows

### Complete Connection Flow

```javascript
// 1. Check current status
const statusResponse = await fetch('/api/hubrise/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const status = await statusResponse.json();

if (!status.connected) {
  // 2. Initiate connection
  const connectResponse = await fetch('/api/hubrise/connect', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { authUrl } = await connectResponse.json();
  
  // 3. Redirect to HubRise
  window.location.href = authUrl;
  
  // 4. User will be redirected back after authorization
  // Handle in your callback page:
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected') === 'true') {
    console.log('Successfully connected to HubRise!');
  }
}
```

### Menu Sync Flow

```javascript
const syncMenu = async () => {
  try {
    const response = await fetch('/api/hubrise/sync-menu', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`Synced ${result.itemsSynced} items`);
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
};
```

### Order Management Flow

```javascript
// Poll for new orders
const checkNewOrders = async () => {
  const response = await fetch('/api/hubrise/orders?status=new', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { orders } = await response.json();
  
  for (const order of orders) {
    // Display order to restaurant
    displayOrder(order);
  }
};

// Accept an order
const acceptOrder = async (orderId) => {
  const response = await fetch('/api/hubrise/update-order-status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hubriseOrderId: orderId,
      status: 'accepted',
      expectedTime: new Date(Date.now() + 30 * 60000).toISOString() // 30 min
    })
  });
  
  return await response.json();
};

// Mark order as ready
const markOrderReady = async (orderId) => {
  const response = await fetch('/api/hubrise/update-order-status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hubriseOrderId: orderId,
      status: 'awaiting_shipment'
    })
  });
  
  return await response.json();
};
```

---

## 🗄️ Database Schema Reference

### hubrise_connections
```sql
id                    TEXT PRIMARY KEY
organization_id       TEXT NOT NULL UNIQUE
hubrise_account_id    TEXT
hubrise_location_id   TEXT
access_token          TEXT NOT NULL (encrypted)
refresh_token         TEXT NOT NULL (encrypted)
token_expires_at      TEXT
account_name          TEXT
connected_at          TEXT
last_synced_at        TEXT
is_active             INTEGER (0 or 1)
created_at            TEXT
updated_at            TEXT
```

### hubrise_orders
```sql
id                    TEXT PRIMARY KEY
organization_id       TEXT NOT NULL
hubrise_order_id      TEXT NOT NULL UNIQUE
hubrise_location_id   TEXT
order_data            TEXT (JSON)
status                TEXT
customer_name         TEXT
total_amount          REAL
currency              TEXT
created_at            TEXT
updated_at            TEXT
```

---

## 🚨 Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Missing required parameters |
| 401 | Unauthorized | Invalid or missing JWT token |
| 404 | Not Found | Resource not found (e.g., no HubRise connection) |
| 500 | Internal Server Error | Server-side error |

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

---

## 📊 Rate Limits

- **HubRise API:** 100 requests per minute per location
- **Your API:** No specific limits (Cloudflare Workers limits apply)

---

## 🔧 Testing with cURL

### Get Status
```bash
curl -X GET https://devapi.scantoserve.com/api/hubrise/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Sync Menu
```bash
curl -X POST https://devapi.scantoserve.com/api/hubrise/sync-menu \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Orders
```bash
curl -X GET "https://devapi.scantoserve.com/api/hubrise/orders?status=new&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Order Status
```bash
curl -X POST https://devapi.scantoserve.com/api/hubrise/update-order-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hubriseOrderId": "order_abc123",
    "status": "accepted",
    "expectedTime": "2026-02-06T12:45:00Z"
  }'
```

---

## 📚 Additional Resources

- [HubRise API Documentation](https://www.hubrise.com/developers/api/)
- [Setup Guide](./HUBRISE_SETUP.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Integration Guide](./HUBRISE_INTEGRATION.md)
