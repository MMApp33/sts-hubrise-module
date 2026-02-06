# HubRise Integration Setup Guide

## 📋 Overview

This guide will help you set up the HubRise integration for your Scan-to-Serve multi-tenant SaaS application. The integration allows restaurants to:

- Connect their HubRise accounts
- Sync menus to HubRise catalogs
- Receive orders from delivery platforms (Uber Eats, Deliveroo, etc.)
- Update order statuses in real-time

## 🚀 Quick Start

### 1. Database Setup

First, create the required database tables in your Cloudflare D1 database:

```bash
# Apply the schema to your D1 database
wrangler d1 execute hubrise --file=schema.sql
```

Or manually run the SQL commands from `schema.sql` in your D1 database.

### 2. Environment Configuration

Add the following environment variables to your `wrangler.toml` file under the `[vars]` section:

```toml
# HubRise Integration Configuration
HUBRISE_CLIENT_ID = "your_hubrise_client_id"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret"
ENCRYPTION_SECRET = "your_32_character_encryption_secret"
APP_URL = "https://app.scantoserve.com"
```

**Important:** 
- Get your `HUBRISE_CLIENT_ID` and `HUBRISE_CLIENT_SECRET` from [HubRise Developer Portal](https://manager.hubrise.com/developers)
- The `ENCRYPTION_SECRET` must be at least 32 characters long
- Update the URLs to match your deployment environment

### 3. Register OAuth Redirect URI in HubRise

1. Go to [HubRise Developer Portal](https://manager.hubrise.com/developers)
2. Create or edit your application
3. Add the redirect URI: `https://devapi.scantoserve.com/api/hubrise/callback`
4. Save your changes

## 📡 API Endpoints

### Authentication & Connection

#### 1. Initiate HubRise Connection
```
GET /api/hubrise/connect
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "authUrl": "https://manager.hubrise.com/oauth2/v1/authorize?...",
  "message": "Redirect user to this URL to connect HubRise"
}
```

**Usage:** Redirect the user to the `authUrl` to start the OAuth flow.

#### 2. OAuth Callback (Automatic)
```
GET /api/hubrise/callback?code=xxx&state=xxx
```

This endpoint is called automatically by HubRise after the user authorizes. It stores the connection details in the database.

#### 3. Get Connection Status
```
GET /api/hubrise/status
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "connected": true,
  "accountName": "Restaurant Name",
  "accountId": "abc123",
  "connectedAt": "2026-02-06T10:00:00Z",
  "lastSyncedAt": "2026-02-06T11:00:00Z"
}
```

#### 4. Disconnect HubRise
```
POST /api/hubrise/disconnect
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "success": true,
  "message": "HubRise disconnected successfully"
}
```

### Menu Management

#### 5. Sync Menu to HubRise
```
POST /api/hubrise/sync-menu
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "success": true,
  "itemsSynced": 45,
  "message": "Menu synced successfully to HubRise"
}
```

This endpoint:
- Reads the menu from your KV store
- Transforms it to HubRise catalog format
- Syncs it to the restaurant's HubRise catalog

### Order Management

#### 6. Get HubRise Orders
```
GET /api/hubrise/orders?status=new&limit=50
Authorization: Bearer <user_token>
```

**Query Parameters:**
- `status` (optional): Filter by order status (new, accepted, in_progress, completed, cancelled)
- `limit` (optional): Maximum number of orders to return (default: 50)

**Response:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "hubrise_order_id": "order_123",
      "status": "new",
      "customer_name": "John Doe",
      "total_amount": 25.50,
      "currency": "EUR",
      "order_data": { /* full order details */ },
      "created_at": "2026-02-06T12:00:00Z"
    }
  ],
  "count": 1
}
```

#### 7. Update Order Status
```
POST /api/hubrise/update-order-status
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "hubriseOrderId": "order_123",
  "status": "accepted",
  "expectedTime": "2026-02-06T12:30:00Z"
}
```

**Valid Status Values:**
- `new` - Order received
- `accepted` - Order accepted by restaurant
- `in_progress` - Order being prepared
- `awaiting_shipment` - Ready for delivery
- `awaiting_collection` - Ready for pickup
- `completed` - Order completed
- `cancelled` - Order cancelled
- `rejected` - Order rejected

**Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully"
}
```

