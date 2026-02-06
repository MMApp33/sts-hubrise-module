# STS Menu Module - Cloudflare Workers API

A comprehensive Cloudflare Workers-based API solution for the **Scan To Serve** restaurant management system. This module handles menu management, order processing, customer assistance, and real-time WebSocket communication using Cloudflare's edge computing platform.

## 🎯 Project Overview

The STS Menu Module is a serverless API built on Cloudflare Workers that provides:
- **JWT-based Authentication**: Secure token validation using EC (Elliptic Curve) cryptography
- **Real-time Order Management**: WebSocket-powered live order updates using Durable Objects
- **HubRise Integration**: Connect to 100+ delivery platforms (Uber Eats, Deliveroo, etc.) via HubRise
- **Menu & Category Management**: CRUD operations for restaurant menus and categories
- **Customer Assistance System**: Real-time staff notification system for customer requests
- **Organization Management**: Multi-tenant support with organization-specific data isolation
- **AI-Powered Features**: Menu generation using Groq AI integration
- **Payment Processing**: Stripe integration for payment handling
- **Firebase Cloud Messaging**: Push notifications for mobile apps
- **File Storage**: R2 bucket integration for profile pictures and menu images
- **Blog Management**: Content management for restaurant blogs

## 🏗️ Architecture

### Core Components

1. **Main Worker (`src/index.js`)**: Entry point handling HTTP requests and CORS
2. **Durable Objects**:
   - `STSOrder`: Manages order state and WebSocket connections for real-time order updates
   - `STSAssistance`: Handles customer assistance requests with live staff notifications
3. **Route Handler**: Centralized routing system mapping endpoints to handlers
4. **Authentication Layer**: JWT validation with license expiry checks
5. **Storage Services**: 
   - KV Namespaces: Fast key-value storage for menus, organizations, alerts, categories, FCM tokens, and blogs
   - Durable Objects Storage: Persistent state for orders and assistance requests
   - R2 Buckets: Object storage for images and files
   - Azure Table Storage: External storage integration for orders and data
   - D1 Database: Cloudflare SQL database for HubRise OAuth tokens

### Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Language**: JavaScript (ES6+)
- **Authentication**: JWT with `jose` library (ES256 algorithm)
- **Real-time Communication**: WebSockets with Durable Objects
- **AI Integration**: Groq SDK for AI-powered menu generation
- **Payment**: Stripe API
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Storage**: Cloudflare KV, Durable Objects, R2, Azure Tables

