-- Combined migration for missing tables
CREATE TABLE IF NOT EXISTS payment_nonces (
  nonce_hash TEXT PRIMARY KEY,
  payer_address TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_nonces_created ON payment_nonces (created_at);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rate_usdc_per_hour BIGINT,
  rate_usdc_per_action BIGINT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_agent ON marketplace_listings (agent_id);

CREATE TABLE IF NOT EXISTS marketplace_engagements (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  hirer_address TEXT NOT NULL,
  escrow_amount_usdc BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reputation_history (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  score_before INTEGER NOT NULL DEFAULT 0,
  score_after INTEGER NOT NULL DEFAULT 0,
  streak_count INTEGER NOT NULL DEFAULT 0,
  tier_before TEXT,
  tier_after TEXT,
  action_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reputation_history_agent ON reputation_history (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  agent_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_agent ON platform_events (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_config (key, value, description) VALUES
  ('free_tier_limit', '500', 'Free tier action limit per month'),
  ('fee_basis_points', '30', 'Platform fee 0.30%'),
  ('max_agents_per_sponsor', '10', 'Max active agents per sponsor')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  sponsor_address TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  gross_amount BIGINT NOT NULL,
  fee_amount BIGINT NOT NULL DEFAULT 0,
  net_amount BIGINT NOT NULL,
  fee_basis_points INT NOT NULL DEFAULT 0,
  fee_exempt BOOLEAN DEFAULT FALSE,
  fee_exempt_reason TEXT,
  collect_tx_hash TEXT,
  fee_tx_hash TEXT,
  forward_tx_hash TEXT,
  refund_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'held',
  refund_reason TEXT,
  chain TEXT NOT NULL DEFAULT 'eip155:137',
  nonce_hash TEXT NOT NULL UNIQUE,
  fee_matures_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_sponsor ON payments(sponsor_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

CREATE TABLE IF NOT EXISTS sponsor_profiles (
  sponsor_address TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free',
  custom_fee_bps INT,
  free_tier_override INT,
  wallet_approved BOOLEAN DEFAULT FALSE,
  daily_spend_cap_usdc BIGINT,
  monthly_spend_cap_usdc BIGINT,
  notification_prefs JSONB DEFAULT '{}',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  event_types TEXT[],
  secret TEXT NOT NULL,
  sponsor_address TEXT,
  api_key_id TEXT,
  is_active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ DEFAULT now()
);
