# X.orb — Developer Context

## What is this?

X.orb is an API-first trust infrastructure for autonomous AI agents. It provides an 8-gate security pipeline, reputation scoring, economic bonding/slashing, escrow marketplace, and compliance reporting — all paid per-action via x402 in USDC.

## Project Structure

```
apps/
  api/           — Hono REST API on Vercel Serverless
  dashboard/     — React + Vite + Tailwind (Liquid Glass design)
packages/
  agent-core/    — Pure domain logic (zero browser deps)
  xorb-types/    — Shared TypeScript types
  xorb-sdk-ts/   — @xorb/sdk (TypeScript client)
  xorb-sdk-py/   — xorb-sdk (Python client)
  xorb-mcp/      — @xorb/mcp (MCP server, 5 tools)
xorb-contracts/  — 7 Solidity contracts (Base + Polygon)
xorb-db/         — Supabase tables + edge functions
xorb-deploy/     — CI/CD configs
xorb-docs/       — Documentation
```

## Key Architecture Decisions

- **Hono** over Express — runs on Vercel Edge, 14KB, middleware maps to 8-gate pipeline
- **agent-core** has zero browser deps — uses injectable `DataStore` adapter
- **USDC on Base** — no custom token, x402 payments
- **Supabase** for persistence, in-memory fallback for dev
- **Long-polling** instead of SSE — Vercel Serverless doesn't support persistent connections

## Commands

```bash
pnpm install          # Install all workspace deps
pnpm dev              # Start API server (Vercel dev)
pnpm test             # Run all tests
cd apps/dashboard && pnpm dev  # Start dashboard
```

## Testing

Tests are in `packages/agent-core/src/__tests__/`. Run with `pnpm test`.
- `pipeline.test.ts` — 8-gate pipeline, gate blocking, audit hash
- `reputation.test.ts` — scoring, streaks, tiers, decay
- `slashing.test.ts` — severity levels, gate mapping, escalation
- `events.test.ts` — subscribe, emit, filter, unsubscribe

## Important Patterns

- All gates are factory functions: `createGateRegistry(registry)` returns `async (ctx) => GateResult`
- Pipeline is composable: `runPipeline(context, [gate1, gate2, ...])`
- Services are singletons via `getRegistry()`, `getReputationEngine()`, etc.
- Auth validates against Supabase `api_keys` table (SHA-256 hash). Dev fallback accepts any `xorb_*` key.
- x402 middleware returns HTTP 402 with payment instructions when free tier (1000/month) exhausted.

## Smart Contract Constructors

When deploying, match these exact signatures:
- `XorbEscrow(address _usdc, address _treasury)`
- `AgentRegistry(address _stakeToken, address _treasury, address _admin)`
- `ReputationScore(address _agentRegistry, address _admin)`
- `SlashingEngine(address _agentRegistry, address _reputationScore, address _admin)`
- `ActionVerifier()` — no args
- `PaymentStreaming(address _token, address _treasury)`
- `AgentMarketplace(address _token, address _treasury)`
