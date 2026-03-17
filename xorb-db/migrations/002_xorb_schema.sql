-- X.orb schema updates — add scope column, ensure all required columns exist

-- Add scope column if not exists (falls back to role)
DO $$ BEGIN
  ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS scope TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add trust_score column
DO $$ BEGIN
  ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add trust_source column
DO $$ BEGIN
  ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS trust_source TEXT DEFAULT 'local';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add erc8004_registered column
DO $$ BEGIN
  ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS erc8004_registered BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure agent_actions has required columns
DO $$ BEGIN
  ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true;
  ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS tool TEXT;
  ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS gate_results JSONB;
  ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 0;
  ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS audit_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_agents_scope ON agent_registry(scope);
CREATE INDEX IF NOT EXISTS idx_agents_trust ON agent_registry(trust_score DESC);
