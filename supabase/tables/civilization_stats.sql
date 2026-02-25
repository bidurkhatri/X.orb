-- Civilization Stats: Aggregated metrics for the dashboard
CREATE TABLE IF NOT EXISTS civilization_stats (
    id TEXT PRIMARY KEY DEFAULT 'global',   -- single row for global stats
    total_agents INTEGER NOT NULL DEFAULT 0,
    active_agents INTEGER NOT NULL DEFAULT 0,
    paused_agents INTEGER NOT NULL DEFAULT 0,
    revoked_agents INTEGER NOT NULL DEFAULT 0,
    total_stake_locked TEXT NOT NULL DEFAULT '0',  -- wei
    total_slashed TEXT NOT NULL DEFAULT '0',        -- wei
    total_actions_24h INTEGER NOT NULL DEFAULT 0,
    total_violations_24h INTEGER NOT NULL DEFAULT 0,
    avg_reputation NUMERIC(10,2) NOT NULL DEFAULT 5000,
    economy_volume_24h TEXT NOT NULL DEFAULT '0',   -- wei
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize global stats row
INSERT INTO civilization_stats (id) VALUES ('global') ON CONFLICT DO NOTHING;

ALTER TABLE civilization_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view stats" ON civilization_stats
    FOR SELECT USING (true);

CREATE POLICY "Service role can update" ON civilization_stats
    FOR UPDATE USING (current_setting('role') = 'service_role');
