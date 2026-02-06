# How to Add HubRise Variables to wrangler.toml

## Instructions

Since the wrangler.toml file has a specific format, you need to manually add the HubRise configuration variables. Here's exactly where to add them:

## For Default Environment (Development)

Open `wrangler.toml` and find line 31 which says:
```toml
FCM_PROJECT_ID ="scantoserve-34bff"
```

**Add these lines immediately after line 31:**

```toml
# HubRise Integration Configuration
HUBRISE_CLIENT_ID = "your_hubrise_client_id_here"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret_here"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret_here"
ENCRYPTION_SECRET = "your_encryption_secret_32_chars_min"
APP_URL = "https://app.scantoserve.com"
```

## For env.dev Environment

Find line 57 in the `[env.dev.vars]` section which says:
```toml
FCM_PROJECT_ID ="scantoserve-34bff"
```

**Add these lines immediately after line 57:**

```toml
# HubRise Integration Configuration
HUBRISE_CLIENT_ID = "your_hubrise_client_id_here"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret_here"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret_here"
ENCRYPTION_SECRET = "your_encryption_secret_32_chars_min"
APP_URL = "https://app.scantoserve.com"
```

## For env.Ireland Environment (Production)

Find line 84 in the `[env.Ireland.vars]` section which says:
```toml
FCM_PROJECT_ID ="scantoserve-34bff"
```

**Add these lines immediately after line 84:**

```toml
# HubRise Integration Configuration (Production)
HUBRISE_CLIENT_ID = "your_hubrise_client_id_prod"
HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret_prod"
HUBRISE_REDIRECT_URI = "https://api.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "your_webhook_secret_prod"
ENCRYPTION_SECRET = "your_encryption_secret_prod_32_chars"
APP_URL = "https://app.scantoserve.com"
```

## How to Get the Values

### 1. HUBRISE_CLIENT_ID and HUBRISE_CLIENT_SECRET
1. Go to https://manager.hubrise.com/developers
2. Create a new application or select existing one
3. Copy the Client ID and Client Secret

### 2. HUBRISE_REDIRECT_URI
- Development: `https://devapi.scantoserve.com/api/hubrise/callback`
- Production: `https://api.scantoserve.com/api/hubrise/callback`
- **Important:** Add these exact URIs to your HubRise app settings

### 3. HUBRISE_WEBHOOK_SECRET
Generate a random secret (minimum 32 characters):
```bash
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4. ENCRYPTION_SECRET
Generate a strong random secret (minimum 32 characters):
```bash
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Example Final Configuration

Your wrangler.toml should look like this (with your actual values):

```toml
[vars]
  SAS_TOKEN = "sv=2024-11-04&ss=t&srt=sco&sp=rwdlacu&se=2028-04-14T01:06:12Z&st=2025-04-12T17:06:12Z&spr=https&sig=UHFsdYsZKz55YJWTMrwDhV2%2FEOm%2FLgHFAKPLDu6jzYw%3D"
  STORAG_BASE_URL = "https://scantoservedev.table.core.windows.net"
  TOKEN_ISSUER ="https://assets.scantoserve.com/discovery/v2.0/keys"
  TOKEN_AUDIANCE = "https://api.scantoserve.com/Ireland"
  CDN_URL = "https://assets.scantoserve.com/"
  BLOB_URL = "https://blob.scantoserve.com/"
  API_ENDPOINT = "https://devapi.scantoserve.com"
EC_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFai15exM09bzjhnnjI37zLMZ2swt
mY7n1jBeAfawXaNGXFU+TVQB3BWMRtDMPaPUrH9Ic2KXPYW+1f08nDpEng==
-----END PUBLIC KEY-----"""
APP_ENV = "development"
FCM_PROJECT_ID ="scantoserve-34bff"
# HubRise Integration Configuration
HUBRISE_CLIENT_ID = "abc123xyz"
HUBRISE_CLIENT_SECRET = "secret_key_here"
HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
HUBRISE_SCOPE = "location[orders.write,catalog.write]"
HUBRISE_WEBHOOK_SECRET = "webhook_secret_32_chars_minimum"
ENCRYPTION_SECRET = "encryption_secret_32_chars_minimum"
APP_URL = "https://app.scantoserve.com"
```

## Verification

After adding the variables, verify your configuration:

```bash
# Check if wrangler can parse the config
wrangler deploy --dry-run

# If successful, you should see no errors
```

## Security Notes

⚠️ **IMPORTANT:**
- Never commit secrets to git
- Use different secrets for dev and production
- Keep ENCRYPTION_SECRET safe - losing it means you can't decrypt stored tokens
- Rotate secrets periodically for security
