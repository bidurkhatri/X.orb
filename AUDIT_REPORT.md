# X.orb Platform — Comprehensive Code Audit Report

**Date:** 2026-03-18
**Auditor:** Automated deep analysis
**Scope:** Full codebase — API, agent-core, smart contracts, SDKs, MCP, dashboard, database, CI/CD
**Codebase Version:** v0.4.0

---

## Executive Summary

X.orb is a well-architected AI agent trust infrastructure with a clean 8-gate pipeline concept, composable domain logic, and 7 Solidity contracts. The codebase demonstrates strong architectural thinking — particularly the separation of pure domain logic (`agent-core`) from infrastructure (`apps/api`), the injectable DataStore adapter pattern, and the composable gate factory design.

**However, the audit reveals 57 findings across 5 severity levels that must be addressed before production deployment.** The most critical issues are: a non-cryptographic audit hash masquerading as SHA-256, missing ECDSA signature verification in x402 payment validation, in-memory rate limiting that breaks under horizontal scaling, marketplace data stored only in-memory, missing agent ownership checks on most API routes, and 2 of 8 pipeline gates being stub implementations.

### Severity Summary

| Severity | Count | Examples |
|----------|-------|---------|
| **CRITICAL** | 10 | Audit hash not cryptographic, x402 signature not verified, rate limits in-memory only, marketplace not persisted, no ownership checks |
| **HIGH** | 16 | Gates 5-6 are stubs, no input validation, free tier tracking broken, SSRF in webhooks, caller identity spoofable |
| **MEDIUM** | 18 | 23 hardcoded config values, compliance module is template-only, decay logic questionable, fuzzy error matching |
| **LOW** | 8 | Missing test coverage, no OpenAPI version sync, minor type safety gaps |
| **INFO** | 5 | Architecture observations, optimization opportunities |

### Overall Scores by Component

| Component | Score | Production Ready? |
|-----------|-------|-------------------|
| agent-core (pipeline) | 7.5/10 | No — audit hash, rate limits |
| agent-core (reputation) | 8/10 | Mostly — needs config externalization |
| agent-core (slashing) | 7.5/10 | No — hardcoded severities, no recovery |
| agent-core (events) | 8/10 | Yes for non-critical paths |
| agent-core (compliance) | 4/10 | No — generates fiction, not fact |
| apps/api (server) | 6/10 | No — auth bypass, x402 broken, no tests |
| apps/api (middleware) | 5.5/10 | No — multiple critical security gaps |
| Smart contracts | 8/10 | Close — minor bugs, needs formal audit |
| TypeScript SDK | 7/10 | Mostly — missing retry logic |
| Python SDK | 6.5/10 | No — no async, type gaps |
| MCP Server | 6/10 | Partial — incomplete tool set |
| Dashboard | 5/10 | No — incomplete pages, no real-time |
| Database schema | 7.5/10 | Mostly — needs cascade, RLS fixes |
| CI/CD | 3/10 | No — broken paths, skipped tests |
| **OVERALL** | **6.5/10** | **Not production-ready** |

---

## 1. CRITICAL FINDINGS

### C-01: Audit Hash Is Not Cryptographic

**File:** `packages/agent-core/src/pipeline/runner.ts:38-54`
**Severity:** CRITICAL
**Impact:** The entire audit trail and compliance reporting is built on a non-collision-resistant hash

