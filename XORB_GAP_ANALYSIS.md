# X.orb — Complete Platform Gap Analysis & Audit Report

**Date**: March 17, 2026
**Auditor**: Senior QA / CTO Review
**Scope**: Entire X.orb platform — API, Dashboard, SDKs, MCP, Contracts, Database, Docs

---

## Executive Summary

The X.orb platform has solid architecture and a working live API, but **cannot survive a serious demo, investor pitch, or production deployment** in its current state. The audit found **68 total issues** across 4 severity levels. The most critical: authentication is essentially absent, payment validation is fake, smart contracts are never called, and data disappears on cold start.

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 8 | Blocks production. Security vulnerabilities or core features that don't work. |
| **HIGH** | 15 | Breaks user experience or misrepresents capabilities. |
| **MEDIUM** | 22 | Inconsistencies, missing validation, incomplete features. |
| **LOW** | 23 | Code quality, docs mismatch, cosmetic issues. |

---

## CRITICAL Issues (Must Fix Before Any Demo)

### C1. No Real Authentication
**Files**: `api/index.ts` (all mutation endpoints)
**Problem**: Agent mutations (PATCH, DELETE) only check `caller_address` string match — no cryptographic proof. Anyone who knows a sponsor's wallet address can pause/revoke/delete their agents.
**Impact**: Complete security bypass. Any competitor or bad actor can destroy all agents.
**Fix**: Require EIP-191 message signature OR API key authentication (SHA-256 hashed, stored in Supabase `api_keys` table).

### C2. x402 Payment Gate is a No-Op
**Files**: `api/index.ts` lines 364-386
**Problem**: Gate 4 (x402_payment) always returns `passed: true`. Payment header is decoded but signature is never validated cryptographically. Any client can craft a fake payment.
**Impact**: The entire monetization model doesn't work. Zero revenue possible.
**Fix**: Integrate `@x402/hono` middleware for real ECDSA signature verification, or use `@x402/server` SDK.

### C3. Smart Contracts Never Called From API
**Files**: `api/index.ts`, all contract `.sol` files
**Problem**: The API runs everything in-memory. No ethers.js imports, no contract ABIs, no on-chain transactions. Specifically:
- `ActionVerifier.sol:anchorAction()` — never called
- `XorbEscrow.sol:deposit()` — never called
- `AgentMarketplace.sol:listAgent()` — never called
- `SlashingEngine.sol:executeSlash()` — never called
**Impact**: Platform claims "on-chain escrow, slashing, action verification" but none of it happens.
**Fix**: Wire ethers.js to deployed contracts. Start with ActionVerifier (audit hash anchoring) as the minimum viable on-chain integration.

### C4. Data Disappears on Vercel Cold Start
**Files**: `api/index.ts` lines 175-190
**Problem**: `globalThis._xorb` resets on every cold start. Supabase is configured but `SUPABASE_SERVICE_KEY` is not set in Vercel env vars, so persistence never activates. Demo agents are re-seeded every time.
**Impact**: Any agent registered by a real user vanishes within minutes.
**Fix**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Vercel environment variables. Verify with `/v1/health` showing `"persistence": "supabase"`.

### C5. Audit Hash is Fake
**Files**: `api/index.ts` line 423
**Problem**: `audit_hash` is just `0x${Date.now().toString(16).padStart(64, '0')}` — a padded timestamp, not a cryptographic hash. Cannot verify action authenticity or detect tampering.
**Impact**: "Audit trail" claim is false. No tamper detection.
**Fix**: Use `SHA-256(action_id + agent_id + tool + timestamp + JSON.stringify(gates))` to generate real audit hash.

### C6. MCP Server Sends Wrong Field Name
**Files**: `packages/xorb-mcp/src/index.ts` line 80
**Problem**: MCP sends `scope: role` but API expects `role` field. Agent registration via MCP will return 400 error every time.
**Impact**: MCP server is completely broken for agent registration.
**Fix**: Change `scope: role` to `role` in the MCP request body.

