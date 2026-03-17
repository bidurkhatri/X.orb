# X.orb — Owner Action Items

**These are tasks only YOU (Bidur) can do.** They require access to external dashboards, credentials, or accounts that Claude cannot access.

---

## 1. Set Supabase Environment Variables in Vercel (CRITICAL — C4)

**Why**: Without this, every agent registered by a real user disappears when Vercel cold-starts the function. This is the #1 blocker.

**Steps**:
1. Go to **https://supabase.com/dashboard/project/rinzqwqzrtxfgizgpkmn/settings/api**
2. Copy the **URL** (looks like `https://rinzqwqzrtxfgizgpkmn.supabase.co`)
3. Copy the **service_role key** (starts with `eyJ...` — NOT the anon key)
4. Go to **Vercel → x.orb project → Settings → Environment Variables**
5. Add:
   - `SUPABASE_URL` = the URL from step 2
   - `SUPABASE_SERVICE_KEY` = the service_role key from step 3
   - Set for **Production, Preview, and Development**
6. Click **Save**
7. **Redeploy** the project (Settings → Deployments → Redeploy latest)
8. Verify: visit `https://api.xorb.xyz/v1/health` — should show `"persistence": "supabase"`

**Also set the same vars on the dashboard project** if it needs to call Supabase directly.

---

## 2. Connect Custom Domains

**API domain**:
1. Vercel → x.orb project → Settings → Domains
2. Add `api.xorb.xyz`
3. Update DNS: CNAME `api` → `cname.vercel-dns.com`

**Dashboard domain** (if not already done):
1. Vercel → xorb-dashboard project → Settings → Domains
2. Add `dashboard.xorb.xyz`
3. Update DNS: CNAME `dashboard` → `cname.vercel-dns.com`

**Landing page**:
1. If xorb.xyz root should show the landing page, configure that project's domain too

---

## 3. Create Your First Real API Key

Once Supabase is connected, run this SQL in Supabase SQL Editor:

```sql
-- Create the api_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_wallet TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{read,write}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Generate your API key (save the UNHASHED key somewhere safe!)
-- Your key: xorb_live_bidur_2026
INSERT INTO api_keys (sponsor_wallet, key_hash, name)
VALUES (
  '0xYOUR_WALLET_ADDRESS_HERE',
  encode(sha256('xorb_live_bidur_2026'::bytea), 'hex'),
  'Bidur primary key'
);
```

Then test:
```bash
curl -H "x-api-key: xorb_live_bidur_2026" https://api.xorb.xyz/v1/agents
```

---

## 4. Verify Supabase Tables Exist

Run this in Supabase SQL Editor to check:

```sql
-- Check if core tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

If `agent_registry` or `agent_actions` are missing, run the migration:

```sql
-- Core tables (run if missing)
CREATE TABLE IF NOT EXISTS agent_registry (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'general',
  sponsor_address TEXT NOT NULL,
  stake_bond TEXT DEFAULT '50000000',
  reputation_score INTEGER DEFAULT 50,
  status TEXT DEFAULT 'Active',
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_actions INTEGER DEFAULT 0,
  llm_provider TEXT DEFAULT '',
  scope TEXT,
  trust_score INTEGER DEFAULT 50,
  trust_source TEXT DEFAULT 'local',
  erc8004_registered BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agent_registry(agent_id),
  action_type TEXT NOT NULL,
  reputation_delta INTEGER DEFAULT 0,
  approved BOOLEAN DEFAULT true,
  tool TEXT,
  gate_results JSONB,
  latency_ms INTEGER DEFAULT 0,
  audit_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  event_type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_sponsor ON agent_registry(sponsor_address);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_actions_agent ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_agent ON agent_events(agent_id);
```

---

## 5. Deploy Smart Contracts to Base Sepolia (When Ready)

**Prerequisites**: You need a wallet with Base Sepolia ETH.

1. Get Base Sepolia ETH from faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
2. Set env vars in `xorb-contracts/.env`:
   ```
   PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
   BASE_SEPOLIA_RPC=https://sepolia.base.org
   USDC_ADDRESS=0x... (Base Sepolia USDC or a mock ERC20)
   TREASURY_ADDRESS=0xYOUR_TREASURY_WALLET
   ADMIN_ADDRESS=0xYOUR_ADMIN_WALLET
   ```
3. Run: `cd xorb-contracts && npx hardhat run scripts/deploy-xorb.js --network baseSepolia`
4. Save the deployed addresses — I'll wire them into the API

---

## 6. Publish SDKs (When Ready)

**TypeScript SDK to npm**:
```bash
cd packages/xorb-sdk-ts
npm login  # Use your npm account
npm publish --access public
```

**Python SDK to PyPI**:
```bash
cd packages/xorb-sdk-py
pip install twine build
python -m build
twine upload dist/*  # Use your PyPI credentials
```

**MCP Server to npm**:
```bash
cd packages/xorb-mcp
npm publish --access public
```

---

## 7. Set Up Monitoring (Optional but Recommended)

1. Create a **Sentry** project at sentry.io
2. Get the DSN
3. Add `SENTRY_DSN` env var to both Vercel projects
4. I'll wire the SDK into the API error handler

---

## Summary — Priority Order

| # | Task | Impact | Time |
|---|------|--------|------|
| 1 | Set Supabase env vars in Vercel | Data persists | 5 min |
| 2 | Verify/create Supabase tables | Persistence works | 5 min |
| 3 | Create your API key | Auth works | 5 min |
| 4 | Connect custom domains | Professional URLs | 10 min |
| 5 | Deploy contracts to Base Sepolia | On-chain integration | 30 min |
| 6 | Publish SDKs | Developer adoption | 15 min |
| 7 | Set up Sentry | Error visibility | 10 min |

**Items 1-3 take 15 minutes total and unlock 80% of the platform's value.**