```typescript
function generateAuditHash(ctx: PipelineContext): string {
  // Simple hash for now - in production use crypto.subtle.digest
  const data = JSON.stringify({ ... })
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const chr = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0 // Convert to 32-bit integer
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`
}
```

**Problem:** This is a simple 32-bit DJB2-style hash producing at most 2^32 unique values (~4 billion). It is padded with zeros to look like a 256-bit hash (`0x` + 64 hex chars). Collisions are trivially manufactured. The compliance module (`compliance.ts`) references these hashes as evidence of immutable audit trails.

**Fix:** Replace with `crypto.subtle.digest('SHA-256', ...)` or `createHash('sha256')` from `node:crypto`. The comment acknowledges this but it was never implemented.

---

### C-02: x402 Payment Signature Not Verified

**File:** `apps/api/src/middleware/x402.ts:119-123`
**Severity:** CRITICAL
**Impact:** Anyone can forge payment headers and bypass payment gates

```typescript
// Validate signature using ECDSA recovery
// The signature should be over: keccak256(abi.encode(amount, recipient, nonce, expiry))
if (payment.signature.length < 130) {
  return { valid: false, reason: 'Invalid signature length' }
}
```

**Problem:** The "validation" only checks that the signature string is ≥130 characters. No ECDSA recovery, no keccak256 verification, no signer address extraction. Any 130+ character string passes as a valid payment signature.

**Fix:** Implement proper ECDSA signature recovery using `ethers.verifyMessage()` or `viem/recoverMessageAddress`. Verify the recovered signer has sufficient USDC balance.

---

### C-03: Rate Limiting Is In-Memory Only

**File:** `packages/agent-core/src/pipeline/gates.ts:39-69`
**Severity:** CRITICAL
**Impact:** Rate limits reset on every Vercel cold start; horizontal scaling multiplies allowed rate by instance count

```typescript
export function createGateRateLimit() {
  const counters = new Map<string, { count: number; resetAt: number }>()
  return async (ctx: PipelineContext): Promise<GateResult> => {
    // counters live only in this process's memory
  }
}
```

**Problem:** On Vercel Serverless, each function invocation may run in a new process. The `counters` Map is empty on every cold start. An attacker can trigger cold starts to reset limits. With N concurrent instances, effective rate limit becomes N × configured limit.

**Fix:** Back rate limiting with Redis (Upstash), DynamoDB, or Supabase. Use sliding window algorithm instead of fixed window.

---

### C-04: Dev Mode Auth Bypass Has No Isolation

**File:** `apps/api/src/middleware/auth.ts:59-63`
**Severity:** CRITICAL
**Impact:** When Supabase is not configured, ANY `xorb_*` prefixed key grants full API access

```typescript
// Dev mode fallback: accept any xorb_ key when Supabase is not configured
const devHash = hashApiKey(apiKey)
c.set('sponsorAddress', `0x${devHash.slice(0, 40)}`)
await next()
```

**Problem:** There is no explicit `NODE_ENV` check. If Supabase env vars are missing in production (misconfiguration, secrets rotation failure), the API silently falls back to accepting any key. No rate limiting is applied in dev mode (the `rate_limit_per_minute` from Supabase is fetched but never enforced even in production mode — line 40).

**Fix:** Add explicit `NODE_ENV !== 'production'` guard. Log a warning when dev fallback activates. Enforce rate limits from DB.

---

### C-05: Nonce Replay Prevention Uses Wrong Table

**File:** `apps/api/src/middleware/x402.ts:131-152`
**Severity:** CRITICAL
**Impact:** Payment nonce tracking is hacked into webhook_deliveries table; nonce uniqueness is not guaranteed

```typescript
const { data: existing } = await sb
  .from('webhook_deliveries') // reuse as nonce store for now
  .select('id')
  .eq('event_type', `x402_nonce_${nonceHash}`)
  .single()
```

**Problem:** Uses `webhook_deliveries` table as a nonce store with `event_type` column storing `x402_nonce_xxx` values. This has no uniqueness constraint on `event_type`, creating a race condition: two concurrent requests with the same nonce could both pass the check before either inserts. Also pollutes the webhook delivery table with payment data.

**Fix:** Create a dedicated `payment_nonces` table with a UNIQUE constraint on `nonce_hash`. Use `INSERT ... ON CONFLICT` for atomic check-and-insert.

---

### C-06: SSRF Vulnerability in Webhook Delivery

**File:** `packages/agent-core/src/webhooks.ts`
**Severity:** CRITICAL
**Impact:** Webhook URLs are user-provided with no validation; can hit internal services

```typescript
const res = await fetch(url, { ... })
```

**Problem:** No URL scheme validation (could be `file://`, `ftp://`), no domain allowlist/blocklist, no DNS rebinding protection. An attacker registering a webhook with `http://169.254.169.254/latest/meta-data/` could exfiltrate cloud metadata. Timeout is set to 10s (good) but the vulnerability remains.

**Fix:** Validate URL scheme is `https://` only. Block RFC 1918 private ranges and link-local addresses. Consider using a webhook proxy service.

---

### C-07: Free Tier Tracking Counts All Actions, Not Per-Key

**File:** `apps/api/src/middleware/x402.ts:58-68`
**Severity:** CRITICAL
**Impact:** Free tier usage is counted globally across all API keys, not per-key

```typescript
const { count } = await sb
  .from('agent_actions')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', monthStart.toISOString())
// No .eq('api_key_hash', ...) filter!
```

**Problem:** The Supabase query counts ALL `agent_actions` in the current month regardless of which API key created them. One active user exhausts the free tier for all users. Additionally, the `apiKeyHash` parameter passed to `getUsage()` is never used in the Supabase query path.

**Fix:** Add `.eq('sponsor_address', ...)` or track usage per API key in a dedicated `api_usage` table.

---

### C-08: Marketplace Is Entirely In-Memory — Data Lost on Redeploy

