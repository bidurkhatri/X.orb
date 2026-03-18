-- 006_spending_caps.sql
-- Add spending caps to sponsor_profiles and evidence support to agent_actions

-- Spending caps (D-6)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sponsor_profiles' AND column_name = 'daily_spend_cap_usdc'
  ) THEN
    ALTER TABLE sponsor_profiles ADD COLUMN daily_spend_cap_usdc BIGINT;
    ALTER TABLE sponsor_profiles ADD COLUMN monthly_spend_cap_usdc BIGINT;
    ALTER TABLE sponsor_profiles ADD COLUMN notification_prefs JSONB DEFAULT '{"slashing":true,"reputation_warning":true,"api_key_expiring":true,"payment_receipt":true,"free_tier_warning":true}';
    ALTER TABLE sponsor_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE sponsor_profiles ADD COLUMN email TEXT;
  END IF;
END
$$;

-- Evidence URLs for audit (F-6)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_actions' AND column_name = 'evidence_urls'
  ) THEN
    ALTER TABLE agent_actions ADD COLUMN evidence_urls TEXT[];
  END IF;
END
$$;

-- Free tier abuse prevention (SEC-6)
INSERT INTO platform_config (key, value, description) VALUES
  ('fee_unverified_free_tier', '50', 'Free tier limit for unverified sponsors (50 actions)')
ON CONFLICT (key) DO NOTHING;

-- Update minimum fee to cover gas costs
UPDATE platform_config SET value = '"10000"' WHERE key = 'fee_minimum_usdc';
