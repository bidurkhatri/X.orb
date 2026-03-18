# X.orb Platform — Audit Report v3 (Post-Deployment Verification)

**Date:** 2026-03-19
**Auditor:** Claude Code
**Method:** End-to-end verification of LIVE production endpoints + codebase review
**Tests:** 63/63 pass (48 agent-core + 15 API). TypeScript type checks pass.

---

## EXECUTIVE SUMMARY

The X.orb platform has undergone 3 rounds of auditing and remediation. Major infrastructure is now deployed:
- **8/8 smart contracts** deployed on Polygon PoS
- **21 Supabase tables** created
- **11 Vercel env vars** configured
- **API v0.5.1** live with secured health endpoint
- **Landing page** updated with live integrations, OG image, mobile, security fixes
- **Dashboard** has login, onboarding wizard, toast notifications, skeleton loaders, mobile sidebar

However, the production API still runs the old monolithic `api/index.ts` (because Vercel can't resolve cross-directory imports to `apps/api/`). Critical fixes were applied directly to this file, but it still has gaps compared to the modular `apps/api/` codebase.

---

## LIVE ENDPOINT VERIFICATION (2026-03-19)

### Landing Page (xorb.xyz) — 8/8 PASS

| Check | Result |
|---|---|
| No AgentScore/PayCrow references | **PASS** — MoltGuard + Xorb Escrow everywhere |
| OG image meta tags (og:image, twitter:image) | **PASS** — in source, image file deployed |
| `rel="noopener noreferrer"` on external links | **PASS** — all 7 links |
| Semantic HTML (header/main/nav) | **PASS** |
| Code example includes x-api-key | **PASS** |
| Footer: Fintex Australia Pty Ltd | **PASS** |
| Mobile responsive (640px + 480px breakpoints) | **PASS** |
| Pricing link in footer | **PASS** |

### API Health (api.xorb.xyz/v1/health) — PASS

```json
{"status":"ok","service":"xorb-api","version":"0.5.1","timestamp":"...","pipeline":"8-gate sequential check","auth":"required","documentation":"https://docs.xorb.xyz"}
```

- **PASS** — v0.5.1, minimal info, no leaks

### API Integrations (api.xorb.xyz/v1/integrations) — 2 ISSUES

- **PASS** — MoltGuard replaces AgentScore, Xorb Escrow replaces PayCrow
- **PASS** — ActionVerifier shows as deployed (`0x463...057`)
- **FAIL** — AgentRegistry and SlashingEngine show "not configured" (env vars not set in Vercel)
- **FAIL** — Leaks `smart_contracts.missing` env var names and RPC URL to public

### API Pricing (api.xorb.xyz/v1/pricing) — 3 ISSUES

| Field | Current (WRONG) | Correct |
|---|---|---|
| Free tier limit | `1000` | `500` (per fee engine + docs) |
| Endpoints listed | 3 | 8 (all priced endpoints) |
| `GET /v1/agents` listed as free | Yes | Should require auth |

### API Agents (api.xorb.xyz/v1/agents) — 1 CRITICAL ISSUE

- **FAIL** — Returns ALL 10 agents publicly without any auth. Old `api/index.ts` doesn't filter by sponsor. Anyone can see every agent, wallet address, stake bond, and permission scope.

### Dashboard (dashboard.xorb.xyz) — 1 BLOCKER

- **PASS** — Login page renders with API key input
- **FAIL** — **No way for a new user to create an API key.** The `POST /v1/auth/keys` endpoint exists in `apps/api/` but is NOT in the old `api/index.ts` that Vercel serves. A new user visiting the dashboard hits a dead end.

---

## SCORECARD (v3)

| # | Perspective | v1 | v2 | v3 | One-Line Verdict |
|---|-------------|----|----|-----|-----------------|
| 1 | End User | 5 | 5 | **6** | Dashboard has login+onboarding+toasts, but can't create API key |
| 2 | AI Agent Developer | 7 | 7.5 | **7** | SDKs complete, but pricing endpoint is wrong and no key creation API live |
| 3 | AI Agent | 6 | 7 | **6.5** | Registry persists, but agents endpoint is public (no auth filtering) |
| 4 | CEO | 7 | 8 | **7.5** | 8 contracts deployed, but pricing doesn't match fee engine |
| 5 | CTO | 7 | 8 | **7.5** | Modular code is correct but old monolith is what runs in production |
| 6 | COO | 5 | 6 | **6.5** | 2 contract addresses missing from Vercel, integrations leaks config |
| 7 | CFO | 6 | 7 | **6.5** | Free tier says 1000 but code says 500 — inconsistency |
| 8 | CSO/CISO | 6 | 7.5 | **6.5** | Agents endpoint returns all data without auth — data exposure |
| 9 | Product Manager | 5 | 5 | **6** | Onboarding exists but key creation flow is broken |
| 10 | Investor | 6 | 7 | **7** | Real contracts deployed, but would immediately find auth gap |
| | **OVERALL** | **6.0** | **6.9** | **6.7** | **Blocked by 4 issues in the live api/index.ts** |

**Score dropped slightly from v2 because v2 scored the codebase (apps/api/), but v3 scores what's actually live in production (api/index.ts).**

---

## REMAINING ISSUES (Ordered by Severity)

### CRITICAL

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 1 | **`/v1/agents` returns all agents without auth** | `api/index.ts` | Anyone can see all agent data, wallet addresses, permissions |
| 2 | **No self-service API key creation** | `api/index.ts` (missing endpoint) | New users cannot onboard |

### HIGH

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 3 | **Pricing shows free tier 1000, should be 500** | `api/index.ts:39` `FREE_TIER_LIMIT = 1000` | Financial inconsistency with fee engine and docs |
| 4 | **Pricing only shows 3 endpoints, should show 8** | `api/index.ts` pricing route | Developers see incomplete pricing |
| 5 | **2 contract addresses not set in Vercel** | Vercel env vars | `AGENT_REGISTRY_ADDRESS`, `SLASHING_ENGINE_ADDRESS` show "not configured" |
| 6 | **`/v1/integrations` leaks missing env vars + RPC URL** | `api/index.ts` integrations route | Competitors see infrastructure gaps |

### MEDIUM

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 7 | Facilitator wallet has 0 MATIC | Blockchain | Can't execute USDC transfers until funded |
| 8 | Old stakeBond values (10^18) in existing agents | Supabase data | 8 agents show $100T bond on dashboard |
| 9 | Session wallets are predictable (agentId padded with zeros) | `api/index.ts` | Not cryptographically random |
| 10 | `api/index.ts` still has `console.log` (~39 instances) | `api/index.ts` | Unprofessional logging |

---

## WHAT'S BEEN FIXED ACROSS ALL 3 AUDITS

| # | Finding | Fixed In | Verified Live |
|---|---------|----------|---------------|
| 1 | Payment recipient empty string | `apps/api/` (v2) | Not live (apps/api/ not served) |
| 2 | Registry updateReputation/recordAction never persist | `apps/api/` (v2) | Not live |
| 3 | USDC decimals 10^18 → 10^6 | `AgentRegistry.sol` (v2) | Contract redeployed |
| 4 | Cleanup cron weak auth | `apps/api/` (v2) | Not live |
| 5 | Health endpoint info leakage | **`api/index.ts`** (v3) | **LIVE** — v0.5.1, minimal info |
| 6 | Dead domains (AgentScore, PayCrow) | **Both files** (v3) | **LIVE** — MoltGuard, Xorb Escrow |
| 7 | Landing page OG tags, mobile, security | **Landing** (v3) | **LIVE** |
| 8 | Dashboard onboarding, toasts, skeletons, logo, mobile | **Dashboard** (v3) | **LIVE** |
| 9 | 3 contracts deployed | **Polygon PoS** (v3) | **LIVE** — ActionVerifier, XorbEscrow, XorbPaymentSplitter |
| 10 | 21 Supabase tables created | **Supabase** (v3) | **LIVE** |
| 11 | OG image created and deployed | **Landing** (v3) | **LIVE** |

---

## ARCHITECTURAL DEBT: TWO CODEBASES

The root cause of most remaining issues is that **two versions of the API exist:**

| | `api/index.ts` (LIVE) | `apps/api/` (NOT LIVE) |
|---|---|---|
| Lines | 1,500 | 2,000+ across 20 files |
| Version | 0.5.1 | 0.5.0 |
| Architecture | Monolithic, single file | Modular Hono app |
| Auth | Works but `/v1/agents` is public | Proper sponsor filtering |
| Rate limiting | In-memory Map | Supabase-backed |
| Persistence | Mixed (some Supabase, some in-memory) | Full Supabase |
| Key creation | Missing | `POST /v1/auth/keys` exists |
| Payment settlement | Recipient may be wrong | Fixed (uses payerAddress) |
| Pricing | Hardcoded 3 endpoints, 1000 free tier | Dynamic 8 endpoints, 500 free tier |

**The fix for ALL remaining issues is to port them into `api/index.ts`** — add auth to agents, add key creation, fix pricing, strip integrations leaks. This is ~100 lines of changes to the live file.

---

## REMEDIATION PRIORITY

### Fix Now (4 changes to api/index.ts, ~30 minutes)
1. Add auth requirement to `GET /v1/agents` (filter by sponsor)
2. Add `POST /v1/auth/keys` endpoint for self-service key creation
3. Fix pricing: 500 free tier, 8 endpoints
4. Strip `smart_contracts.missing` and `rpc` from `/v1/integrations`

### Fix Today (Vercel env vars, 2 minutes)
5. Add `AGENT_REGISTRY_ADDRESS=0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7`
6. Add `SLASHING_ENGINE_ADDRESS=0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625`

### Fix This Week
7. Fund facilitator wallet (1 MATIC)
8. Clean up old agent data (10^18 stakeBond values)
9. Rotate exposed private keys

### Fix Eventually
10. Migrate `api/index.ts` to serve `apps/api/` modular architecture
11. Set up Sentry monitoring
12. Publish SDKs
13. Replace `console.log` with structured logger

---

## IMPRESSIVE (Verified in Production)

| # | What | Evidence |
|---|------|----------|
| 1 | Health endpoint secured | v0.5.1, 7 fields only, no leaks |
| 2 | 8/8 contracts deployed on Polygon PoS | All addresses verified |
| 3 | 21 Supabase tables | Full persistence infrastructure |
| 4 | Real MoltGuard integration (live trust scoring API) | `api.moltrust.ch/guard/` |
| 5 | Landing page fully updated | OG image, mobile, security, semantic HTML |
| 6 | Dashboard has real auth flow | Login → onboarding → agents |
| 7 | BigInt fee engine in codebase | `fees.ts` — zero floating point |
| 8 | Real SHA-256 audit hashing | `runner.ts` — verified in tests |
| 9 | Real ECDSA x402 verification | `ethers.verifyMessage` |
| 10 | Comprehensive documentation | 17 files: ToS, privacy, getting-started, errors, webhooks, etc. |

---

## FINAL VERDICT (v3)

**Score: 6.7/10** — down from 6.9 in v2 because v2 scored the codebase while v3 scores what's actually live.

**The platform looks professional from the outside** (landing page, health endpoint, dashboard login). But the live API has 4 gaps that would be found in under 5 minutes by any developer or investor:
1. `/v1/agents` returns everything without auth
2. No way to create an API key
3. Pricing is wrong (1000 vs 500, 3 vs 8 endpoints)
4. Integrations leaks internal config

**These are all fixable in `api/index.ts` in ~30 minutes.** After fixing them + adding the 2 missing Vercel env vars, the score reaches **7.5-8/10** — credible for first customers and investor conversations.

**Gap to deployment-ready: ~1 hour of code changes + 2 env vars.**
