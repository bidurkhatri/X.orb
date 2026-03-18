# X.orb — Owner Action Items

**Updated:** 2026-03-19 (Post-Remediation — All CRITICAL/HIGH Code Fixes Applied)
**These are tasks only YOU (Bidur) can do.** They require access to external dashboards, credentials, or accounts that Claude cannot access.

---

## STATUS SUMMARY

| Category | Status | Notes |
|----------|--------|-------|
| Supabase env vars | **DONE** | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV`, `CRON_SECRET` set |
| Supabase tables | **PARTIALLY DONE** | Core tables exist. Migration tables (payments, config, etc.) still needed |
| API key | **DONE** | `xorb_live_bidur_2026` inserted into `api_keys` table |
| Custom domains | **DONE** | `api.xorb.xyz` and `dashboard.xorb.xyz` working |
| API deployment | **DONE** | v0.5.1 live, health endpoint secured |
| Landing page | **DONE** | DJD Agent Score, Xorb Escrow, OG tags, mobile, security fixes deployed |
| Dashboard | **DONE** | Login, onboarding wizard, toasts, skeletons, mobile sidebar deployed |
| Contract deploy | **PENDING** | 3 contracts still need deployment |
| Payment infra | **PENDING** | Facilitator wallet env vars not set |
| Monitoring | **PENDING** | No Sentry |
| SDK publishing | **PENDING** | Not published to npm/PyPI |

---

## COMPLETED (No Action Needed)

These were done by Claude or by you during this session:

| # | Task | Status |
|---|------|--------|
| 1 | Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV`, `CRON_SECRET`, `POLYGON_RPC_URL` in Vercel | **DONE** |
| 2 | Create API key in Supabase | **DONE** — `xorb_live_bidur_2026` |
| 3 | Fix payment recipient bug (`pipeline.ts:163`) | **DONE** — code fix applied |
| 4 | Fix registry persistence (`updateReputation`/`recordAction`) | **DONE** — code fix applied |
| 5 | Fix USDC decimals (`AgentRegistry.sol:65` 10^18 → 10^6) | **DONE** — code fix applied |
| 6 | Fix cleanup cron auth | **DONE** — code fix applied |
| 7 | Fix health endpoint info leakage | **DONE** — deployed v0.5.1 |
| 8 | Replace AgentScore/PayCrow with DJD Agent Score/Xorb Escrow | **DONE** — landing, dashboard, API all updated |
| 9 | Wire OnboardingWizard | **DONE** — renders on first login |
| 10 | Add toast notifications (sonner) | **DONE** — on all mutations |
| 11 | Wire Skeleton/ButtonSpinner components | **DONE** — on all loading states |
| 12 | Fix broken logo | **DONE** — SVG gradient logo |
| 13 | Fix mobile sidebar | **DONE** — hamburger menu |
| 14 | Fix billing hardcoded fee | **DONE** — uses dynamic pricing |
| 15 | Fix landing page OG tags | **DONE** — og:image, twitter:image |
| 16 | Fix landing page mobile | **DONE** — additional breakpoints |
| 17 | Fix `target="_blank"` security | **DONE** — rel="noopener noreferrer" |
| 18 | Fix landing page semantic HTML | **DONE** — header/main/nav |
| 19 | Fix landing page code example | **DONE** — includes x-api-key |
| 20 | Update footer | **DONE** — Fintex Australia Pty Ltd |
| 21 | Add CSV export on Agents page | **DONE** |
| 22 | Self-service API key creation | **ALREADY EXISTS** — `POST /v1/auth/keys` |
| 23 | Wire on-chain agent registration | **DONE** — non-blocking call |
| 24 | Enable audit hash anchoring by default | **DONE** |
| 25 | Supabase-backed burst rate limiting | **DONE** — in `apps/api/` (note: `api/index.ts` still uses in-memory) |

---

## REMAINING — Action Required

### HIGH PRIORITY (Do This Week)

#### 1. Run Remaining Supabase Migrations

Your database has `agent_registry`, `agent_actions`, `agent_events`, `api_keys` but is **missing** these tables that the API needs. Run this SQL in Supabase SQL Editor:

```sql
-- Rate limits (for persistent rate limiting)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_duration_ms INTEGER NOT NULL DEFAULT 3600000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment nonces (replay protection)
CREATE TABLE IF NOT EXISTS payment_nonces (
  nonce_hash TEXT PRIMARY KEY,
  payer_address TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marketplace
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
  owner_address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rate_usdc_per_hour BIGINT,
  rate_usdc_per_action BIGINT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_engagements (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id),
  hirer_address TEXT NOT NULL,
  escrow_amount_usdc BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Reputation history
CREATE TABLE IF NOT EXISTS reputation_history (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  score_before INTEGER NOT NULL,
  score_after INTEGER NOT NULL,
  streak_count INTEGER NOT NULL DEFAULT 0,
  tier_before TEXT,
  tier_after TEXT,
  action_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reputation_history_agent ON reputation_history (agent_id, created_at DESC);

-- Platform events
CREATE TABLE IF NOT EXISTS platform_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  agent_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_agent ON platform_events (agent_id, created_at DESC);

-- Platform config
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

-- Payments
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

-- Sponsor profiles
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
```

---

#### 2. Deploy Remaining 3 Smart Contracts

ActionVerifier, XorbEscrow, and XorbPaymentSplitter are written but not deployed.

