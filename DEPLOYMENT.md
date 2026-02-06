# HubRise Integration - Deployment Guide

## 📦 Prerequisites

- Cloudflare account with Workers and D1 enabled
- HubRise Developer account
- Node.js and npm installed
- Wrangler CLI installed (`npm install -g wrangler`)

## 🔧 Configuration Steps

### Step 1: Add Environment Variables to wrangler.toml

You need to add the HubRise configuration variables to your `wrangler.toml` file. Add these lines after the `FCM_PROJECT_ID` line in each environment section:

```toml
# Add to [vars] section (default environment)
HUBRISE_CLIENT_ID = "your_hubrise_client_id"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret"
ENCRYPTION_SECRET = "your_32_character_encryption_secret"
APP_URL = "https://app.scantoserve.com"

# Add to [env.dev.vars] section (development environment)
HUBRISE_CLIENT_ID = "your_hubrise_client_id"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret"
ENCRYPTION_SECRET = "your_32_character_encryption_secret"
APP_URL = "https://app.scantoserve.com"

# Add to [env.Ireland.vars] section (production environment)
HUBRISE_CLIENT_ID = "your_hubrise_client_id_prod"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret_prod"
HUBRISE_REDIRECT_URI = "https://api.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret_prod"
ENCRYPTION_SECRET = "your_32_character_encryption_secret_prod"
APP_URL = "https://app.scantoserve.com"
```

### Step 2: Get HubRise Credentials

1. Go to [HubRise Developer Portal](https://manager.hubrise.com/developers)
2. Create a new application or use an existing one
3. Note down your **Client ID** and **Client Secret**
4. Add the redirect URI: `https://devapi.scantoserve.com/api/hubrise/callback`
5. Generate a webhook secret (any random string, minimum 32 characters)

### Step 3: Generate Encryption Secret

Generate a secure random string (minimum 32 characters) for encrypting tokens:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Step 4: Initialize D1 Database

Create the database tables:

```bash
# Make sure you're in the project directory
cd C:\Users\PolaS\source\repos\sts-hubrise-module

# Apply the schema to your D1 database
wrangler d1 execute hubrise --file=schema.sql --env=dev

# For production
wrangler d1 execute hubrise --file=schema.sql --env=Ireland
```

### Step 5: Deploy to Cloudflare Workers

```bash
# Deploy to development environment
wrangler deploy --env=dev

# Deploy to production environment
wrangler deploy --env=Ireland
```

## 🧪 Testing the Deployment

### 1. Test Health Check

```bash
curl https://devapi.scantoserve.com/api/hubrise/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response if not connected:
```json
{
  "connected": false,
  "message": "No HubRise connection found"
}
```

### 2. Test Connection Flow

```bash
curl https://devapi.scantoserve.com/api/hubrise/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "authUrl": "https://manager.hubrise.com/oauth2/v1/authorize?...",
  "message": "Redirect user to this URL to connect HubRise"
}
```

### 3. Verify Database Tables

```bash
# List tables in D1 database
wrangler d1 execute hubrise --command="SELECT name FROM sqlite_master WHERE type='table';" --env=dev
```

Expected output should include:
- hubrise_connections
- hubrise_orders
- hubrise_sync_log
- hubrise_webhook_events

## 🔐 Security Checklist

- [ ] `HUBRISE_CLIENT_SECRET` is kept secret and not committed to git
- [ ] `ENCRYPTION_SECRET` is at least 32 characters long
- [ ] `HUBRISE_WEBHOOK_SECRET` is a strong random string
- [ ] Redirect URIs in HubRise match exactly with `HUBRISE_REDIRECT_URI`
- [ ] All tokens are encrypted before storage
- [ ] HMAC validation is enabled for webhooks

## 🚀 Post-Deployment Steps

### 1. Update Frontend

Add a "Connect HubRise" button in your restaurant settings page:

```javascript
// Example React component
const connectHubRise = async () => {
  const response = await fetch('/api/hubrise/connect', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  const data = await response.json();
  
  // Redirect user to HubRise OAuth page
  window.location.href = data.authUrl;
};
```

### 2. Handle OAuth Callback

After OAuth, users will be redirected to your app. Handle the success/error states:

```javascript
// In your integrations settings page
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  
  if (params.get('connected') === 'true') {
    showSuccessMessage('HubRise connected successfully!');
  } else if (params.get('error')) {
    showErrorMessage('Failed to connect HubRise: ' + params.get('error'));
  }
}, []);
```

### 3. Add Menu Sync Button

```javascript
const syncMenu = async () => {
  const response = await fetch('/api/hubrise/sync-menu', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    showSuccessMessage(`Synced ${data.itemsSynced} items to HubRise`);
  }
};
```

### 4. Handle Incoming Orders

Set up a listener for new orders (using WebSocket or polling):

```javascript
// Poll for new orders every 30 seconds
setInterval(async () => {
  const response = await fetch('/api/hubrise/orders?status=new', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  const data = await response.json();
  
  if (data.orders.length > 0) {
    // Show notification for new orders
    showNewOrderNotification(data.orders);
  }
}, 30000);
```

### 5. Update Order Status

When restaurant accepts/rejects an order:

```javascript
const updateOrderStatus = async (orderId, status, expectedTime) => {
  const response = await fetch('/api/hubrise/update-order-status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hubriseOrderId: orderId,
      status: status,
      expectedTime: expectedTime
    })
  });
  
  const data = await response.json();
  return data.success;
};
```

## 📊 Monitoring

### Check Logs

```bash
# View real-time logs
wrangler tail --env=dev

