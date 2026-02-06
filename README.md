# HubRise Integration - Quick Reference

## 🎯 Overview

The HubRise integration enables your Scan-to-Serve restaurants to receive orders from 100+ delivery platforms including:
- Uber Eats
- Deliveroo
- Just Eat
- DoorDash
- And many more...

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Delivery Platforms                        │
│  (Uber Eats, Deliveroo, Just Eat, DoorDash, etc.)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Orders
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                        HubRise                               │
│              (Aggregation Platform)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Webhook
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers API                          │
│          /api/hubrise/webhook endpoint                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─────────────────┬──────────────────────┐
                     ▼                 ▼                      ▼
            ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
            │ D1 Database │   │ Azure Table  │   │   Restaurant     │
            │  (Tokens)   │   │   Storage    │   │   Dashboard      │
            │             │   │  (Orders)    │   │  (Real-time)     │
            └─────────────┘   └──────────────┘   └──────────────────┘
```

## 📊 Data Storage

### D1 Database (Cloudflare)
- **Table**: `hubrise_connections`
- **Purpose**: Store encrypted OAuth tokens
- **Data**: 
  - organization_id
  - hubrise_account_id
  - hubrise_location_id
  - access_token (encrypted)
  - refresh_token (encrypted)
  - connection metadata

### Azure Table Storage
- **Table**: `Orders`
- **Purpose**: Store all orders (in-app + HubRise)
- **HubRise Orders Identified By**: `orderSource: 'hubrise'`
- **Data**:
  - PartitionKey: organization_id
  - RowKey: hubrise_order_id
  - customerName, orderItems, totalAmount, status, etc.

## 🔐 Security

### Token Encryption
- **Algorithm**: AES-GCM
- **Storage**: D1 Database
- **Key**: `ENCRYPTION_SECRET` environment variable

### Webhook Validation
- **Method**: HMAC-SHA256
- **Header**: `X-Hubrise-Hmac-SHA256`
- **Secret**: `HUBRISE_WEBHOOK_SECRET` environment variable

### Authentication
- **Method**: JWT Bearer Token
- **Claims**: organization_id (MotelID)
- **Validation**: ES256 algorithm

## 🔄 Integration Flow

### 1. Connection Flow
```
Restaurant → Connect Button → OAuth Flow → HubRise Login → 
Tokens Stored (Encrypted) → Webhook Registered → Connected
```

### 2. Menu Sync Flow
```
Restaurant → Sync Menu Button → Read from KV → Transform to HubRise Format → 
Upload to HubRise Catalog → Success
```

### 3. Order Receiving Flow
```
Customer Orders (Uber Eats) → HubRise → Webhook to Your API → 
Validate HMAC → Store in Azure → Notify Restaurant → Display in Dashboard
```

### 4. Status Update Flow
```
Restaurant Updates Status → API Call → Update in HubRise → 
Sync to Delivery Platform → Customer Notified
```

## 📡 API Endpoints

### Connection Management
- `GET /api/hubrise/connect` - Start OAuth flow
- `GET /api/hubrise/callback` - OAuth callback (automatic)
- `GET /api/hubrise/status` - Check connection status
- `POST /api/hubrise/disconnect` - Disconnect integration

### Menu & Orders
- `POST /api/hubrise/sync-menu` - Sync menu to HubRise
- `POST /api/hubrise/webhook` - Receive order webhooks
- `GET /api/hubrise/orders` - Get HubRise orders
- `POST /api/hubrise/update-order-status` - Update order status

## 🚀 Quick Setup

### 1. Environment Variables
Add to `wrangler.toml`:
```toml
HUBRISE_CLIENT_ID = "your_client_id"
HUBRISE_CLIENT_SECRET = "your_client_secret"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret"
ENCRYPTION_SECRET = "your_encryption_secret_32_chars"
APP_URL = "https://app.scantoserve.com"
```

### 2. Initialize Database
```bash
wrangler d1 execute hubrise --file=schema.sql --env=dev
```

### 3. Deploy
```bash
wrangler deploy --env=dev
```

## 📱 Frontend Integration

### Connect Button
```javascript
const connectHubRise = async () => {
  const response = await fetch('/api/hubrise/connect', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { authUrl } = await response.json();
  window.location.href = authUrl;
};
```

### Check Status
```javascript
const checkStatus = async () => {
  const response = await fetch('/api/hubrise/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const status = await response.json();
  console.log(status.connected); // true/false
};
```

### Sync Menu
```javascript
const syncMenu = async () => {
  const response = await fetch('/api/hubrise/sync-menu', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const result = await response.json();
  console.log(`Synced ${result.itemsSynced} items`);
};
```

### Get Orders
```javascript
const getOrders = async () => {
  const response = await fetch('/api/hubrise/orders', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { orders } = await response.json();
  // Filter HubRise orders already done server-side
  return orders;
};
```

### Update Order Status
```javascript
const updateStatus = async (orderId, status) => {
  const response = await fetch('/api/hubrise/update-order-status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hubriseOrderId: orderId,
      status: status, // 'accepted', 'in_progress', 'completed', etc.
      expectedTime: new Date(Date.now() + 30*60000).toISOString()
    })
  });
  return await response.json();
};
```

## 🎯 Order Status Values

- `new` - Order just received
- `accepted` - Restaurant accepted the order
- `in_progress` - Order being prepared
- `awaiting_shipment` - Ready for delivery
- `awaiting_collection` - Ready for pickup
- `completed` - Order completed
- `cancelled` - Order cancelled
- `rejected` - Order rejected by restaurant

## 📊 Monitoring

### Check Logs
```bash
wrangler tail --env=dev
```

### Query Database
```bash
# Check connections
wrangler d1 execute hubrise --command="SELECT * FROM hubrise_connections;" --env=dev

# Check if orders are in Azure
# Use Azure Portal or Azure Storage Explorer
```

## 🐛 Troubleshooting

### Issue: "No active HubRise connection found"
**Solution**: Restaurant needs to connect via OAuth flow first

### Issue: Orders not appearing
**Solution**: 
1. Check webhook is registered in HubRise
2. Verify `HUBRISE_WEBHOOK_SECRET` matches
3. Check Cloudflare Workers logs

### Issue: "Invalid redirect_uri"
**Solution**: Ensure redirect URI in HubRise exactly matches `HUBRISE_REDIRECT_URI`

## 📚 Documentation

- **Full Setup Guide**: `HUBRISE_SETUP.md`
- **API Reference**: `API_REFERENCE.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Quick Start**: `QUICK_START.md`
- **Changes Summary**: `CHANGES_SUMMARY.md`

## 🎉 Benefits

### For Restaurants
✅ Receive orders from 100+ platforms
✅ Centralized order management
✅ Real-time synchronization
✅ Automatic menu updates across platforms
✅ Unified dashboard for all orders

### For Your Platform
✅ Increased value proposition
✅ Competitive advantage
✅ Revenue opportunities
✅ Better restaurant retention
✅ Scalable architecture

---

**Built with ❤️ for Scan-to-Serve**