### C7. Marketplace Endpoints Have Zero Auth
**Files**: `api/index.ts` lines 591-642
**Problem**: Anyone can:
- List any agent for hire (no ownership check)
- Hire any agent on behalf of anyone
- Complete/dispute/rate any engagement
**Impact**: Marketplace is an open playground for abuse.
**Fix**: Require `caller_address` + signature verification on all marketplace mutations.

### C8. Webhook Endpoints Have Zero Auth
**Files**: `api/index.ts` lines 530-556
**Problem**: Anyone can create webhooks (receive all events), delete anyone's webhooks, no URL validation (can register localhost/internal IPs).
**Impact**: Data exfiltration, webhook hijacking, SSRF vulnerability.
**Fix**: Require API key auth. Validate webhook URLs (block private IP ranges). Only allow deletion by creator.

---

## HIGH Issues (Fix Before Public Launch)

### H1. Dashboard DELETE Agent Broken
**Files**: `apps/dashboard/src/pages/AgentDetail.tsx` line 28-38
**Problem**: Revoke sends `caller_address` in request body, but API may expect it differently depending on routing.
**Fix**: Verify PATCH/DELETE body parsing works end-to-end.

### H2. Dashboard Audit Page Non-Functional
**Files**: `apps/dashboard/src/pages/Audit.tsx` lines 30-32
**Problem**: "Generate" button has no onClick handler. No call to `api.compliance.report()`. Page is a dead UI.
**Fix**: Wire the button to the compliance API endpoint.

### H3. Dashboard Billing Page is Static
**Files**: `apps/dashboard/src/pages/Billing.tsx`
**Problem**: Hardcoded "0 / 1,000" and "$0.00". Never calls any API.
**Fix**: Fetch real usage data from a new `/v1/usage` endpoint.

### H4. Dashboard Marketplace Page Empty
**Files**: `apps/dashboard/src/pages/Marketplace.tsx`
**Problem**: Defines API call but never fetches data. Always shows empty state.
**Fix**: Wire useQuery to fetch listings on mount.

### H5. SlashingEngine Two-Step Process Never Completes
**Files**: `xorb-contracts/contracts/SlashingEngine.sol` lines 207-238
**Problem**: `reportViolation()` creates records but `executeSlash()` is never auto-called. Violations go unpunished.
**Fix**: Auto-execute on report, or add timeout enforcement.

### H6. Route Ordering Bug — `/trust/leaderboard` vs `/trust/:id`
**Files**: `api/index.ts` lines 429-447
**Problem**: `/trust/:id` handler matches before `/trust/leaderboard` handler. Leaderboard request returns 404.
**Fix**: Move leaderboard route check before generic `:id` check, or add negative lookahead.

### H7. Duplicate Trust/Reputation Endpoints
**Files**: `api/index.ts` lines 428-469
**Problem**: Both `/trust/:id` and `/reputation/:id` exist and return slightly different response shapes. SDKs and dashboard use different ones.
**Fix**: Deprecate one. Standardize on `/v1/reputation/:id`.

### H8. Events Stream is Not Streaming
**Files**: `api/index.ts` lines 484-487
**Problem**: `/events/stream` returns static array, not actual long-polling or SSE. No retry-after header, no backpressure.
**Fix**: Implement proper long-polling (hold connection for 25s, return when new events arrive).

### H9. Batch Actions Silently Truncates
**Files**: `api/index.ts` line 516
**Problem**: Accepts any array size but silently processes only first 100. No error or warning.
**Fix**: Return 400 if `batchActions.length > 100`.

### H10. AgentScore Lookup on Every Action Adds Latency
**Files**: `api/index.ts` lines 395-402
**Problem**: Calls external `lookupAgentScore()` (3s timeout) on every single action execution.
**Fix**: Cache trust score for 5 minutes. Only refresh on explicit trust check.

### H11. No Rate Limiting on Public GET Endpoints
**Files**: `api/index.ts` — all GET routes
**Problem**: `/agents`, `/events`, `/trust/leaderboard` have no rate limiting. Competitor can scrape everything.
**Fix**: Add IP-based rate limiting (100 req/min) or require API key.

