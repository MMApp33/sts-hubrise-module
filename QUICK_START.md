# HubRise Integration - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Get HubRise Credentials (2 minutes)
1. Go to https://manager.hubrise.com/developers
2. Create a new application
3. Copy your **Client ID** and **Client Secret**
4. Add redirect URI: `https://api.scantoserve.com/api/hubrise/callback`

### Step 2: Generate Secrets (1 minute)
```powershell
# Generate encryption secret (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Generate webhook secret (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Step 3: Add to wrangler.toml (1 minute)
Add these lines after `FCM_PROJECT_ID` in your `wrangler.toml`:

```toml
# HubRise Integration
HUBRISE_CLIENT_ID = "your_client_id_from_step_1"
HUBRISE_CLIENT_SECRET = "your_client_secret_from_step_1"
HUBRISE_REDIRECT_URI = "https://api.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_generated_webhook_secret"
ENCRYPTION_SECRET = "your_generated_encryption_secret"
APP_URL = "https://scantoserve.com"
```

### Step 4: Initialize Database (30 seconds)
```bash
wrangler d1 execute hubrise --file=schema.sql --env=dev
```

### Step 5: Deploy (30 seconds)
```bash
wrangler deploy --env=dev
```

## ✅ Done!

Your HubRise integration is now live. Test it:

```bash
curl -X GET https://api.scantoserve.com/api/hubrise/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "connected": false,
  "message": "No HubRise connection found"
}
```

## 📱 Frontend Integration

Add a "Connect HubRise" button:

```javascript
// React example
const connectHubRise = async () => {
  const response = await fetch('/api/hubrise/connect', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const { authUrl } = await response.json();
  window.location.href = authUrl;
};

// In your settings page
<button onClick={connectHubRise}>
  Connect to HubRise
</button>
```

## 📦 What Happens Next

1. **Restaurant connects** → OAuth tokens stored in D1 (encrypted)
2. **Menu sync** → Restaurant menu synced to HubRise catalog
3. **Orders arrive** → Stored in your Azure Table Storage with `orderSource: 'hubrise'`
4. **Status updates** → Sent back to HubRise and delivery platforms

## 🔍 Monitoring

Check if orders are coming in:
```bash
curl -X GET "https://api.scantoserve.com/api/hubrise/orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📚 Full Documentation

- **Setup Guide**: `HUBRISE_SETUP.md`
- **API Reference**: `API_REFERENCE.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Changes Summary**: `CHANGES_SUMMARY.md`

## 🆘 Common Issues

**Issue**: "Invalid redirect_uri"
**Fix**: Make sure redirect URI in HubRise exactly matches `HUBRISE_REDIRECT_URI`

**Issue**: "No active HubRise connection found"
**Fix**: Restaurant needs to connect first via the OAuth flow

**Issue**: Orders not appearing
**Fix**: Check that webhook is registered in HubRise and publicly accessible

## 🎉 You're All Set!

Your multi-tenant HubRise integration is ready to receive orders from:
- Uber Eats
- Deliveroo
- Just Eat
- And 100+ other platforms via HubRise

Happy coding! 🚀
