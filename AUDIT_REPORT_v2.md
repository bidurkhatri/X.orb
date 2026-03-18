# X.orb Platform — Re-Audit Report (Post-Fix)

**Date:** 2026-03-19
**Auditor:** Claude Code (full re-audit of fixed codebase)
**Context:** Re-audit after fixing all CRITICAL and HIGH findings from the initial audit (2026-03-18)
**Tests:** 63/63 pass (48 agent-core + 15 API). Both TypeScript type checks pass.

---

## NEW CRITICAL FINDING: VERCEL SERVES WRONG API

**The single biggest issue in the entire codebase:**

The `vercel.json` rewrites route all `/v1/*` requests to `/api` — which resolves to `api/index.ts`, a **1533-line old monolithic file (v0.4.0)**. All fixes in this audit were applied to `apps/api/` (v0.5.0), which Vercel never serves.

**Evidence:** The production health endpoint at `api.xorb.xyz/v1/health` returns:
- Version `0.4.0` (should be `0.5.0`)
- Leaks `"agents": 10`, contract config, missing env vars, RPC URL, persistence status — all publicly
- No auth required for detailed infrastructure info

**Impact:** None of the CRITICAL/HIGH fixes are live in production. The old API has:
- In-memory everything (no Supabase persistence)
- No auth validation on health/deep
- Weak cron auth
- Empty string payment recipient
- No on-chain contract calls

**Fix:** Update `vercel.json` to point to `apps/api/` or replace `api/index.ts` with the modular Hono app.

---

## SCORECARD (Post-Fix)

| # | Perspective | Before | After | One-Line Verdict |
|---|-------------|--------|-------|-----------------|
| 1 | End User | 5/10 | **5/10** | No change — dashboard UX items (toasts, onboarding, mobile, export) not yet addressed |
| 2 | AI Agent Developer | 7/10 | **7.5/10** | Self-service key creation verified. Python SDK still missing 3 APIs. |
| 3 | AI Agent | 6/10 | **7/10** | Registry now persists rep/actions. On-chain registration wired. Rep/slash engines still in-memory. |
| 4 | CEO | 7/10 | **8/10** | Payment recipient fixed. USDC decimals fixed. Contracts wired. Claims now match code. |
| 5 | CTO | 7/10 | **8/10** | All CRITICAL bugs fixed. Rate limiting Supabase-backed. Auth hardened. Clean type checks. |
| 6 | COO | 5/10 | **6/10** | Cron auth fixed. Health endpoint secured. Still no Sentry. **Vercel serves wrong API.** |
| 7 | CFO | 6/10 | **7/10** | Payment settlement has real recipient. Fee engine verified. Maturity window still report-only. |
| 8 | CSO/CISO | 6/10 | **7.5/10** | Dev fallback guarded. CORS whitelisted. Cron secured. Rate limiting persistent. Health auth'd. |
| 9 | Product Manager | 5/10 | **5/10** | No UX changes yet — same dashboard gaps remain. |
| 10 | Investor | 6/10 | **7/10** | Major red flags eliminated. `charCodeAt`=0, `signature.length`=0, `new Map` in API=0. |
| | **OVERALL** | **6.0/10** | **6.9/10** | **Blocked by Vercel routing — fixes exist but aren't served in production** |

---

## FIXES VERIFIED (All CRITICAL/HIGH from initial audit)

| # | Finding | Status | Verification |
|---|---------|--------|-------------|
| #0 | Payment recipient empty string | **FIXED** | `pipeline.ts:162` now uses `paymentCtx.payerAddress` |
| #0b | Registry never persists rep/actions | **FIXED** | Both methods now async with `await this.store.upsertAgent()` |
| #3 | API never calls deployed contracts | **FIXED** | `agents.ts` calls `registerAgentOnChain()`, pipeline anchors by default |
| #4 | Contract USDC decimals (10^18 → 10^6) | **FIXED** | `AgentRegistry.sol:65` now `100 * 10**6` |
| #5 | No self-service API key creation | **ALREADY EXISTS** | `POST /v1/auth/keys` with SHA-256, Zod validation, rotation |
| #6 | In-memory burst rate limiting | **FIXED** | `rate-limit.ts` now Supabase-backed, in-memory dev-only fallback |
| #7 | Facilitator wallet SPOF | **DOCUMENTED** | Risk acknowledged, multisig migration planned |
| Cron | Cleanup cron weak auth | **FIXED** | Now requires CRON_SECRET, returns 500 if missing |
| Health | /deep leaks info without auth | **FIXED** | Validates API key against Supabase before returning details |

---

## REMAINING ISSUES (Ordered by Severity)

### CRITICAL (Blocks Production)

| # | Finding | File | Impact |
|---|---------|------|--------|
| **NEW** | Vercel serves old `api/index.ts` (v0.4.0), not fixed `apps/api/` (v0.5.0) | `vercel.json`, `api/index.ts` | **None of the fixes are live** |

### HIGH (Blocks First Customer)

| # | Finding | File | Impact |
|---|---------|------|--------|
| 1 | ReputationEngine is in-memory only — scores lost on cold start | `packages/agent-core/src/reputation.ts` | Reputation gates broken on serverless |
| 2 | SlashingService is in-memory only — violations lost on cold start | `packages/agent-core/src/slashing.ts` | Slashing/escalation system broken |
| 3 | OnboardingWizard is dead code — never imported/rendered | `apps/dashboard/src/components/OnboardingWizard.tsx` | No guided first-time experience |
| 4 | Python SDK missing 3 APIs (Compliance, Events, Payments) | `packages/xorb-sdk-py/xorb/client.py` | SDK parity gap |

