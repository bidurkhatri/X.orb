-- API Keys for X.orb developer authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL UNIQUE,          -- SHA-256 of the API key
    key_prefix TEXT NOT NULL,               -- First 8 chars for display (e.g., "xorb_sk_abc")
    owner_address TEXT NOT NULL,            -- Wallet address of the developer
    name TEXT NOT NULL,                     -- Human-readable key name
    scopes TEXT[] NOT NULL DEFAULT '{"agents:read","agents:write","actions:write"}',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