#### 8. Webhook Endpoint (Automatic)
```
POST /api/hubrise/webhook
X-Hubrise-Hmac-SHA256: <signature>
```

This endpoint receives webhooks from HubRise when:
- New orders are created
- Order statuses are updated
- Other events occur

The webhook is automatically registered when a restaurant connects their HubRise account.

## 🔄 Integration Flow

### Restaurant Connection Flow

```
1. Restaurant clicks "Connect HubRise" in your app
   ↓
2. Your app calls GET /api/hubrise/connect
   ↓
3. User is redirected to HubRise OAuth page
   ↓
4. User logs into their HubRise account and authorizes
   ↓
5. HubRise redirects to /api/hubrise/callback
   ↓
6. Your app stores encrypted tokens in D1 database
   ↓
7. User is redirected back to your app with success message
```

### Order Receiving Flow

```
1. Customer places order on Uber Eats/Deliveroo
   ↓
2. Order is sent to HubRise
   ↓
3. HubRise sends webhook to /api/hubrise/webhook
   ↓
4. Your app validates webhook signature
   ↓
5. Order is stored in hubrise_orders table
   ↓
6. Restaurant is notified (via FCM/WebSocket)
   ↓
7. Restaurant accepts/rejects order
   ↓
8. Your app calls /api/hubrise/update-order-status
   ↓
9. Status is updated in HubRise and delivery platform
```

## 🔒 Security Features

### Token Encryption
All HubRise access tokens and refresh tokens are encrypted using AES-GCM before being stored in the database.

### HMAC Validation
Webhook requests from HubRise are validated using HMAC-SHA256 signatures to ensure authenticity.

### Multi-Tenant Isolation
Each restaurant's HubRise connection is completely isolated using the `organization_id` from your JWT tokens.

## 🧪 Testing

### Test the Connection Flow

1. **Start Local Development:**
```bash
npm run dev
```

2. **Test Connection Endpoint:**
```bash
curl -X GET https://devapi.scantoserve.com/api/hubrise/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Check Status:**
```bash
curl -X GET https://devapi.scantoserve.com/api/hubrise/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Menu Sync

```bash
curl -X POST https://devapi.scantoserve.com/api/hubrise/sync-menu \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Order Status Update

```bash
curl -X POST https://devapi.scantoserve.com/api/hubrise/update-order-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hubriseOrderId": "order_123",
    "status": "accepted",
    "expectedTime": "2026-02-06T12:30:00Z"
  }'
```

## 📊 Database Tables

### hubrise_connections
Stores OAuth tokens and connection details for each restaurant.

### hubrise_orders
Stores all orders received from HubRise webhooks.

### hubrise_sync_log
Tracks menu sync operations for debugging and monitoring.

### hubrise_webhook_events
Stores all webhook events for audit trail and debugging.

## 🐛 Troubleshooting

### Connection Issues

**Problem:** OAuth callback fails
- **Solution:** Verify the redirect URI in HubRise matches exactly
- Check that `HUBRISE_CLIENT_ID` and `HUBRISE_CLIENT_SECRET` are correct

**Problem:** "No active HubRise connection found"
- **Solution:** Check the `is_active` flag in `hubrise_connections` table
- Verify the user's `organization_id` matches the stored connection

### Menu Sync Issues

**Problem:** Menu sync fails
- **Solution:** Check that menu data exists in KV store
- Verify the access token hasn't expired
- Check D1 database logs for errors

### Webhook Issues

**Problem:** Webhooks not received
- **Solution:** Verify webhook URL is publicly accessible
- Check that webhook was registered in HubRise
- Verify `HUBRISE_WEBHOOK_SECRET` is correct

**Problem:** "Invalid webhook signature"
- **Solution:** Ensure `HUBRISE_WEBHOOK_SECRET` matches the one in HubRise
- Check that the webhook body is not modified before validation

## 📚 Additional Resources

- [HubRise API Documentation](https://www.hubrise.com/developers/api/)
- [HubRise OAuth Guide](https://www.hubrise.com/developers/api/authentication/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## 🆘 Support

For issues or questions:
1. Check the `hubrise_webhook_events` table for error messages
2. Review Cloudflare Workers logs
3. Check the `hubrise_sync_log` table for sync errors
4. Contact HubRise support for API-related issues