**File:** `apps/api/src/routes/marketplace.ts:37-38`
**Severity:** CRITICAL
**Impact:** All marketplace listings and engagements are lost on every Vercel deployment

The marketplace router stores all data in JavaScript `Map` objects. No Supabase persistence, no contract interaction. A comment says "replaced by Supabase in production" but this was never implemented. The escrow amount parameter is accepted but no funds are ever transferred.

**Fix:** Persist marketplace state to Supabase. Integrate with the `AgentMarketplace.sol` and `XorbEscrow.sol` contracts for on-chain settlement.

---

### C-09: No Agent Ownership Checks on Most API Routes

**Files:** `apps/api/src/routes/actions.ts`, `audit.ts`, `events.ts`, `compliance.ts`, `marketplace.ts`
**Severity:** CRITICAL
**Impact:** Any authenticated user can execute actions for, audit, generate compliance reports for, and view events of ANY agent

The auth middleware sets `sponsorAddress` from the API key, but route handlers never check if the requested agent belongs to that sponsor. An API key holder can:
- Execute pipeline actions for agents they don't own
- Read complete audit trails of other users' agents
- Generate compliance reports for competitors' agents
- Subscribe to events for any agent

**Fix:** Add an `authorizeSponsor(agentId)` middleware that verifies `agent.sponsorAddress === c.get('sponsorAddress')`.

---

### C-10: Caller Identity Spoofable via Request Headers

**Files:** `apps/api/src/routes/agents.ts:83,101-102`
**Severity:** CRITICAL
**Impact:** Agent lifecycle operations (pause, resume, renew, revoke) use client-supplied identity instead of authenticated identity

```typescript
// PATCH handler reads caller from request body
const { action, caller_address } = body
registry.renewAgent(id, caller_address, ...)

// DELETE handler reads from a custom header
const callerAddress = c.req.header('x-caller-address') || c.get('sponsorAddress')
```

The `caller_address` in request bodies and the `x-caller-address` header are client-controlled. An attacker with any valid API key can impersonate any sponsor address by setting these values, bypassing ownership verification entirely.

**Fix:** Always use `c.get('sponsorAddress')` from the auth middleware. Remove `x-caller-address` header support. Never trust caller identity from request body.

---

## 2. HIGH SEVERITY FINDINGS

### H-01: Gates 5 and 6 Are Stub Implementations

**File:** `packages/agent-core/src/pipeline/gates.ts:104-121`

Gates 5 (Audit) and 6 (Webhook) always return `{ passed: true }` with no logic. The "8-gate pipeline" is effectively a 6-gate pipeline. While comments explain these are intentionally deferred (audit recording happens post-pipeline), the gate slots serve no security function.

**Impact:** Marketing claims "8 gates" but only 6 perform validation. Gates 5-6 add latency measurement overhead with zero security value.

---

### H-02: No Input Validation on Pipeline Context

**File:** `packages/agent-core/src/pipeline/gates.ts` (multiple gates)

`PipelineContext.params` is typed as `unknown` with no schema validation. The spend limit gate casts without checking:

```typescript
const params = ctx.params as Record<string, unknown> | undefined
const actionValue = params?.value as string | undefined
```

No Zod schemas, no runtime validation. Agent IDs, tool names, action names all accepted without sanitization.

**Impact:** Malformed input could cause runtime errors, BigInt parsing failures, or unexpected behavior deep in the pipeline.

---

### H-03: Reputation Delta in Pipeline Result Is Hardcoded

**File:** `packages/agent-core/src/pipeline/runner.ts:31`

```typescript
reputation_delta: approved ? 1 : -5,
```

The pipeline always returns +1 for approved and -5 for rejected, regardless of action severity, agent role, or gate failure type. The actual reputation engine has a sophisticated multi-event scoring system, but the pipeline result doesn't use it.

**Impact:** The reputation engine's nuanced scoring (streaks, severity-based penalties, engagement ratings) is bypassed by the pipeline's hardcoded delta.

---

### H-04: Cron Endpoints Bypass Auth When CRON_SECRET Is Unset

**File:** `apps/api/src/routes/cron.ts:22-24`

```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return c.json({ error: 'Unauthorized — invalid CRON_SECRET' }, 401)
}
```

When `CRON_SECRET` is not set (falsy), the `if` condition is false and all cron requests pass through. The `/v1/cron/decay` and `/v1/cron/cleanup` endpoints become publicly accessible, allowing anyone to trigger reputation decay or agent expiry.

**Impact:** Unauthorized mass reputation decay or agent cleanup.

---

### H-05: x402 Middleware Runs Before Auth