1. Set env vars in `xorb-contracts/.env`:
   ```
   PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
   POLYGON_RPC_URL=https://polygon-rpc.com
   USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
   TREASURY_ADDRESS=0xYOUR_TREASURY_WALLET
   ADMIN_ADDRESS=0xYOUR_ADMIN_WALLET
   ```
2. Deploy each contract and save addresses
3. Add to Vercel env vars:
   - `ACTION_VERIFIER_ADDRESS`
   - `XORB_ESCROW_ADDRESS`
   - `XORB_PAYMENT_SPLITTER_ADDRESS`

---

#### 3. Set Up Payment Infrastructure

Add to Vercel env vars:
- `XORB_FACILITATOR_PRIVATE_KEY` — private key for facilitator wallet
- `XORB_TREASURY_ADDRESS` — treasury wallet address
- `XORB_FACILITATOR_ADDRESS` — public address of facilitator wallet

**Security:** Use a dedicated hardware wallet. Plan multisig migration.

---

#### 4. Fix `/v1/integrations` Info Leakage

The integrations endpoint still shows which env vars are missing and the RPC URL. Either:
- Tell Claude to strip `smart_contracts.missing` and `rpc` from the response
- Or set the missing env vars so nothing shows as "missing"

---

#### 5. Create OG Image

The landing page now has `<meta property="og:image" content="https://xorb.xyz/og-image.png">` but the image file doesn't exist yet.

Create a 1200x630px image:
- Dark background (#0A0A0A)
- "X.orb" logo
- Tagline: "The orchestration layer for AI agent trust"
- "8 gates · 4 integrations · 1 API call"

Save as `apps/landing/public/og-image.png` or host at `xorb.xyz/og-image.png`.

---

### MEDIUM PRIORITY (Do This Month)

#### 6. Set Up Monitoring (Sentry)
1. Create Sentry project at sentry.io
2. Add `SENTRY_DSN` to Vercel env vars
3. Tell Claude to wire into the error handler

#### 7. Publish SDKs

**TypeScript SDK to npm:**
```bash
cd packages/xorb-sdk-ts && npm publish --access public
```

**Python SDK to PyPI:**
```bash
cd packages/xorb-sdk-py && python -m build && twine upload dist/*
```

**MCP Server to npm:**
```bash
cd packages/xorb-mcp && npm publish --access public
```

#### 8. Migrate `api/index.ts` to Modular Architecture

**Context:** Vercel currently serves the 1500-line monolithic `api/index.ts` because it can't resolve cross-directory imports to `apps/api/`. The modular Hono app in `apps/api/` has all the audit fixes (Supabase-backed rate limiting, proper auth, typed errors, etc.) but isn't served in production.

**Options:**
- Configure Vercel to use `apps/api/` as the serverless function directory
- Or gradually port the remaining fixes from `apps/api/` into `api/index.ts`
- Or use Vercel's `build` step to compile `apps/api/` into `api/index.ts`

This is the biggest architectural debt remaining.

#### 9. Configure ALLOWED_ORIGINS
Add to Vercel env vars:
```
ALLOWED_ORIGINS=https://dashboard.xorb.xyz,https://xorb.xyz
```

---

### LOW PRIORITY (Nice to Have)

| # | Task | Notes |
|---|------|-------|
| 10 | Create status page (status.xorb.xyz) | Betteruptime or Instatus |
| 11 | Set up incident response (Slack/PagerDuty) | Connect to Sentry alerts |
| 12 | Add Python SDK missing APIs (Compliance, Events, Payments) | Parity with TypeScript SDK |
| 13 | Replace `console.log` with structured logger in api/index.ts | ~39 instances |
| 14 | Add spending cap enforcement in x402 middleware | `spending_caps` table exists but not checked |
| 15 | Fix "PDF export" to return actual PDF | Currently returns plain text |

---

## WHAT'S LIVE NOW

| Component | URL | Status |
|-----------|-----|--------|
| **API** | https://api.xorb.xyz/v1/health | v0.5.1, secured health endpoint |
| **Landing** | https://xorb.xyz | Updated integrations, OG tags, mobile, security |
| **Dashboard** | https://dashboard.xorb.xyz | Login flow, onboarding, toasts, skeletons, mobile |
| **GitHub** | https://github.com/bidurkhatri/X.orb | Public repo |

## WHAT CHANGED TODAY

- API version: 0.4.0 → **0.5.1**
- Health endpoint: leaked everything → **minimal info only**
- Integrations: AgentScore (parked) → **DJD Agent Score** (live), PayCrow (dead) → **Xorb Escrow** (native)
- Landing page: missing OG tags, insecure links, 1 breakpoint → **fully fixed**
- Dashboard: no login, no feedback, broken logo, no mobile → **all fixed**
- Registry: lost rep/actions on restart → **persists to DataStore**
- Contract: USDC 10^18 → **10^6** (correct)
- Cron: weak auth → **requires CRON_SECRET**
- On-chain: decorative → **wired (registration + anchoring)**

## REMAINING GAP TO INVESTOR-READY

| Gap | Effort | Blocking |
|-----|--------|----------|
| Run Supabase migrations (tables missing) | 5 min | First customer |
| Deploy 3 remaining contracts | 30 min | On-chain claims |
| Set payment infra env vars | 10 min | Revenue |
| Create OG image | 15 min | Social sharing |
| Migrate api/index.ts to modular architecture | 1-2 days | Technical debt |
| Sentry + monitoring | 10 min | Incident response |
| Publish SDKs | 15 min | Developer adoption |

**After items 1-4 (~1 hour of your time), the platform is ready for first customers.**
