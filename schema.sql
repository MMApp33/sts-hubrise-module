-- HubRise Integration Database Schema for Cloudflare D1
-- Multi-Tenant SaaS Architecture
-- Note: Orders are stored in Azure Table Storage, not in D1

-- Table: hubrise_connections
-- Stores HubRise OAuth tokens and connection details for each organization (restaurant)
CREATE TABLE IF NOT EXISTS hubrise_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  hubrise_account_id TEXT,
  hubrise_location_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TEXT,
  account_name TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  last_synced_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_org_id ON hubrise_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_hubrise_account ON hubrise_connections(hubrise_account_id);
CREATE INDEX IF NOT EXISTS idx_hubrise_location ON hubrise_connections(hubrise_location_id);