**File:** `apps/api/src/app.ts:33,42`

```typescript
app.use('*', x402Middleware())  // line 33 - runs on ALL routes
// ...
app.use('/v1/*', authMiddleware())  // line 42 - only on /v1/*
```

The x402 middleware processes payment headers and tracks usage BEFORE authentication. An unauthenticated request with a valid payment header could have the payment accepted before being rejected at the auth layer.

**Impact:** Payment processing for unauthenticated requests; usage tracking pollution.

---

### H-06: Session Wallet Address Is Deterministic and Predictable

**File:** `packages/agent-core/src/registry.ts`

```typescript
const sessionWallet = `0x${agentId.replace('agent_', '').padEnd(40, '0')}`
```

Session wallets are derived deterministically from agent IDs by padding with zeros. If an agent ID is known, its session wallet is trivially computed. These are not real cryptographic wallets.

**Impact:** Session wallets cannot be used for any cryptographic operations. If any on-chain logic relies on session wallet ownership, it's exploitable.

---

### H-07: Agent ID Truncation Reduces Entropy

**File:** `packages/agent-core/src/registry.ts`

```typescript
const agentId = `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`
```

UUID v4 provides 122 bits of entropy, but truncating to 16 hex characters yields only 64 bits. While still providing ~18 quintillion unique values, this is a needless entropy reduction for a security-critical identifier.

---

### H-08: Webhook Signature Fallback Uses Weak Hash

**File:** `packages/agent-core/src/webhooks.ts`

When `crypto.subtle` is unavailable (some Node.js environments), the webhook signature falls back to the same DJB2-style 32-bit hash used in the audit hash. This makes webhook signature verification trivially forgeable in those environments.

---

### H-09: No Cascade Deletes in Database Schema

**File:** `xorb-db/` schema files

`agent_actions` references `agent_registry` but has no `ON DELETE CASCADE`. Deleting or revoking an agent leaves orphaned action records. Similarly, no cascade for slash records, reputation history, or webhook deliveries.

---

### H-10: RLS Policy Too Permissive on agent_actions

**File:** `xorb-db/` schema

```sql
FOR SELECT USING (true)
```

All agent actions are readable by any authenticated user, regardless of ownership. An agent's complete action history (including potentially sensitive transaction details) is exposed to all API consumers.

---

### H-11: Smart Contract Reputation Tiers Duplicated in JavaScript

**Files:** `xorb-contracts/contracts/AgentRegistry.sol`, `packages/agent-core/src/roles.ts`

Both the Solidity contract and the TypeScript code define tier thresholds (UNTRUSTED=0, NOVICE=1000, RELIABLE=3000, TRUSTED=6000, ELITE=8500). These are maintained independently with no synchronization mechanism. If either changes, on-chain and off-chain tiers diverge.

---

### H-12: Error Handler Uses Fuzzy String Matching for Status Codes

**File:** `apps/api/src/middleware/error-handler.ts:33-36`

```typescript
if (msg.includes('Invalid')) return 400
if (msg.includes('sponsor')) return 403
if (msg.includes('not found')) return 404
```

Status codes are determined by substring matching on error messages. A database error with message "Sponsor table not found" would return 403 instead of 500. This is fragile and can cause incorrect HTTP status codes in production.

**Fix:** Use typed error classes (AuthError, ValidationError, NotFoundError) and check `instanceof`.

---

### H-13: Registry Silently Falls Back to In-Memory When Supabase Partially Configured

**File:** `apps/api/src/services/registry.ts:45-46`

If `SUPABASE_URL` is set but `SUPABASE_SERVICE_KEY` is missing (e.g., secrets rotation failure), the registry silently uses in-memory storage. All agent data is lost on redeploy with no error logged.

**Fix:** Fail fast in production if Supabase env vars are incomplete. Add explicit `NODE_ENV` check.

---

### H-14: Events Endpoint Exposes All Agents' Events to Any Authenticated User

**File:** `apps/api/src/routes/events.ts`

The events stream endpoint accepts an optional `agent_id` filter but doesn't verify the caller owns that agent. Without the filter, ALL events for ALL agents are returned. Combined with C-09, this leaks operational intelligence across users.

---

### H-15: Long-Polling Uses CPU-Intensive Busy Wait

**File:** `apps/api/src/routes/events.ts:33-54`

The long-polling implementation uses a tight `while` loop with 500ms `sleep()` calls. This blocks the Vercel serverless function for up to 25 seconds while consuming CPU. Should use an event emitter or async iterator pattern.

---

### H-16: Production CI/CD References Non-Existent Directories

**File:** `.github/workflows/production.yml`