## 📦 Installation and Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (v4.10.0+)
- A [Cloudflare Account](https://dash.cloudflare.com/)
- Access to required external services (Stripe, Firebase, Azure Storage)

### Clone the Repository

```bash
git clone https://github.com/MMApp33/sts-menue-module.git
cd sts-menue-module
```

### Install Dependencies

```bash
npm install
```

This will install:
- `wrangler`: Cloudflare Workers CLI
- `jose`: JWT validation library
- `groq-sdk`: AI integration
- `stripe`: Payment processing
- `uuid`: Unique identifier generation
- `jest`: Testing framework

### Configuration

The project uses `wrangler.toml` for configuration. Key settings include:

#### KV Namespaces
- `sts_menu`: Menu data storage
- `sts_organization`: Organization information
- `sts_alerts`: Alert notifications
- `sts_category`: Menu categories
- `sts_fcm`: FCM tokens for push notifications
- `sts_blogs`: Blog content

#### Durable Objects
- `STS_ORDER`: Order management with WebSocket support
- `STS_ASSISTANCE`: Customer assistance tracking

#### D1 Database
- `hubrise`: Stores encrypted HubRise OAuth tokens and connection details

#### R2 Buckets
- `profile-logo-pics`: Image storage for profiles and logos

#### Environment Variables (see `wrangler.toml`)

```toml
[vars]
  STORAG_BASE_URL = "https://scantoservedev.table.core.windows.net"
  TOKEN_ISSUER = "https://assets.scantoserve.com/discovery/v2.0/keys"
  TOKEN_AUDIANCE = "https://api.scantoserve.com/Ireland"
  CDN_URL = "https://assets.scantoserve.com/"
  BLOB_URL = "https://blob.scantoserve.com/"
  # HubRise Integration
  HUBRISE_CLIENT_ID = "your_hubrise_client_id"
  HUBRISE_CLIENT_SECRET = "your_hubrise_client_secret"
  HUBRISE_REDIRECT_URI = "https://devapi.scantoserve.com/api/hubrise/callback"
  ENCRYPTION_SECRET = "your_encryption_secret"
  APP_URL = "https://app.scantoserve.com"
  API_ENDPOINT = "https://devapi.scantoserve.com"
  TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
  APP_ENV = "development" # or "production"
  FCM_PROJECT_ID = "scantoserve-34bff"
  EC_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
  [Your EC Public Key]
  -----END PUBLIC KEY-----"""
```

**Secrets** (set via `wrangler secret put`):
- `GROQ_API_KEY`: Groq AI API key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `TURNSTILE_SECRET`: Cloudflare Turnstile secret
- `SAS_TOKEN`: Azure Storage SAS token
- `SERVICE_ACCOUNT_JSON`: Firebase service account JSON

## 🚀 Deployment

### Local Development

```bash
npm run start
```

This starts the Wrangler dev server with hot reloading.

### Deploy to Cloudflare

#### Deploy to Development Environment
```bash
npm run deploy
```

#### Deploy to Production (Ireland)
```bash
wrangler deploy --env Ireland
```

### Scheduled Tasks

The worker includes a cron trigger that runs every 55 minutes to refresh FCM tokens:

```javascript
async scheduled(event, env, ctx) {
  // Refreshes Firebase Cloud Messaging access token
}
```

## 📡 API Endpoints

### Authentication Types
- `token`: Requires valid JWT token with license validation
- `notoken`: Public endpoints (no authentication required)
- `turnstile`: Cloudflare Turnstile verification

### Order Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/placeorder` | POST | token | Place a new order (legacy) |
| `/api/v1/placeorder` | POST | notoken | Place order (public) |
| `/api/v1/placeorderstaff` | POST | token | Staff places order |
| `/api/readorders` | GET | token | Read today's orders |
| `/api/v1/readorder` | GET | token | Read orders (v1) |
| `/api/v1/readsingleorder` | GET | token | Read single order details |
| `/api/updateorder` | PUT | token | Update order status |
| `/api/v1/updateorder` | PUT | token | Update order (v1) |

### Menu Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/readmenuportal` | GET | token | Get menu for portal/admin |
| `/api/readmenuscanner` | GET | notoken | Get menu for customer scanner |
| `/api/addmenuitem` | POST | token | Add new menu item |
| `/api/updatemenuitem` | PUT | token | Update menu item |
| `/api/deletemenuitem` | DELETE | token | Delete menu item |
| `/api/uploadmenupic` | POST | token | Upload menu item image |
| `/api/generateMenu` | POST | token | AI-powered menu generation |

### Category Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/addcategory` | POST | token | Add menu category |
| `/api/updatecategory` | PUT | token | Update category |
| `/api/getcategory` | GET | token | Get all categories |

### Organization Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/addorganization` | POST | token | Create organization |
| `/api/updateorganization` | PUT | token | Update organization |
| `/api/getorganization` | GET | notoken | Get organization details |

### Customer Assistance

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/assistancerequired` | POST | notoken | Customer requests assistance |
| `/api/readassistancedata` | GET | token | Read assistance requests |
| `/api/updateassistancedata` | PUT | token | Update assistance status |

### Analytics & Reports

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/getreportdata` | GET | token | Get report data |
| `/api/v1/getreportdata` | GET | token | Get 30-day report |
| `/api/todaydata` | GET | token | Get today's statistics |
| `/api/getalerts` | GET | token | Get system alerts |

### Feedback & Content

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/submitfeedback` | POST | notoken | Submit customer feedback |
| `/api/readfeedbackdata` | GET | token | Read feedback data |
| `/api/getblogs` | GET | notoken | Get blog posts |

### HubRise Integration

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/hubrise/connect` | GET | token | Initiate HubRise OAuth connection |
| `/api/hubrise/callback` | GET | none | OAuth callback handler |
| `/api/hubrise/status` | GET | token | Get HubRise connection status |
| `/api/hubrise/disconnect` | POST | token | Disconnect HubRise integration |
| `/api/hubrise/sync-menu` | POST | token | Sync menu to HubRise catalog |
| `/api/hubrise/webhook` | POST | none | Receive order webhooks from HubRise |
| `/api/hubrise/update-order-status` | POST | token | Update order status in HubRise |
| `/api/hubrise/orders` | GET | token | Get HubRise orders from Azure Storage |

### Utility

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/registerscreen` | POST | token | Register device for FCM |
| `/api/purgecache` | DELETE | token | Clear cache |

## 🔌 WebSocket Connections

### Order WebSocket

**Endpoint**: `wss://your-worker.workers.dev/placeorder?orgID={orgID}&role={role}`

**Roles**: `portal`, `tv`, `kitchen`, etc.

**Message Types**:
- `NEW_ORDER`: Broadcast when new order is placed
- `UPDATE_ORDER`: Broadcast when order status changes
- `TODAY_ORDERS_LIST`: Initial order list on connection

**Example Client**:
```javascript
const ws = new WebSocket('wss://api.scantoserve.com/placeorder?orgID=123&role=portal');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'NEW_ORDER') {
    console.log('New order:', data.payload);
  }
};
```

### Assistance WebSocket

**Endpoint**: `wss://your-worker.workers.dev/assistancerequired?orgID={orgID}`

**Message Types**:
- `NEW_ASSISTANCE`: Customer requests help
- `UPDATE_ASSISTANCE`: Staff updates assistance status
- `INITIAL_ASSISTANCE`: Initial assistance list on connection

## 🔐 Authentication & Security

### JWT Token Structure

Tokens are validated using ES256 (ECDSA with P-256 and SHA-256) algorithm:

```javascript
{
  "iss": "https://assets.scantoserve.com/discovery/v2.0/keys",
  "aud": "https://api.scantoserve.com/Ireland",
  "userClaims": {
    "LicenceValidity": 1735689600, // Unix timestamp
    "orgID": "org123",
    // ... other claims
  }
}
```

### License Validation

All authenticated endpoints check license expiry:
- Token must contain `userClaims.LicenceValidity`
- Expiry date must be in the future
- Returns 403 if license is expired

### CORS Configuration

CORS headers are automatically applied to all responses:
- `Access-Control-Allow-Origin`: Request origin
- `Access-Control-Allow-Methods`: GET, POST, PUT, DELETE, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type, Authorization, etc.

## 🧪 Testing

```bash
npm test
```

Runs Jest test suite (configured in `package.json`).

## 📊 Monitoring & Observability

Logs are enabled in `wrangler.toml`:

```toml
[observability.logs]
enabled = true
```

View logs in Cloudflare Dashboard or via Wrangler:

```bash
wrangler tail
```

## 🔄 Data Flow

### Order Placement Flow
1. Customer scans QR code → Opens menu
2. Selects items → Places order via `/api/v1/placeorder`
3. Order stored in Durable Object
4. WebSocket broadcasts to connected staff devices
5. Staff receives real-time notification
6. Staff updates order status → Broadcasts to all connected clients

### Assistance Request Flow
1. Customer requests help via `/api/assistancerequired`
2. Assistance stored in Durable Object
3. WebSocket broadcasts to staff
4. Staff responds and updates status
5. Customer receives confirmation

### HubRise Integration Flow
1. Restaurant connects HubRise account via OAuth (`/api/hubrise/connect`)
2. OAuth tokens encrypted and stored in D1 database
3. Menu synced to HubRise catalog (`/api/hubrise/sync-menu`)
4. Customer orders via Uber Eats/Deliveroo → HubRise
5. HubRise sends webhook to `/api/hubrise/webhook`
6. Order stored in Azure Table Storage with `orderSource: 'hubrise'`
7. Restaurant updates order status → Synced back to HubRise

## 🌍 Multi-Environment Support

- **Default**: Development environment
- **dev**: Development with production storage
- **Ireland**: Production environment

Each environment has separate:
- KV namespaces
- Durable Object instances
- Environment variables
- Routes

## 📝 Project Structure

```
sts-menue-module/
├── src/
│   ├── index.js                 # Main worker entry point
│   ├── STSOrder.js              # Order Durable Object
│   ├── STSAssistance.js         # Assistance Durable Object
│   ├── auth/
│   │   ├── auth.js              # JWT validation
│   │   └── fcmAuth.js           # Firebase authentication
│   ├── handlers/
│   │   ├── orderHandlers.js     # Order management
│   │   ├── menuHandlers.js      # Menu CRUD operations
│   │   ├── hubriseHandlers.js   # HubRise integration
│   │   ├── assistanceHandlers.js # Assistance management
│   │   ├── organizationHandlers.js # Organization management
│   │   ├── generalHandlers.js   # Analytics & reports
│   │   ├── feedbackHandlers.js  # Feedback handling
│   │   ├── cacheHandlers.js     # Cache management
│   │   └── aiMenuHandler.js     # AI menu generation
│   ├── routes/
│   │   └── router.js            # Route definitions
│   ├── services/
│   │   ├── storageService.js    # Azure Table Storage operations
│   │   ├── hubriseService.js    # HubRise API integration
│   │   └── kvoperations.js      # KV operations
│   └── utils/
│       ├── utils.js             # Utility functions
│       ├── encryption.js        # Token encryption & HMAC validation
│       ├── fileUtils.js         # File upload handling
│       └── insights.js          # Analytics utilities
├── wrangler.toml                # Cloudflare configuration
├── schema.sql                   # D1 database schema for HubRise
├── package.json                 # Dependencies
├── README.md                    # This file
└── Documentation/
    ├── HUBRISE_SETUP.md         # HubRise integration setup guide
    ├── API_REFERENCE.md         # Complete API documentation
    ├── DEPLOYMENT.md            # Deployment instructions
    └── QUICK_START.md           # Quick start guide
```

## 🤝 Contributing

This is a private repository for the Scan To Serve project. For internal team members:

1. Create a feature branch
2. Make your changes
3. Test thoroughly in development environment
4. Submit a pull request
5. Deploy to production after approval

## 📞 Support

For support or inquiries:
- **Email**: [support@scantoserve.com](mailto:support@scantoserve.com)
- **Website**: [https://scantoserve.com](https://scantoserve.com)

## 📄 License

Private and proprietary. All rights reserved.

---

**Built with ❤️ using Cloudflare Workers**