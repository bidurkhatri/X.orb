-- 005_payments.sql
-- Monetization tables: payments, sponsor profiles, fee config

-- ============================================================
-- 1. Payments — Every USDC transaction through the platform
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  sponsor_address TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  gross_amount BIGINT NOT NULL,          -- USDC micro-units (6 decimals)
  fee_amount BIGINT NOT NULL DEFAULT 0,
  net_amount BIGINT NOT NULL,
  fee_basis_points INT NOT NULL DEFAULT 0,
  fee_exempt BOOLEAN DEFAULT FALSE,
  fee_exempt_reason TEXT,
  collect_tx_hash TEXT,                   -- payer → facilitator
  fee_tx_hash TEXT,                       -- facilitator → treasury
  forward_tx_hash TEXT,                   -- facilitator → recipient
  refund_tx_hash TEXT,                    -- facilitator → payer (if rejected)
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'completed', 'escrowed', 'refunded', 'failed')),
  refund_reason TEXT,
  chain TEXT NOT NULL DEFAULT 'eip155:137',
  nonce_hash TEXT NOT NULL UNIQUE,
  fee_matures_at TIMESTAMPTZ,            -- 72h after completion
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_sponsor ON payments(sponsor_address);
CREATE INDEX idx_payments_agent ON payments(agent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_action ON payments(action_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_service ON payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Sponsor Profiles — Tier and custom fee configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsor_profiles (
  sponsor_address TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'standard', 'high_volume', 'enterprise')),
  custom_fee_bps INT,                    -- NULL = use default, set for enterprise
  free_tier_override INT,                -- NULL = use default (1000)
  wallet_approved BOOLEAN DEFAULT FALSE,
  wallet_allowance TEXT,                 -- Current USDC allowance
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sponsor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY sponsor_profiles_service ON sponsor_profiles FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Additional fee config values
-- ============================================================
INSERT INTO platform_config (key, value, description) VALUES
  ('fee_basis_points', '30', 'Platform fee in basis points (30 = 0.30%)'),
  ('fee_minimum_usdc', '"1000"', 'Minimum fee in USDC micro-units ($0.001)'),
  ('fee_maximum_usdc', '"50000000"', 'Maximum fee cap per action ($50.00)'),
  ('fee_free_tier_actions', '500', 'Free actions per month before fees apply'),
  ('fee_exempt_actions', '["health_check","agent_query","reputation_query"]', 'Action types exempt from fees'),
  ('fee_high_volume_discount_threshold', '50000', 'Monthly actions for high-volume discount'),
  ('fee_high_volume_basis_points', '15', 'Discounted fee rate (0.15%)'),
  ('refund_window_hours', '72', 'Hours after completion before fees are available for withdrawal')
ON CONFLICT (key) DO NOTHING;