### H12. Database Migration Assumes Tables Exist
**Files**: `xorb-db/migrations/002_xorb_schema.sql`
**Problem**: Only adds columns to `agent_registry` and `agent_actions` tables. Never creates them. Depends on migration 001 which may not have run.
**Fix**: Verify 001 migration exists and has been applied, or add `CREATE TABLE IF NOT EXISTS`.

### H13. Vercel Routing May Strip Path Info
**Files**: `vercel.json`
**Problem**: Rewrites `"/v1/(.*)"` to `"/api"` — the captured path group may not be passed to the handler correctly depending on Vercel's behavior.
**Fix**: Test and verify `req.url` contains full path after rewrite.

### H14. No Sponsor Address Validation
**Files**: `api/index.ts` line 259
**Problem**: Accepts any string as `sponsor_address`. No Ethereum address format check.
**Fix**: Validate with `/^0x[a-fA-F0-9]{40}$/`.

### H15. Supabase Errors Silently Swallowed
**Files**: `api/index.ts` lines 69, 80
**Problem**: All `catch` blocks just `console.error`. If Supabase is down, API continues in broken state — some writes persist, some don't.
**Fix**: Return 503 when Supabase persistence is expected but fails.

---

## MEDIUM Issues

### M1. ERC-8004 "Identity Check" is Just a Balance Query
Calls `eth_call` with `balanceOf` selector — checks if address holds tokens, not identity registration.

### M2. AgentScore API Returns Fallback 50 for Everything
API is unreachable or doesn't exist at the expected endpoints. Every agent gets score 50.

### M3. PayCrow API Returns Fallback 50 for Everything
Same as M2. External API unreachable.

### M4. Compliance Reports are Hardcoded Logic
Score = `slashEvents > 5 ? 50 : 100`. No real audit trail analysis.

### M5. No Agent Renew Endpoint
`apps/api/src/routes/agents.ts` has `case 'renew': throw new Error('Not implemented')`.

### M6. No GET /v1/actions/:id
Returns 501 Not Implemented. Documented in OpenAPI but never built.

### M7. Rate Limit Window Not Wall-Clock Aligned
Resets 1 hour from first action, not on the hour. Inconsistent behavior.

### M8. CORS Wide Open (`*`)
Acceptable for dev/demo but must be restricted before production.

### M9. Webhook URL Not Validated
Can register `http://localhost`, `http://127.0.0.1`, internal IPs. SSRF risk.

### M10. Marketplace Listing Rates Not Validated
Can set negative, zero, or absurd rates.

### M11. No Duplicate Prevention on Ratings
Same user can rate an engagement multiple times.

### M12. Events/Actions Arrays Not Persisted to Supabase
In-memory only, capped at 10K. Lost on cold start.

### M13. OpenAPI Spec Claims SSE but Implementation is Long-Poll
Documentation mismatch.

### M14. Python SDK `list()` Discards Count
Returns `list[Agent]` instead of `(list[Agent], int)` like TS SDK.

### M15. Dashboard Field Name Fallbacks
Uses `a.trustScore ?? a.reputation` — works but fragile.

### M16. Dashboard TypeScript JSX Configuration
Missing `jsx` compiler option may cause build issues.

### M17. README Claims Integrations That Return Fallbacks
Says "AgentScore integrated" but every call returns default 50.

### M18. ReputationScore.sol Interface Duplication
`IReputationFeedback` defined inline instead of imported from interface file.

### M19. Reputation Auto-Pause Threshold Misaligned
AgentRegistry auto-pauses at 500 but ReputationScore tiers start NOVICE at 1000.

### M20. Docs Endpoint Depends on GitHub
Swagger UI loads spec from `raw.githubusercontent.com`. Breaks if GitHub is down.

### M21. Missing Webhook HMAC Signature Verification
Webhook payloads should be signed with subscription secret. Not implemented.

### M22. Unused Contract Verification Script
`xorb-contracts/scripts/verify-and-publish.ts` references non-existent contracts.

---

## LOW Issues

### L1-L5: Code Quality
- Heavy use of `any` types in dashboard
- Actions.tsx defines its own `ActionEvent` type instead of using shared types
- Agent ID regex overly specific (`/agent_/`)
- Demo agent wallet addresses are well-known test addresses
- No error boundaries in React components