# View logs for specific time period
wrangler tail --env=dev --since 1h
```

### Query Database

```bash
# Check connections
wrangler d1 execute hubrise --command="SELECT organization_id, account_name, is_active, connected_at FROM hubrise_connections;" --env=dev

# Check recent orders
wrangler d1 execute hubrise --command="SELECT * FROM hubrise_orders ORDER BY created_at DESC LIMIT 10;" --env=dev

# Check sync logs
wrangler d1 execute hubrise --command="SELECT * FROM hubrise_sync_log ORDER BY created_at DESC LIMIT 10;" --env=dev

# Check webhook events
wrangler d1 execute hubrise --command="SELECT * FROM hubrise_webhook_events WHERE processed = 0;" --env=dev
```

## 🐛 Common Issues

### Issue: "Invalid redirect_uri"
**Solution:** Make sure the redirect URI in HubRise exactly matches `HUBRISE_REDIRECT_URI` in wrangler.toml

### Issue: "Token exchange failed"
**Solution:** Verify `HUBRISE_CLIENT_ID` and `HUBRISE_CLIENT_SECRET` are correct

### Issue: "Failed to encrypt data"
**Solution:** Ensure `ENCRYPTION_SECRET` is at least 32 characters long

### Issue: Webhooks not working
**Solution:** 
1. Check that webhook URL is publicly accessible
2. Verify `HUBRISE_WEBHOOK_SECRET` matches the one in HubRise
3. Check Cloudflare Workers logs for errors

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `HUBRISE_CLIENT_ID` | HubRise OAuth Client ID | `abc123def456` |
| `HUBRISE_CLIENT_SECRET` | HubRise OAuth Client Secret | `secret_xyz789` |
| `HUBRISE_REDIRECT_URI` | OAuth callback URL | `https://api.scantoserve.com/api/hubrise/callback` |
| `HUBRISE_SCOPE` | API permissions scope | `location[orders.write,catalog.write]` |
| `HUBRISE_WEBHOOK_SECRET` | Webhook HMAC secret | `random_32_char_string` |
| `ENCRYPTION_SECRET` | Token encryption key | `random_32_char_string` |
| `APP_URL` | Your app's frontend URL | `https://app.scantoserve.com` |

## ✅ Deployment Checklist

- [ ] D1 database tables created
- [ ] Environment variables added to wrangler.toml
- [ ] HubRise OAuth app configured with correct redirect URI
- [ ] Worker deployed to Cloudflare
- [ ] Test connection flow works
- [ ] Test menu sync works
- [ ] Webhook endpoint is accessible
- [ ] Frontend updated with HubRise UI
- [ ] Monitoring and logging set up
- [ ] Documentation shared with team

## 🎉 Success!

Your HubRise integration is now live! Restaurants can:
- ✅ Connect their HubRise accounts
- ✅ Sync menus automatically
- ✅ Receive orders from delivery platforms
- ✅ Update order statuses in real-time

For support, refer to `HUBRISE_SETUP.md` and the HubRise API documentation.
