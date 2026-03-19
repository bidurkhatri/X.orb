# X.orb — Final Audit Report (v4)

**Date:** 2026-03-19
**Auditor:** Claude Code — 3 parallel agents, 13 perspectives, every source file read
**Scope:** Live API endpoints, dashboard, landing page, smart contracts, database, SDKs

---

## SCORECARD

| # | Perspective | Score | Verdict |
|---|-------------|-------|---------|
| 1 | CEO | 6/10 | Free tier gives away compute, no revenue tracking |
| 2 | CTO | 8/10 | Solid architecture, but monolithic api/index.ts and demo agent pollution |
| 3 | CSO/CISO | 7/10 | Real crypto, but sponsor ownership not verified, API key in sessionStorage |
| 4 | CPO | 6/10 | OnboardingWizard hardcodes zero address, marketplace non-functional |
| 5 | PM | 7/10 | Dashboard complete, but notifications API missing, no real-time events |
| 6 | COO | 7/10 | Runs on Vercel, but no structured logging, rate limits reset on cold start |
| 7 | CMO | 8/10 | Landing page professional, but no pricing page or use cases |
| 8 | AI Agent | 8/10 | Can register + execute + build reputation, but can't self-manage |
| 9 | End User | 5/10 | Can create key + login, but onboarding creates unusable agent |
| 10 | Investor | 5/10 | Real contracts deployed, but no revenue collected, demo agents pollute |
| 11 | Security Researcher | 7/10 | Sponsor address trusted from client, x402 ecrecover not implemented |
| 12 | Full Stack Developer | 8/10 | Clean code, BigInt fee engine, but 1500-line monolith |
| 13 | Designer | 7/10 | Glassmorphism consistent, but mobile tables break |
| | **OVERALL** | **6.8/10** | **75% of a production system — architecture solid, critical features incomplete** |

---

## CRITICAL FINDINGS (Must Fix Before Launch)

### 1. OnboardingWizard Hardcodes Zero Address
**File:** `apps/dashboard/src/components/OnboardingWizard.tsx:26`
**Bug:** Creates agent with `sponsor_address: '0x0000000000000000000000000000000000000000'`
**Impact:** User completes onboarding but the agent is unusable — they don't own it
**Fix:** Collect sponsor address from user before creating agent

### 2. Sponsor Ownership Not Cryptographically Verified
**File:** `api/index.ts:1227-1229`
**Bug:** PATCH/DELETE take `caller_address` from request body. API trusts client to identify themselves.
**Impact:** Anyone who knows a sponsor address can pause/revoke agents they don't own
**Fix:** Use the wallet address from `validateApiKey()` (already resolved from the API key), not from request body

### 3. x402 Payment Signature Not Fully Verified
**File:** `api/index.ts:101-102`
**Bug:** Comment says "Full ecrecover requires ethers; this validates structural correctness." Payer address is never recovered from signature.
**Impact:** Attacker can craft valid-looking signature for any payer address. x402 is security theater.
**Fix:** Implement `ethers.verifyMessage()` like `apps/api/src/middleware/x402.ts` does

### 4. Demo Agents Pollute Production
**File:** `api/index.ts:685-705`
**Bug:** `seedDemoAgents()` creates 5 fake agents on every cold start if Supabase returns empty
**Impact:** New users see agents they didn't create, can't delete them, leaderboard shows fakes
**Fix:** Only seed in dev mode: `if (process.env.NODE_ENV !== 'production')`

### 5. Chain Mismatch in API Response
**File:** `api/index.ts` integrations endpoint
**Bug:** Reports contracts on `chain: "base"` but contracts are deployed on Polygon PoS (chain ID 137)
**Impact:** Developers send transactions to wrong chain, losing funds
**Fix:** Change `chain: 'base'` to `chain: 'polygon'` and update RPC references

### 6. Agent ID Generation is Weak
**File:** `api/index.ts:1200`
**Bug:** Uses `Date.now().toString(36) + Math.random()` instead of UUID
**Impact:** Possible collisions under high concurrency. Inconsistent with agent-core which uses `uuidv4()`
**Fix:** Use `crypto.randomUUID()` or import UUID

---

## HIGH FINDINGS (Fix Before First Customer)

### 7. API Key Stored in SessionStorage
**File:** `apps/dashboard/src/lib/api.ts:5`
**Impact:** Vulnerable to XSS. Any script on the page can read the key.
**Alternative:** httpOnly cookies (requires server-side changes)

### 8. Free Tier Counter Not Atomic
**File:** `api/index.ts:1385-1389`
**Impact:** Race condition allows exceeding free tier by 10-100 actions under concurrency

### 9. Webhook Delivery Never Fires
**File:** `api/index.ts:1474-1486`
**Impact:** Users create webhooks but events are never POSTed to their URLs

