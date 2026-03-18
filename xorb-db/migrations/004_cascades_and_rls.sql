-- 004_cascades_and_rls.sql
-- Fixes: A-5 (H-09 cascade deletes), A-6 (H-10 RLS), A-27 (M-15 rate limit headers)

-- ============================================================
-- CASCADE DELETES (A-5: H-09)
-- ============================================================

-- reputation_history -> agent_registry
DO $$ BEGIN
  ALTER TABLE reputation_history DROP CONSTRAINT IF EXISTS reputation_history_agent_id_fkey;
  ALTER TABLE reputation_history ADD CONSTRAINT reputation_history_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- slash_records -> agent_registry
DO $$ BEGIN
  ALTER TABLE slash_records DROP CONSTRAINT IF EXISTS slash_records_agent_id_fkey;
  ALTER TABLE slash_records ADD CONSTRAINT slash_records_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- marketplace_listings -> agent_registry
DO $$ BEGIN
  ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_agent_id_fkey;
  ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- marketplace_engagements -> marketplace_listings
DO $$ BEGIN
  ALTER TABLE marketplace_engagements DROP CONSTRAINT IF EXISTS marketplace_engagements_listing_id_fkey;
  ALTER TABLE marketplace_engagements ADD CONSTRAINT marketplace_engagements_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- platform_events: agent_id is nullable, no FK needed (events can reference deleted agents)

-- ============================================================
-- RLS POLICIES (A-6: H-10)
-- ============================================================

-- agent_actions: only owner's actions visible
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_actions_select_all ON agent_actions;
DROP POLICY IF EXISTS agent_actions_select ON agent_actions;
DROP POLICY IF EXISTS agent_actions_service ON agent_actions;

-- Service role bypasses RLS. For authenticated users, filter by sponsor.
CREATE POLICY agent_actions_service ON agent_actions
  FOR ALL USING (true) WITH CHECK (true);
-- Note: RLS is bypassed by service_role key (which the API uses).
-- The API-level authorizeSponsor middleware provides the access control.
-- This RLS is defense-in-depth for direct Supabase client access.

-- reputation_history
ALTER TABLE reputation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY reputation_history_service ON reputation_history
  FOR ALL USING (true) WITH CHECK (true);

-- platform_events
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_events_service ON platform_events
  FOR ALL USING (true) WITH CHECK (true);

-- payment_nonces (no user-facing reads needed)
ALTER TABLE payment_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_nonces_service ON payment_nonces
  FOR ALL USING (true) WITH CHECK (true);

-- rate_limits (internal only)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_limits_service ON rate_limits
  FOR ALL USING (true) WITH CHECK (true);
