-- Webhook subscriptions for event delivery
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    url TEXT NOT NULL,                      -- HTTPS URL to deliver events to
    event_types TEXT[] NOT NULL,            -- Array of event type strings
    secret TEXT NOT NULL,                   -- HMAC signing secret
    is_active BOOLEAN NOT NULL DEFAULT true,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_api_key ON webhook_endpoints(api_key_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhook_endpoints(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