### 10. Notifications API Missing
**File:** `apps/dashboard/src/pages/Settings.tsx:64`
**Impact:** Dashboard saves notification preferences to an API endpoint that doesn't exist

### 11. Marketplace Non-Functional
**File:** `api/index.ts:1520-1525`
**Impact:** Hire endpoint exists but does nothing. No escrow mechanics wired.

### 12. No Structured Logging
**File:** `api/index.ts` (throughout)
**Impact:** Errors go to console.error, lost on Vercel cold starts. No log aggregation.

---

## MEDIUM FINDINGS

| # | Finding | File | Impact |
|---|---------|------|--------|
| 13 | Compliance report uses hardcoded pass/fail logic | `api/index.ts:1166-1183` | "EU AI Act compliance" claim not backed by real assessment |
| 14 | No `/v1/settings/notifications` handler in API | `api/index.ts` | Dashboard saves prefs that never persist |
| 15 | CORS is `*` (intentional for public API but risky for dashboard) | `api/index.ts:713` | Credential cookies would be exposed |
| 16 | `integrations` endpoint leaks `signer: false` and RPC URL | `api/index.ts` | Minor info disclosure |
| 17 | No pricing page on landing site | `apps/landing/index.html` | Users can't assess cost |
| 18 | Payment nonces grow unbounded | Database | No TTL or cleanup job |
| 19 | Sponsor daily caps only enforced in PaymentSplitter, not Escrow | Contracts | Bypass via multi-contract payments |
| 20 | SlashingEngine config changes not time-locked | Contracts | Admin can change penalties instantly |

---

## WHAT'S WORKING (Verified Live)

| Check | Status | Evidence |
|---|---|---|
| Health endpoint secured | **PASS** | v0.5.1, 7 fields, no leaks |
| Auth on `/v1/agents` | **PASS** | Returns 401 without key |
| Self-service key creation | **PASS** | `POST /v1/auth/keys` works |
| Pricing correct | **PASS** | 500 free tier, 8 endpoints |
| Landing page updated | **PASS** | MoltGuard, Xorb Escrow, OG image, mobile, security |
| Dashboard login flow | **PASS** | Key creation → sign in → overview |
| 8-gate pipeline | **PASS** | All 8 gates pass, SHA-256 audit hash |
| 8/8 contracts deployed | **PASS** | All on Polygon PoS |
| 21 Supabase tables | **PASS** | All migrations run |
| Toast notifications | **PASS** | On all mutations |
| Skeleton loading states | **PASS** | On all pages |
| Mobile sidebar | **PASS** | Hamburger menu |
| CSV export | **PASS** | On Agents page |
| Reputation tracking | **PASS** | Score, tier, action count |
| Free tier enforcement | **PASS** | 402 after 500 actions |

---

## WHAT NEEDS TO SHIP BEFORE PRODUCTION

### Fix Today (~2 hours code)
1. Fix OnboardingWizard to collect sponsor address from user
2. Use API key's wallet as sponsor (not request body) for PATCH/DELETE
3. Guard demo agent seeding with `NODE_ENV !== 'production'`
4. Fix chain mismatch: `base` → `polygon` in integrations response
5. Use `crypto.randomUUID()` for agent IDs instead of `Date.now() + Math.random()`
6. Implement ecrecover in x402 payment validation (copy from `apps/api/src/middleware/x402.ts`)

### Fix This Week
7. Add `/v1/settings/notifications` handler
8. Implement webhook delivery (POST to subscribed URLs on events)
9. Add structured logging (replace console.log/error)
10. Wire marketplace escrow to XorbEscrow contract
11. Add nonce cleanup cron job

### Fix Before Investor Demo
12. Remove demo agents from production
13. Add revenue tracking dashboard
14. Add pricing page to landing site
15. Verify all 8 contracts on Polygonscan
16. Get third-party security audit quote

---

## FINAL VERDICT

**6.8/10 — 75% of a production system.**

The architecture is genuinely good: real SHA-256 hashing, real ECDSA validation, BigInt fee engine, 8-gate pipeline, 8 deployed contracts, comprehensive database schema. The landing page and dashboard look professional.

But the **live API (`api/index.ts`) has critical gaps** that would be found in 5 minutes by any developer:
- Sponsor ownership is trusted from the client (no signature verification)
- x402 payment signatures are structurally validated but never cryptographically verified
- Demo agents pollute production data
- Chain is reported as "base" but contracts are on Polygon

**These are all fixable in the monolithic `api/index.ts` in one focused session.** After fixing the 6 critical items, the score reaches **8/10** — credible for first customers, investor demos, and SDK publishing.

**The modular `apps/api/` codebase already has most of these fixes** (real ECDSA via ethers, proper sponsor filtering, UUID agent IDs). The long-term path is migrating Vercel to serve `apps/api/` instead of the monolith.