The production workflow references `./xorb-blockchain-os` which doesn't exist in the repo (should be `./xorb-contracts`). The `continue-on-error: true` on TypeScript type checking silently ignores type errors. Docker build context references non-existent paths.

---

## 3. MEDIUM SEVERITY FINDINGS

### M-01: 23 Hardcoded Configuration Values

Across `agent-core`, security-critical parameters are hardcoded:

| Value | File | Impact |
|-------|------|--------|
| 1000 (initial reputation) | registry.ts | Cannot customize per-agent-type |
| 50000000 (default stake, 50 USDC) | registry.ts | Cannot adjust bond requirements |
| 3600000ms (rate limit window) | gates.ts | Fixed 1-hour windows only |
| 120/60/300 (max actions per role) | roles.ts | Cannot tune per-deployment |
| 5%/20%/50%/100% (slash percentages) | slashing.ts | Cannot adjust penalty severity |
| 8500/6000/3000/1000 (tier thresholds) | roles.ts | Disconnected from contract thresholds |
| 7 days (decay grace period) | reputation.ts | Cannot adjust for different agent types |
| 1000 (free tier limit) | x402.ts | Cannot offer different tiers |
| 10000 (event log size) | events.ts | Memory bound not configurable |

**Fix:** Extract all values to a `config.ts` module that reads from environment variables with sensible defaults.

---

### M-02: Compliance Module Generates Unsubstantiated Reports

**File:** `packages/agent-core/src/compliance.ts`

The compliance reporter generates impressive-looking documents for EU AI Act, NIST AI RMF, and SOC 2 frameworks, but performs **zero actual compliance validation**:

```typescript
status: data.violations.length < 5 ? 'pass' : 'warning'
// "Less than 5 violations = pass" is an assertion, not a standard requirement

status: data.humanOverrideCount > 0 ? 'pass' : 'warning'
// Just checks if ANY human override happened, ever
```

Evidence is synthetic (just formatted input data). No attestation, no cryptographic proof, no verification against on-chain state. If used for regulatory filings, this creates legal liability.

**Additionally:** Zero test coverage for the compliance module.

---

### M-03: Slashing Engine Has No Bond Recovery Mechanism

**File:** `packages/agent-core/src/slashing.ts`

Slashed bond is permanently lost. No mechanism for agents to rebuild bond through good behavior. Agents on probation cannot recover reputation. The escalation logic recommends actions (suspend, revoke, probation) but doesn't enforce them — the API caller must implement enforcement.

---

### M-04: Event System Has No Persistence

**File:** `packages/agent-core/src/events.ts`

The event log is in-memory only, capped at 10,000 events. At high throughput (~166 events/sec), the entire log rotates in ~1 minute. Lost on restart. No backing store integration despite the DataStore pattern existing.

---

### M-05: Solidity Reputation Decay Logic May Be Incorrect

**File:** `xorb-contracts/contracts/ReputationScore.sol:337-342`

```solidity
if (rep.lastDecayAt > rep.lastUpdatedAt) {
    uint256 alreadyDecayed = (rep.lastDecayAt - rep.lastUpdatedAt);
```

The condition `lastDecayAt > lastUpdatedAt` and subsequent subtraction appears logically inverted. If decay was applied after the last update, the "already decayed" period calculation doesn't properly account for the time since the last activity.

---

### M-06: SlashingEngine Has Redundant Functions

**File:** `xorb-contracts/contracts/SlashingEngine.sol`

Both `reportAndSlash()` and `reportViolation()` perform the same operation — creating a violation record and executing the slash immediately. `executeSlash()` exists but is unreachable for records created by either function since they're marked `executed: true` on creation.

---

### M-07: PaymentStreaming topUp() Logic Error

**File:** `xorb-contracts/contracts/PaymentStreaming.sol:148`

```solidity
if (s.status == StreamStatus.Paused && _getEarned(s) < s.deposit)
```

Reactivation check compares earned vs deposit, but should check if remaining funds exist. Once `earned >= deposit`, the stream is depleted but the condition prevents topUp from reactivating it even with new funds.

---

### M-08: AgentMarketplace Allows Hiring Expired Agents

**File:** `xorb-contracts/contracts/AgentMarketplace.sol`

`hireAgent()` does not check if the agent's registration has expired in the AgentRegistry contract. A hirer could pay for an agent whose registration is expired, wasting funds.

---

### M-09: SDK Marketplace Type Mismatch

**Files:** `packages/xorb-sdk-ts/src/client.ts`, `packages/xorb-sdk-py/xorb/client.py`