### MEDIUM (Blocks Investment)

| # | Finding | File | Impact |
|---|---------|------|--------|
| 5 | No toast notifications anywhere in dashboard | Dashboard-wide | No success feedback |
| 6 | Sidebar fixed 220px — breaks on mobile | `Sidebar.tsx` | ~50% of traffic broken |
| 7 | Notification preferences React state only | `Settings.tsx:11-14` | Settings lost on refresh |
| 8 | Service statuses hardcoded as "available" | `Overview.tsx:86-100` | Misleading if services are down |
| 9 | Billing hardcodes $0.005/action | `Billing.tsx:22` | Wrong for tiered users |
| 10 | Landing page missing og:image | `apps/landing/index.html` | No social preview image |
| 11 | Landing page target="_blank" without rel="noopener" | `apps/landing/index.html` (7 links) | Reverse tabnabbing risk |
| 12 | Skeleton/ButtonSpinner components unused | `Skeleton.tsx` | Dead code, no loading spinners |
| 13 | 3 contracts not deployed (ActionVerifier, XorbEscrow, XorbPaymentSplitter) | `xorb-contracts/` | On-chain features incomplete |
| 14 | `console.log/warn/error` in production API (39 instances) | Various `apps/api/src/` files | Unprofessional logging |

### LOW (Polish)

| # | Finding | File |
|---|---------|------|
| 15 | Landing page only 1 media query | `apps/landing/index.html:76` |
| 16 | No semantic HTML on landing page | `apps/landing/index.html` |
| 17 | Landing code example missing auth header | `apps/landing/index.html:156` |
| 18 | "PDF export" returns plain text | `routes/audit.ts` |
| 19 | `as any` casts (6 in API) | Various |
| 20 | Webhook SSRF/HMAC not unit tested | `webhooks.ts` |

---

## WHAT'S IMPRESSIVE (Verified Post-Fix)

| # | Finding | Why It's Good |
|---|---------|---------------|
| 1 | **Fee engine** (`fees.ts`) | Pure BigInt, 11 tests, min/max/safety caps, free tier, volume discount. CFO-grade. |
| 2 | **SHA-256 audit hashing** (`runner.ts:70-86`) | Real crypto, deterministic JSON, tested for length/determinism/collision. |
| 3 | **ECDSA x402 verification** (`x402.ts:95-110`) | Real `ethers.verifyMessage`, nonce replay protection, expiry checks. |
| 4 | **SSRF protection** (`webhooks.ts:7-55`) | Blocks loopback, RFC 1918, link-local, IPv6 private, metadata. Production-grade. |
| 5 | **Registry persistence fix** (`registry.ts:175-195`) | Both methods now async with await, properly tested, backward compatible. |
| 6 | **Auth with ownership binding** (`auth.ts`) | SHA-256 key hashing, agent-to-sponsor verification, production NODE_ENV guard. |
| 7 | **On-chain contract wiring** (`agents.ts`, `pipeline.ts`) | Registration and anchoring now call real contracts (non-blocking, graceful fallback). |
| 8 | **Cron security hardening** (`cron.ts`) | All 5 endpoints now require CRON_SECRET, fail with 500 if missing. |
| 9 | **Health endpoint secured** (`health.ts`) | Deep check validates API key against Supabase before returning infra status. |
| 10 | **Compliance reports** (`compliance.ts`) | Real analysis across 3 frameworks (EU AI Act, NIST, SOC 2), evidence from actual data. |
| 11 | **Documentation suite** (`docs/`) | 18 files: getting-started, errors, webhooks, rate-limits, payment-flow, pricing, env-vars, ToS, privacy, AUP, incident response, backup. |
| 12 | **Smart contract security** (`xorb-contracts/`) | OpenZeppelin throughout, ReentrancyGuard, SafeERC20, Pausable, AccessControl, daily limits, treasury timelock. |

---

## REMEDIATION PRIORITY (Updated)

### Fix Today
1. **Fix Vercel routing** — Point `vercel.json` to `apps/api/` so the fixed code is actually served
2. **Add DataStore persistence for ReputationEngine and SlashingService** — Same pattern as registry fix

### Fix This Week
3. Wire OnboardingWizard into App.tsx
4. Add toast notifications (install sonner)
5. Fix mobile sidebar (hamburger/drawer)
6. Add Python SDK missing APIs (Compliance, Events, Payments)
7. Use existing Skeleton/ButtonSpinner components

### Fix This Month
8. Deploy remaining 3 contracts
9. Add Sentry integration
10. Fix landing page (og:image, rel="noopener", responsive)
11. Persist notification preferences to Supabase
12. Fix billing fee calculation
13. Replace console.log with structured logger

---

## FINAL VERDICT

**The codebase has improved from 6.0/10 to 6.9/10.** All CRITICAL and HIGH security/correctness bugs from the initial audit are fixed in `apps/api/`. The fee engine, cryptography, auth, and contract integration are now solid.

**However, the fixes are not live in production** because Vercel serves the old `api/index.ts` instead of the fixed `apps/api/`. This is the #1 blocker — a 5-minute fix that would immediately bring the production score from ~5/10 to ~7/10.

**After fixing Vercel routing + adding Reputation/Slashing persistence (1-2 days of work), the platform is at 7.5/10** — credible for first customers and early investor conversations. The remaining items (dashboard UX, SDK parity, landing page) are polish that can be done in parallel with customer acquisition.

**Gap to investor-ready: ~1 week** (Vercel fix + persistence + dashboard UX).
**Gap to first paying customer: ~2-3 days** (Vercel fix + persistence).