### L6-L10: Documentation
- OpenAPI enum values unquoted
- CLAUDE.md constructor signatures may be outdated
- No deployment documentation for contracts
- No env var documentation
- No architecture diagram

### L11-L15: Missing Endpoints (Nice-to-Have)
- `PUT /v1/webhooks/:id` (update webhook)
- `GET /v1/agents/:id/slashing-history`
- `POST /v1/reputation/appeal`
- `GET /v1/marketplace/:id/history`
- `PATCH /v1/actions/:id` (cancel action)

### L16-L20: Polish
- No exponential backoff recommendation for event polling
- No `retry-after` header on rate limit responses
- No pagination on list endpoints
- No search/filter on agent list
- No sorting options on leaderboard

### L21-L23: DevOps
- No monitoring/alerting setup
- No error tracking (Sentry, etc.)
- No CI/CD pipeline for automated testing

---

## Priority Fix Order

### Sprint 1: Security & Persistence (Days 1-3)
1. **C4**: Set Supabase env vars in Vercel → persistent storage
2. **C1**: Add API key authentication to all mutation endpoints
3. **C7**: Add auth to marketplace endpoints
4. **C8**: Add auth + URL validation to webhook endpoints
5. **C5**: Generate real SHA-256 audit hashes
6. **H14**: Validate sponsor address format

### Sprint 2: Core Pipeline Integrity (Days 4-6)
7. **C2**: Wire real x402 payment verification
8. **C6**: Fix MCP `scope: role` → `role`
9. **H6**: Fix route ordering bug
10. **H7**: Consolidate trust/reputation endpoints
11. **H10**: Cache AgentScore lookups (5-min TTL)
12. **H9**: Return 400 on oversized batch

### Sprint 3: Dashboard Functional (Days 7-9)
13. **H2**: Wire Audit page Generate button
14. **H3**: Wire Billing page to usage API
15. **H4**: Wire Marketplace page data fetching
16. **H1**: Verify DELETE agent works end-to-end
17. **M12**: Persist events/actions to Supabase

### Sprint 4: On-Chain Integration (Days 10-14)
18. **C3**: Wire API to deployed contracts (start with ActionVerifier)
19. **H5**: Fix SlashingEngine auto-execution
20. **H12**: Verify database migrations

### Sprint 5: Polish & Launch Prep (Days 15-20)
21. Fix all remaining MEDIUM issues
22. Update README to match reality
23. Add monitoring (Sentry + Vercel Analytics)
24. End-to-end test every endpoint
25. Record demo video

---

## Verification Checklist

After all fixes, every item below must pass:

```
[ ] curl POST /v1/agents with valid API key → 201 + agent persists across cold starts
[ ] curl POST /v1/agents without API key → 401
[ ] curl POST /v1/actions/execute → all 8 gates return real data
[ ] curl POST /v1/actions/execute with x402 payment → payment validated
[ ] curl GET /v1/health → shows persistence: supabase
[ ] curl GET /v1/reputation/agent_alpha → real AgentScore data (not fallback 50)
[ ] Dashboard: Register agent → appears in list → survives page refresh
[ ] Dashboard: Click Generate on Audit page → compliance report renders
[ ] Dashboard: Billing shows real usage numbers
[ ] Dashboard: Marketplace shows listings
[ ] MCP: register_agent tool → creates agent successfully
[ ] SDK (TS): xorb.agents.register() → works
[ ] SDK (Py): client.agents.register() → works
[ ] Contract: ActionVerifier.anchorAction() called after pipeline passes
[ ] Webhook: POST creates subscription → events delivered to URL
```

---

## Bottom Line

**The platform is 60% built.** The architecture is sound, the code structure is clean, and the core 8-gate pipeline concept is genuinely valuable. But the 40% that's missing is the 40% that makes it a real product: authentication, payment verification, data persistence, and on-chain integration.

The good news: all fixes are surgical. No architectural redesign needed. Sprint 1 (security + persistence) transforms this from a demo into a usable API in 3 days.