Both SDKs use `rate_usdc_per_hour` and `rate_usdc_per_action` for marketplace listings, but the smart contract uses `pricePerUnit` with a `PricingModel` enum (PerHour/PerDay/PerTask). This will cause failures when the API integrates with on-chain contracts.

---

### M-10: MCP Server Has Incomplete Tool Set

**File:** `packages/xorb-mcp/src/index.ts`

Only 5 of the platform's capabilities are exposed as MCP tools. Missing: marketplace listing/hiring, stream creation/withdrawal, webhook management, compliance report generation.

---

### M-11: Dashboard Uses Client-Side Filtering

**File:** `apps/dashboard/src/pages/Agents.tsx`

Agent search/filtering is done entirely client-side. All agents are fetched and filtered in the browser. This breaks beyond ~100 agents and wastes bandwidth.

---

### M-12: XorbEscrow Slash Split Loses Remainder

**File:** `xorb-contracts/contracts/XorbEscrow.sol:183`

```solidity
uint256 sponsorShare = amount / 2;
```

For odd USDC amounts (in 6-decimal precision), the integer division drops the remainder, which goes to the treasury unfairly. Should use `amount - sponsorShare` for the second party.

---

### M-13: OpenAPI Spec Version Mismatch

**File:** `apps/api/openapi.yaml`

The OpenAPI spec lists version `0.1.0` while the health endpoint returns `0.4.0`. Response schemas for many endpoints are incomplete or missing (`responses: '200': description: Listing list` with no schema).

---

### M-14: No Slashing for Marketplace Cancellations

**File:** `xorb-contracts/contracts/AgentMarketplace.sol`

`cancelEngagement()` pays the owner pro-rata but doesn't penalize agents for frequent cancellations. An agent could grief hirers by accepting engagements and immediately canceling after a small time increment.

---

### M-15: No Per-Second/Per-Minute Rate Limiting

The API has no request-rate limiting beyond the monthly free tier cap. There is no per-IP, per-second, or per-API-key rate limiting. Free endpoints (`/v1/health`, `/v1/pricing`) have zero protection against request flooding.

---

### M-16: API Response Formats Inconsistent Across Routes

Response shapes vary across routes: `{ agent }` vs `{ agents }` vs raw `PipelineResult` vs `{ total, approved, blocked, results }`. No consistent envelope format. Makes SDK development and error handling harder for consumers.

---

### M-17: In-Memory Singletons (Reputation, Slashing, Events, Webhooks)

Beyond the marketplace (C-08), the reputation engine, slashing service, event bus, and webhook service are all in-memory singletons. Reputation history, slashing records, event log, and webhook state are lost on every deployment. Only agents and actions are persisted to Supabase.

---

### M-18: Rating Only After Completion, Not Dispute Resolution

**File:** `xorb-contracts/contracts/AgentMarketplace.sol:343`

```solidity
require(e.status == EngagementStatus.Completed, ...)
```

Disputed engagements can never receive ratings. If a dispute is resolved with a partial refund, the agent's marketplace rating is never updated, creating a blind spot in reputation.

---

## 4. LOW SEVERITY FINDINGS

### L-01: No API Tests

The `apps/api/` directory contains zero test files. All testing is in `agent-core` only. Route handlers, middleware, and Supabase adapter have no test coverage.

### L-02: `as any` Type Casts in API

