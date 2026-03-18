# X.orb — Owner Action Items

**Updated:** 2026-03-18 (Post-Comprehensive Audit)
**These are tasks only YOU (Bidur) can do.** They require access to external dashboards, credentials, or accounts that Claude cannot access.

---

## STATUS SUMMARY

| Category | Status | Blocking |
|----------|--------|----------|
| Supabase env vars | **PENDING** | Deployment |
| Custom domains | **PENDING** | Professional URLs |
| API key creation | **PENDING** | First customer |
| Remaining contract deploy | **PENDING** | On-chain features |
| Monitoring (Sentry) | **PENDING** | Incident response |
| SDK publishing | **PENDING** | Developer adoption |

---

## CRITICAL — Do First (15 minutes total, unlocks 80% of platform)

### 1. Set Supabase Environment Variables in Vercel

**Why**: Without this, agents, reputation, slashing, events, and payments all reset on every cold start. This is the #1 blocker identified in the comprehensive audit.

**Steps**:
1. Go to **https://supabase.com/dashboard/project/rinzqwqzrtxfgizgpkmn/settings/api**
2. Copy the **URL** (looks like `https://rinzqwqzrtxfgizgpkmn.supabase.co`)
3. Copy the **service_role key** (starts with `eyJ...` — NOT the anon key)
4. Go to **Vercel → x.orb project → Settings → Environment Variables**
5. Add:
   - `SUPABASE_URL` = the URL from step 2
   - `SUPABASE_SERVICE_KEY` = the service_role key from step 3
   - `NODE_ENV` = `production` (**CRITICAL** — without this, the dev auth fallback accepts any API key)
   - `CRON_SECRET` = generate a random 32-char string (e.g., `openssl rand -hex 16`)
   - Set all for **Production, Preview, and Development**
6. Click **Save**
7. **Redeploy** the project (Settings → Deployments → Redeploy latest)
8. Verify: visit `https://api.xorb.xyz/v1/health` — should show `status: ok`

**Also set the same vars on the dashboard project** if it needs to call Supabase directly.

---

### 2. Verify Supabase Tables Exist

Run this in Supabase SQL Editor to check:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Required tables** (if any are missing, run the corresponding migration from `xorb-db/migrations/`):
- `agent_registry`
- `agent_actions`
- `agent_events`
- `api_keys`
- `payment_nonces`
- `payments`
- `marketplace_listings`
- `marketplace_engagements`
- `reputation_history`
- `platform_events`
- `webhook_endpoints`
- `platform_config`
- `spending_caps`

If tables are missing, run migrations in order:
```sql
-- Run each file from xorb-db/migrations/ in order:
-- 003_persistence_tables.sql
-- 004_cascades_and_rls.sql
-- 005_payments.sql
-- 006_spending_caps.sql
```

---

### 3. Create Your First Real API Key

Once Supabase is connected:

```sql
-- Generate your API key (save the UNHASHED key somewhere safe!)
-- Your key: xorb_live_bidur_2026
INSERT INTO api_keys (owner_address, key_hash, name, is_active, scopes, rate_limit_per_minute)
VALUES (
  '0xYOUR_WALLET_ADDRESS_HERE',
  encode(sha256('xorb_live_bidur_2026'::bytea), 'hex'),
  'Bidur primary key',
  true,
  ARRAY['read', 'write', 'admin'],
  60
);
```

Then test:
```bash
curl -H "x-api-key: xorb_live_bidur_2026" https://api.xorb.xyz/v1/agents
```

---

## HIGH PRIORITY — Do This Week

### 4. Connect Custom Domains

**API domain**:
1. Vercel → x.orb project → Settings → Domains
2. Add `api.xorb.xyz`
3. Update DNS: CNAME `api` → `cname.vercel-dns.com`

**Dashboard domain**:
1. Vercel → xorb-dashboard project → Settings → Domains
2. Add `dashboard.xorb.xyz`
3. Update DNS: CNAME `dashboard` → `cname.vercel-dns.com`

---

### 5. Deploy Remaining 3 Smart Contracts

**Audit finding:** ActionVerifier, XorbEscrow, and XorbPaymentSplitter are written but not deployed. These are required for audit hash anchoring, escrow marketplace, and batch payment settlement.

**Prerequisites**: Wallet with MATIC on Polygon PoS.

1. Set env vars in `xorb-contracts/.env`:
   ```
   PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
   POLYGON_RPC_URL=https://polygon-rpc.com
   USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
   TREASURY_ADDRESS=0xYOUR_TREASURY_WALLET
   ADMIN_ADDRESS=0xYOUR_ADMIN_WALLET
   ```
