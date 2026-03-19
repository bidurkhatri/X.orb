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
  xorb-mcp/      — @xorb/mcp (MCP server, 10 tools)
xorb-contracts/  — 8 Solidity contracts (Polygon PoS, Chain ID 137)
xorb-db/         — Supabase tables + edge functions
xorb-deploy/     — CI/CD configs
xorb-docs/       — Documentation
```

## Key Architecture Decisions

- **Hono** over Express — runs on Vercel Edge, 14KB, middleware maps to 8-gate pipeline
- **agent-core** has zero browser deps — uses injectable `DataStore` adapter
- **USDC on Polygon PoS + Base** — no custom token, x402 v2 payments (EIP-3009 TransferWithAuthorization, no approval needed)
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
- x402 v2 middleware returns HTTP 402 with payment instructions. Uses EIP-3009 TransferWithAuthorization — no USDC pre-approval needed. Accepts `payment-signature` header (primary) or `x-payment` (legacy).

## Smart Contract Constructors

When deploying, match these exact signatures:
- `XorbEscrow(address _usdc, address _treasury)`
- `AgentRegistry(address _stakeToken, address _treasury, address _admin)`
- `ReputationScore(address _agentRegistry, address _admin)`
- `SlashingEngine(address _agentRegistry, address _reputationScore, address _admin)`
- `ActionVerifier()` — no args
- `PaymentStreaming(address _token, address _treasury)`
- `AgentMarketplace(address _token, address _treasury)`

## Deployed Contracts

### Polygon PoS (Chain ID 137)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7` |
| ReputationScore | `0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8` |
| SlashingEngine | `0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625` |
| PaymentStreaming | `0xb34717670889190B2A92E64B51e0ea696cE88D89` |
| AgentMarketplace | `0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c` |
| ActionVerifier | `0x463856987bD9f3939DD52df52649e9B8Cb07B057` |
| XorbEscrow | `0x4B8994De0A6f02014E71149507eFF6903367411C` |
| XorbPaymentSplitter | `0xc038C3116CD4997fF4C8f42b2d97effb023214c9` |

### Base (Chain ID 8453)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7` |
| ReputationScore | `0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8` |
| SlashingEngine | `0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625` |
| PaymentStreaming | `0xb34717670889190B2A92E64B51e0ea696cE88D89` |
| AgentMarketplace | `0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c` |
| ActionVerifier | `0x463856987bD9f3939DD52df52649e9B8Cb07B057` |
| XorbEscrow | `0x4B8994De0A6f02014E71149507eFF6903367411C` |
| XorbPaymentSplitter | `0xc038C3116CD4997fF4C8f42b2d97effb023214c9` |