5 instances of `as any` in the API codebase:
- `events.ts:11` — query parameter cast
- `actions.ts:30` — status code cast
- `error-handler.ts:60` — status code cast
- `x402.ts:201,242` — 402 status code cast (Hono doesn't type 402)

### L-03: UUID Collision in Action IDs

Action IDs use the same truncated UUID pattern as agent IDs: `act_${uuid.slice(0,16)}`. Same 64-bit entropy concern.

### L-04: No Pagination in DataStore Interface

`fetchAgentActions()` accepts an optional `limit` but no offset/cursor. Large result sets are loaded entirely into memory.

### L-05: Python SDK Lacks Async Support

The Python SDK uses synchronous `httpx.Client` only. For AI agent workloads that are inherently async, this is a blocking limitation.

### L-06: AgentRegistry Contract Sponsor Count Not Decremented on Expiry

Only decremented on explicit pause/revoke, not when an agent naturally expires. Sponsors may be unable to spawn new agents if they've hit the max while having expired (but not revoked) agents.

### L-07: No Event for Treasury Changes in Contracts

`setTreasury()` modifies the critical treasury address without emitting an event. Off-chain indexers cannot track treasury changes.

### L-08: MCP Server Backward Compatibility Hacks

The MCP server checks both `trustScore`/`reputation` and `reputationTier`/`scope` because the API response format is inconsistent. This should be fixed at the API level.

---

## 5. INFORMATIONAL FINDINGS

### I-01: Architecture Quality — Separation of Concerns

The separation between `agent-core` (zero browser deps, pure domain logic) and `apps/api` (Hono HTTP layer) is well-executed. The injectable DataStore adapter pattern properly decouples persistence from business logic. This is production-quality architecture.

### I-02: Smart Contracts Use OpenZeppelin Best Practices

All contracts use OpenZeppelin v5.0.2 for AccessControl, ReentrancyGuard, Pausable, and SafeERC20. This is the correct approach for security-critical Solidity code.

### I-03: Test Coverage in agent-core Is Meaningful

The 4 test files cover meaningful behavior (not just line coverage): pipeline short-circuiting, reputation streak mechanics, slashing BigInt arithmetic, and event handler error isolation. However, integration tests are absent.

### I-04: Hono Framework Choice Is Appropriate

Hono at 14KB is an excellent choice for Vercel Edge/Serverless. The middleware composition maps naturally to the 8-gate pipeline concept.

### I-05: Chain Deployment Inconsistency

CLAUDE.md lists deployed contracts on Polygon PoS (Chain ID 137), but the health endpoint and .env.example reference Base as the primary chain. The API integration config references Base mainnet (`eip155:8453`). This inconsistency should be clarified.

---

## 6. CROSS-CUTTING ARCHITECTURE ISSUES

### 6.1 On-Chain / Off-Chain State Divergence

Three independent sources of truth exist for agent state:
1. **Solidity contracts** (AgentRegistry on Polygon/Base) — canonical on-chain state
2. **Supabase database** (agent_registry table) — API persistence layer
3. **In-memory registry** (agent-core AgentRegistryService) — runtime cache

No synchronization mechanism exists between these layers. An agent expired on-chain may appear active in Supabase and in-memory until the next API interaction triggers a check.

### 6.2 Double Slashing Risk

Both `AgentRegistry.slashAgent()` and `XorbEscrow.slash()` can reduce an agent's bond. If the same violation triggers both (via API → contract interaction), the agent loses 2x the intended penalty.

### 6.3 Missing Error Handling Contract

The DataStore interface defines no error semantics. Should `fetchAgent()` throw on network error? Return null? The behavior is implementation-dependent, making the adapter pattern fragile in practice.

### 6.4 Lack of Observability

No metrics collection, no distributed tracing, no structured logging beyond Hono's basic logger. For a system managing financial operations, this makes debugging production issues extremely difficult.

---

## 7. VERIFICATION AGAINST EXTERNAL ANALYSIS

The following claims from the multi-perspective analysis are verified against the actual codebase:

| Claim | Verified? | Notes |
|-------|-----------|-------|
| "8-gate sequential pipeline" | **PARTIAL** | 6 real gates + 2 stubs |
| "SHA-256 audit hash" | **FALSE** | Uses 32-bit DJB2, not SHA-256 |
| "ERC-8004 integration" | **NOT IN CODE** | No ERC-8004 integration code found in codebase |
| "AgentScore integration" | **NOT IN CODE** | No AgentScore API calls in codebase |
| "x402 payment validation" | **PARTIAL** | Header parsing exists, signature verification missing |
| "PayCrow integration" | **NOT IN CODE** | No PayCrow API calls in codebase |
| "Composable gate factories" | **TRUE** | Clean factory pattern, well-implemented |
| "Injectable DataStore adapter" | **TRUE** | Proper adapter pattern with interface |
| "Supabase persistence" | **TRUE** | Supabase adapter implemented |
| "10 registered agents" | **POSSIBLY** | Health endpoint hardcoded at v0.4.0, agents loaded from Supabase |
| "API versioning (/v1/)" | **TRUE** | All routes under /v1/ |
| "Hono framework" | **TRUE** | Using @hono/hono |
| "OpenAPI spec" | **TRUE** | Exists at apps/api/openapi.yaml (incomplete) |
| "TypeScript SDK" | **TRUE** | Functional with 85% completeness |
| "Python SDK" | **TRUE** | Functional with 80% completeness |
| "MCP server (5 tools)" | **TRUE** | 5 tools implemented |
| "7 Solidity contracts" | **TRUE** | All 7 present and substantially complete |

**Key Discovery:** The four external integrations (ERC-8004, AgentScore, x402 settlement, PayCrow) referenced on the website are **not present in the codebase**. The health endpoint that shows these integrations must be returning a more detailed response in production than what the code implements. The codebase has x402 header parsing but no facilitator integration, and none of the other three services are called.

---

## 8. RECOMMENDED REMEDIATION PRIORITY

### Immediate (Week 1) — Security Critical

1. **C-01:** Replace audit hash with `createHash('sha256')` from `node:crypto`
2. **C-02:** Implement ECDSA signature verification for x402 payments
3. **C-04:** Add explicit `NODE_ENV` guard for dev auth fallback
4. **C-06:** Validate webhook URLs (HTTPS only, block private ranges)
5. **C-07:** Fix free tier tracking to be per-API-key
6. **C-09:** Add agent ownership checks (`authorizeSponsor` middleware) on all routes
7. **C-10:** Remove `x-caller-address` header; always use auth context for caller identity
8. **H-04:** Require CRON_SECRET on cron endpoints regardless of env

### Short-term (Weeks 2-3) — Functional Correctness

9. **C-03:** Back rate limiting with Redis/Upstash
10. **C-05:** Create dedicated `payment_nonces` table with uniqueness constraint
11. **C-08:** Persist marketplace data to Supabase
12. **H-02:** Add Zod schemas for all pipeline inputs
13. **H-03:** Connect pipeline result to actual reputation engine deltas
14. **H-05:** Reorder middleware: auth before x402
15. **H-12:** Replace fuzzy error string matching with typed error classes
16. **M-01:** Extract hardcoded values to configuration
17. **M-17:** Persist reputation, slashing, events, and webhook state to Supabase

### Medium-term (Weeks 3-6) — Production Readiness

13. **H-01:** Implement real logic for Gates 5-6 or reduce pipeline to 6 gates
14. **H-09/H-10:** Fix database cascade deletes and RLS policies
15. **H-12:** Fix CI/CD paths and remove `continue-on-error`
16. **M-02:** Either rewrite compliance module with real validation or remove it
17. **M-03:** Add bond recovery mechanism to slashing engine
18. **L-01:** Add API integration tests

### Long-term (Months 2-3) — Scale and Polish

19. **M-05:** Fix Solidity reputation decay logic
20. **M-06:** Remove redundant SlashingEngine functions
21. **M-09:** Align SDK types with contract interfaces
22. **M-10:** Complete MCP tool set
23. **M-11:** Implement server-side pagination
24. Implement observability (metrics, tracing, structured logging)
25. Add formal Solidity audit before mainnet deployment

---

## 9. POSITIVE FINDINGS — What's Done Right

Despite the critical issues, the codebase demonstrates several strong engineering decisions:

1. **Clean architecture separation** — `agent-core` has zero browser dependencies and is genuinely portable across Node, Edge, and Deno runtimes
2. **Composable gate pattern** — The factory function approach for gates is elegant and allows easy reordering/adding/removing gates
3. **Reputation algorithm depth** — The streak system, multi-event scoring, severity-based penalties, and decay mechanics show genuine domain thinking
4. **Smart contract quality** — Using OpenZeppelin, proper access control, ReentrancyGuard on financial functions, SafeERC20 for token transfers
5. **Comprehensive type system** — The shared types package (`xorb-types`) ensures consistency across TypeScript packages
6. **Proper API key security** — SHA-256 hashing of keys before storage, checking against hash (not plaintext)
7. **OpenAPI spec exists** — While incomplete, having an OpenAPI spec at all puts the project ahead of many competitors
8. **Multi-SDK strategy** — Having both TypeScript and Python SDKs from day one is the right approach for the AI agent ecosystem
9. **Webhook HMAC signatures** — The primary path uses HMAC-SHA256 for webhook signing (though the fallback is weak)
10. **BigInt for USDC arithmetic** — Correctly handles 6-decimal USDC precision using BigInt, avoiding floating-point issues

---

## 10. CONCLUSION

X.orb has a **strong architectural foundation** with genuine domain expertise evident in the reputation engine, slashing mechanics, and pipeline composition pattern. The smart contracts are substantially complete and follow Solidity best practices.

**The primary gap is between what the platform claims and what the code implements.** The "8-gate pipeline" is 6 gates. The "SHA-256 audit hash" is a 32-bit hash. The "x402 payment validation" checks string length, not signatures. The four external integrations (ERC-8004, AgentScore, x402 settlement, PayCrow) are not present in the code.

**Estimated effort to address all CRITICAL and HIGH findings:** 3-4 weeks for a single senior engineer. The architecture is sound enough that fixes are additive (replace hash function, add validation layer, swap storage backend) rather than requiring rewrites.

**The concept is ahead of the execution, but the gap is bridgeable.** The codebase is ~80% of the way to a credible beta and ~60% of the way to production readiness.

---

*Report generated from automated deep analysis of the X.orb codebase on 2026-03-18.*
