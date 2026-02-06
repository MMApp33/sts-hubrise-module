# HubRise Integration - Changes Summary

## ✅ What Changed

Based on your feedback that you already have Azure Table Storage for orders, I've updated the implementation to use your existing storage infrastructure.

### Database Architecture

**Before:**
- D1 Database with 4 tables:
  - hubrise_connections
  - hubrise_orders ❌
  - hubrise_sync_log ❌
  - hubrise_webhook_events ❌

**After:**
- D1 Database with 1 table:
  - **hubrise_connections** (OAuth tokens only)
- Azure Table Storage:
  - **Orders** table (your existing table, now includes HubRise orders)

### Key Changes Made

#### 1. Simplified Database Schema (`schema.sql`)
- ✅ Removed `hubrise_orders` table
- ✅ Removed `hubrise_sync_log` table
- ✅ Removed `hubrise_webhook_events` table
- ✅ Kept only `hubrise_connections` for storing encrypted OAuth tokens

#### 2. Updated HubRise Handlers (`src/handlers/hubriseHandlers.js`)
- ✅ Added import for `addOrderItem` and `readtodayOrders` from `storageService.js`
- ✅ Webhook handler now stores orders in Azure Table Storage
- ✅ Orders are marked with `orderSource: 'hubrise'` for identification
- ✅ Removed all sync_log and webhook_events database operations
- ✅ `getHubRiseOrders()` now reads from Azure Table Storage instead of D1

### How Orders Are Stored

When a HubRise webhook arrives with a new order, it's stored in your existing Azure Table Storage `Orders` table with these fields:

```javascript
{
  PartitionKey: organizationId,
  RowKey: hubriseOrderId,
  hubriseOrderId: "order_123",
  hubriseLocationId: "loc_456",
  status: "new",
  customerName: "John Doe",
  customerEmail: "john@example.com",
  customerPhone: "+33612345678",
  orderItems: "[{...}]", // JSON string
  totalAmount: 25.50,
  currency: "EUR",
  serviceType: "delivery",
  expectedTime: "2026-02-06T12:45:00Z",
  orderSource: "hubrise", // ← Identifies HubRise orders
  createdAt: "2026-02-06T12:00:00Z",
  Timestamp: "2026-02-06T12:00:00Z"
}
```

### Benefits of This Approach

1. ✅ **Unified Order Storage** - All orders (in-app and HubRise) in one place
2. ✅ **Existing Infrastructure** - Uses your current Azure Table Storage
3. ✅ **Easy Filtering** - Filter HubRise orders by `orderSource === 'hubrise'`
4. ✅ **Simplified Database** - Only OAuth tokens in D1
5. ✅ **Cost Effective** - No duplicate order storage

### API Endpoints (No Changes)

All 8 API endpoints remain the same:
1. `GET /api/hubrise/connect` - Initiate OAuth
2. `GET /api/hubrise/callback` - OAuth callback
3. `GET /api/hubrise/status` - Connection status
4. `POST /api/hubrise/disconnect` - Disconnect
5. `POST /api/hubrise/sync-menu` - Sync menu to HubRise
6. `POST /api/hubrise/webhook` - Receive webhooks (now stores in Azure)
7. `POST /api/hubrise/update-order-status` - Update order status
8. `GET /api/hubrise/orders` - Get orders (now reads from Azure)

### What You Need to Do

#### 1. Initialize D1 Database (Simplified)
```bash
wrangler d1 execute hubrise --file=schema.sql --env=dev
```

This now only creates the `hubrise_connections` table.

#### 2. Add Environment Variables
Follow `WRANGLER_CONFIG_INSTRUCTIONS.md` to add:
- HUBRISE_CLIENT_ID
- HUBRISE_CLIENT_SECRET
- HUBRISE_REDIRECT_URI
- HUBRISE_SCOPE
- HUBRISE_WEBHOOK_SECRET
- ENCRYPTION_SECRET
- APP_URL

#### 3. Deploy
```bash
wrangler deploy --env=dev
```

### Testing

#### Test Webhook (Simulated)
When a HubRise webhook arrives, the order will be stored in your Azure `Orders` table.

#### Get HubRise Orders
```bash
curl -X GET "https://devapi.scantoserve.com/api/hubrise/orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This will return only orders where `orderSource === 'hubrise'`.

### Files Modified

1. ✅ `schema.sql` - Simplified to 1 table
2. ✅ `src/handlers/hubriseHandlers.js` - Updated to use Azure Table Storage
3. ✅ `IMPLEMENTATION_SUMMARY.md` - Updated documentation
4. ✅ `CHANGES_SUMMARY.md` - This file

### Files Unchanged

- ✅ `src/utils/encryption.js`
- ✅ `src/services/hubriseService.js`
- ✅ `src/routes/router.js`
- ✅ All documentation files (still accurate)

## 🎯 Summary

Your HubRise integration now:
- ✅ Stores OAuth tokens in D1 (encrypted)
- ✅ Stores orders in Azure Table Storage (your existing system)
- ✅ Marks HubRise orders with `orderSource: 'hubrise'`
- ✅ Uses your existing `addOrderItem()` and `readtodayOrders()` functions
- ✅ Maintains all 8 API endpoints
- ✅ Simplified database schema (1 table instead of 4)

Ready to deploy! 🚀
