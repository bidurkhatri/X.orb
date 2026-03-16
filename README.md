# X.orb — Agent Trust Infrastructure

> The logic gate between AI agents and the real world.

**X.orb** is an API-first trust and accountability infrastructure for autonomous AI agents. It provides identity, reputation scoring, an 8-gate security pipeline, economic bonding/slashing, escrow-based marketplace, and compliance reporting — all paid per-action via the x402 protocol in USDC.

## Domains

- **x.orb** — Handshake domain. On-chain agent registry.
- **xorb.xyz** — Primary domain. API, docs, developer portal.
- **api.xorb.xyz** — REST API base URL.
- **docs.xorb.xyz** — Developer documentation.

## Architecture

```
Developer → Xorb REST API → Supabase (PostgreSQL)
                           → Smart Contracts (Base / Polygon)
                           → x402 payment middleware
                           → Webhook / Event delivery
```

## The 8-Gate Security Pipeline

Every agent action passes through 8 sequential gates:

1. **Registry Check** — Is this agent registered and active?
2. **Permission Check** — Does this agent's role allow this tool?
3. **Rate Limit** — Has the agent exceeded its hourly quota?
4. **Spend Limit** — Does this action exceed the per-action spending cap?
5. **Audit Log** — Record the action attempt (immutable).
6. **Webhook Dispatch** — Notify subscribers of the action.
7. **Execute** — Run the actual tool/action.
8. **Reputation Update** — Adjust score based on outcome.

## Project Structure

```
xorb/
├── apps/
│   └── api/                 — Hono REST API (Vercel Serverless)
├── packages/
│   ├── agent-core/          — Pure domain logic (zero browser deps)
│   └── xorb-types/          — Shared TypeScript types
├── xorb-contracts/          — Solidity smart contracts (Base + Polygon)
├── xorb-db/                 — Supabase tables + edge functions
├── xorb-deploy/             — CI/CD and deployment configs
└── xorb-docs/               — Documentation
```

## Smart Contracts (Base L2)

| Contract | Purpose |
|----------|---------|
| `AgentRegistry.sol` | Agent identity, licensing, USDC bonds |
| `ReputationScore.sol` | Soulbound reputation with 5 tiers + ERC-8004 |
| `SlashingEngine.sol` | Automated penalty enforcement (5%-100% USDC slash) |
| `PaymentStreaming.sol` | Per-second USDC micropayment streams |
| `AgentMarketplace.sol` | Hire/rent agents with USDC escrow |
| `ActionVerifier.sol` | On-chain action hash anchoring |

## Getting Started

```bash
pnpm install
pnpm dev        # Start API server
pnpm test       # Run all tests
```

## License

Proprietary — Fintex / Bidur