2. Deploy ActionVerifier: `npx hardhat run scripts/deploy-action-verifier.js --network polygon`
3. Deploy XorbEscrow: `npx hardhat run scripts/deploy-escrow.js --network polygon`
4. Deploy XorbPaymentSplitter: `npx hardhat run scripts/deploy-splitter.js --network polygon`
5. **Save deployed addresses** — Claude will wire them into the API env vars

**After deploying**, add to Vercel env vars:
   - `ACTION_VERIFIER_ADDRESS` = deployed address
   - `XORB_ESCROW_ADDRESS` = deployed address
   - `XORB_PAYMENT_SPLITTER_ADDRESS` = deployed address

---

### 6. Set Up Payment Infrastructure

**Audit finding:** The payment flow is architecturally complete but needs these env vars to activate:

Add to Vercel env vars:
- `XORB_FACILITATOR_PRIVATE_KEY` = private key for the facilitator wallet (handles USDC transfers)
- `XORB_TREASURY_ADDRESS` = your treasury wallet address
- `POLYGON_RPC_URL` = Polygon PoS RPC endpoint (e.g., from Alchemy/Infura)
- `XORB_FACILITATOR_ADDRESS` = public address of facilitator wallet

**SECURITY WARNING from audit:** The facilitator wallet is a single point of failure. Consider:
- Using a dedicated hardware wallet
- Planning migration to multisig (Gnosis Safe)
- Never using the deployer key as the facilitator key
- Setting conservative daily spending limits

---

## MEDIUM PRIORITY — Do This Month

### 7. Set Up Monitoring (Sentry)

**Audit finding:** No error monitoring exists. Errors go to console.error and are lost.

1. Create a **Sentry** project at sentry.io
2. Get the DSN
3. Add `SENTRY_DSN` env var to both Vercel projects
4. Tell Claude to wire the SDK into the API error handler

---

### 8. Set Up Upstash Redis (Rate Limiting)

**Audit finding:** Rate limiting uses in-memory Map — doesn't work across Vercel serverless instances. A client hitting different instances bypasses the limit.

1. Create account at upstash.com
2. Create a Redis database (Vercel-compatible)
3. Get the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add both to Vercel env vars
5. Tell Claude to replace the in-memory rate limiter with Upstash

---

### 9. Publish SDKs (When Ready)

**TypeScript SDK to npm**:
```bash
cd packages/xorb-sdk-ts
npm login
npm publish --access public
```

**Python SDK to PyPI**:
```bash
cd packages/xorb-sdk-py
pip install twine build
python -m build
twine upload dist/*
```

**MCP Server to npm**:
```bash
cd packages/xorb-mcp
npm publish --access public
```

---

### 10. Add Logo Asset

**Audit finding:** `Sidebar.tsx` references `/logo.png` which doesn't exist. Shows broken image icon on every page.

Either:
- Add your logo file to `apps/dashboard/public/logo.png`
- Or tell Claude to replace with an SVG logo component

---

## LOW PRIORITY — Nice to Have

### 11. Create Status Page
- Set up status.xorb.xyz using Betteruptime, Instatus, or similar
- Monitor `/v1/health` endpoint
- Display uptime metrics publicly

### 12. Set Up Incident Response
- Create a Slack channel or PagerDuty account for alerts
- Connect Sentry alerts to notification channel
- Document runbook for: Supabase down, contracts paused, wallet compromise

### 13. Configure ALLOWED_ORIGINS for Production
Add to Vercel env vars:
```
ALLOWED_ORIGINS=https://dashboard.xorb.xyz,https://xorb.xyz
```
(Remove localhost origins for production)

---

## AUDIT FINDINGS REQUIRING CODE CHANGES (Tell Claude to Do These)

These items came from the comprehensive audit and require code changes. You don't need to do them yourself — just ask Claude:

| # | Task | Impact | Audit Finding |
|---|------|--------|---------------|
| 0 | **Fix payment recipient bug** — `pipeline.ts:163` sends USDC to empty address | **CRITICAL** — funds lost on settlement | `splitAndForward('')` passes empty string |
| 0b | **Fix registry persistence bug** — `updateReputation()` and `recordAction()` never call `store.upsertAgent()` | **CRITICAL** — rep/action counts lost even with Supabase | `registry.ts:175-191` |
| 1 | Add DataStore persistence for reputation, slashing, events, webhooks | **CRITICAL** — state lost on cold start | In-memory Map in 4 services |
| 2 | Wire API to call deployed contracts | **HIGH** — contracts are decorative | AgentRegistry, ReputationScore never called |
| 3 | Add self-service API key creation endpoint | **HIGH** — blocks organic growth | No `POST /v1/auth/keys` |
| 4 | Fix cleanup cron auth check | **MEDIUM** — accessible without CRON_SECRET | `cron.ts:88` weak guard |
| 5 | Import and render OnboardingWizard | **MEDIUM** — dead code | Component exists but never mounted |
| 6 | Add toast notifications (install sonner) | **MEDIUM** — no success feedback | Mutations succeed silently |
| 7 | Use existing Skeleton components | **LOW** — already built, just unused | `Skeleton.tsx` dead code |
| 8 | Fix mobile sidebar responsive layout | **MEDIUM** — breaks on phones | Fixed 220px width |
| 9 | Add CSV export to Agents, Billing, Audit pages | **MEDIUM** — no data export | Zero export functionality |
| 10 | Add spending cap enforcement in x402 middleware | **MEDIUM** — caps table exists but unused | `spending_caps` table not checked |
| 11 | Add API key expiration support | **LOW** — keys never expire | No `expires_at` column checked |
| 12 | Replace console.log with structured logger | **LOW** — unprofessional | 5 instances in API code |
| 13 | **Fix contract USDC decimals** — `AgentRegistry.sol:65` uses `10**18` but USDC has 6 decimals | **HIGH** — bond amounts are 10^12 too large | `minStakeBond = 100 * 10**18` should be `10**6` |
| 14 | **Fix landing page OG tags** — missing `og:image`, `twitter:image` | **MEDIUM** — no social preview | `apps/landing/index.html` |
| 15 | **Fix landing page mobile** — only 1 media query, code block overflows | **MEDIUM** — broken on phones | `apps/landing/index.html:76` |
| 16 | **Fix `target="_blank"` security** — 7 links missing `rel="noopener noreferrer"` | **LOW** — reverse tabnabbing | `apps/landing/index.html` |
| 17 | **Fix landing page semantic HTML** — no nav/header/main tags | **LOW** — accessibility | `apps/landing/index.html` |
| 18 | **Fix health /deep auth** — checks header presence but not validity | **MEDIUM** — info disclosure | `routes/health.ts:25` |
| 19 | **Fix Billing fee calculation** — hardcodes $0.005 instead of reading from fee engine | **MEDIUM** — wrong amounts for tiered users | `Billing.tsx:22` |
| 20 | **Fix service status display** — AgentScore/PayCrow shown "available" but domains dead | **MEDIUM** — misleading | `Overview.tsx:86-100` |
| 21 | **Fix landing page code example** — missing `x-api-key` header | **LOW** — 401 if copied | `apps/landing/index.html:156` |
| 22 | **Fix "PDF export"** — returns plain text, not real PDF | **LOW** — misleading | `routes/audit.ts` |

---

## Priority Order Summary

| # | Task | Who | Impact | Time |
|---|------|-----|--------|------|
| 1 | Set Supabase + NODE_ENV + CRON_SECRET env vars | **You** | Data persists, auth enforced | 5 min |
| 2 | Verify/create Supabase tables | **You** | Persistence works | 5 min |
| 3 | Create your API key | **You** | Auth works | 5 min |
| 4 | Add persistence for 4 services | **Claude** | State survives cold starts | 2 hrs |
| 5 | Connect custom domains | **You** | Professional URLs | 10 min |
| 6 | Fix cron auth + add key creation endpoint | **Claude** | Security + growth | 1 hr |
| 7 | Deploy remaining 3 contracts | **You** | On-chain features | 30 min |
| 8 | Set up payment infra env vars | **You** | Revenue enabled | 10 min |
| 9 | Wire API to contracts | **Claude** | Claims become real | 3 hrs |
| 10 | Dashboard UX fixes (toasts, onboarding, mobile) | **Claude** | Customer-ready | 2 hrs |
| 11 | Set up Sentry | **You** | Error visibility | 10 min |
| 12 | Set up Upstash Redis | **You** | Rate limiting works | 10 min |
| 13 | Publish SDKs | **You** | Developer adoption | 15 min |

**Items 1-3 take 15 minutes and unlock 80% of the platform.**
**Items 4-6 are code changes Claude can make immediately.**
**Items 7-10 together bring the platform from 6/10 to 8/10.**
