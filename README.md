<div align="center">

# X.orb

### The orchestration layer for AI agent trust.

X.orb orchestrates trust infrastructure for autonomous AI agents. One API call runs your agent's action through an 8-gate security pipeline that checks identity (ERC-8004), permissions, rate limits, payments (x402), audit logging, trust scoring (MoltGuard), execution, and escrow (Xorb Escrow).

[![API](https://img.shields.io/badge/API-v0.5.1-22C55E?style=flat-square)](https://api.xorb.xyz/v1/health)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-0066FF?style=flat-square)](https://dashboard.xorb.xyz)
[![x402](https://img.shields.io/badge/x402-integrated-purple?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-integrated-orange?style=flat-square)](https://eips.ethereum.org/EIPS/eip-8004)
[![Polygon](https://img.shields.io/badge/Polygon-8%20contracts-7B3FE4?style=flat-square)](https://polygonscan.com)

</div>

---

## Architecture

```
                              X.orb API (Vercel Serverless)
                             ┌──────────────────────────────────────────────┐
                             │                8-Gate Pipeline               │
                             │                                              │
  ┌──────────┐   HTTP/x402   │  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
  │  Client   │─────────────>│  │ 1.Identity│─>│2.Permissions│─>│3.Rate   │  │
  │ (SDK/MCP) │              │  │ (ERC-8004)│  │  (Scopes)  │  │  Limit  │  │
  └──────────┘               │  └──────────┘  └────────────┘  └────┬────┘  │
                             │                                      │       │
  ┌──────────┐               │  ┌──────────┐  ┌────────────┐  ┌────v────┐  │
  │ Supabase │<──────────────│  │8.Escrow  │<─│ 7.Execute  │<─│4.Payment│  │
  │ (persist)│               │  │(Xorb)    │  │            │  │ (x402)  │  │
  └──────────┘               │  └──────────┘  └────────────┘  └────┬────┘  │
                             │                                      │       │
                             │  ┌──────────────────────────────────┐│       │
                             │  │  5.Audit Log ─> 6.Trust Score   ││       │
                             │  │            (MoltGuard)           │┘       │
                             │  └──────────────────────────────────┘        │
                             └──────────────────────────────────────────────┘
                                              │
                             ┌────────────────┼────────────────┐
                             │                │                │
                        ┌────v─────┐  ┌───────v──────┐  ┌─────v──────┐
                        │ ERC-8004 │  │  MoltGuard   │  │   Xorb     │
                        │ (Base L2)│  │  (Trust API) │  │  (Escrow)  │
                        └──────────┘  └──────────────┘  └────────────┘
```

## What X.orb Does

Every AI agent action passes through 8 sequential gates. If any gate fails, the action is blocked.

| Gate | What It Checks | Powered By |
|------|---------------|------------|
| 1. Identity | Is this agent registered on-chain? | **ERC-8004** on Base |
| 2. Permissions | Is this tool allowed for this agent's role? | **X.orb** |
| 3. Rate Limit | Has the agent exceeded its hourly quota? | **X.orb** |
| 4. Payment | Is an x402 USDC payment attached? | **x402** protocol |
| 5. Audit Log | SHA-256 hash of action + gate results | **X.orb** |
| 6. Trust Score | Does the agent's trust score allow this? | **MoltGuard** API |
| 7. Execute | Run the action | **X.orb** |
| 8. Escrow | Is the payment held safely? | **Xorb Escrow** (Polygon) |

## Quick Start

### 1. Create an API key

```bash
curl -X POST https://api.xorb.xyz/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"owner_address": "0xYOUR_WALLET", "label": "my-project"}'
```

### 2. Register an agent

```bash
curl -X POST https://api.xorb.xyz/v1/agents \
  -H "x-api-key: xorb_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-research-bot",
    "scope": "RESEARCHER",
    "sponsor_address": "0xYOUR_WALLET",
    "description": "Monitors whale wallets"
  }'
```

### 3. Execute an action (requires x402 payment)

```bash
curl -X POST https://api.xorb.xyz/v1/actions/execute \
  -H "x-api-key: xorb_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_xxx",
    "action": "query",
    "tool": "get_balance",
    "params": { "address": "0x..." }
  }'
```

## Pricing

All action endpoints require x402 USDC payment. No free tier.

| Endpoint | Cost (USDC) |
|----------|-------------|
| `POST /v1/agents` | $0.10 |
| `POST /v1/actions/execute` | $0.005 |
| `POST /v1/actions/batch` | $0.003/action |
| `GET /v1/reputation` | $0.001 |
| `POST /v1/marketplace/hire` | $0.05 |
| `GET /v1/audit` | $0.01 |
| `POST /v1/webhooks` | $0.10 |
| `GET /v1/compliance` | $1.00 |

Free: health, pricing, docs, list agents, events, auth/keys, pause/resume/revoke.

High-volume discount: 15 bps (0.15%) after 50,000 monthly actions.

## Deployed Contracts (Polygon PoS)

| Contract | Address |
|----------|---------|
| AgentRegistry | [`0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7`](https://polygonscan.com/address/0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7) |
| ReputationScore | [`0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8`](https://polygonscan.com/address/0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8) |
| SlashingEngine | [`0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625`](https://polygonscan.com/address/0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625) |
| PaymentStreaming | [`0xb34717670889190B2A92E64B51e0ea696cE88D89`](https://polygonscan.com/address/0xb34717670889190B2A92E64B51e0ea696cE88D89) |
| AgentMarketplace | [`0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c`](https://polygonscan.com/address/0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c) |
| ActionVerifier | [`0x463856987bD9f3939DD52df52649e9B8Cb07B057`](https://polygonscan.com/address/0x463856987bD9f3939DD52df52649e9B8Cb07B057) |
| XorbEscrow | [`0x4B8994De0A6f02014E71149507eFF6903367411C`](https://polygonscan.com/address/0x4B8994De0A6f02014E71149507eFF6903367411C) |
| XorbPaymentSplitter | [`0xc038C3116CD4997fF4C8f42b2d97effb023214c9`](https://polygonscan.com/address/0xc038C3116CD4997fF4C8f42b2d97effb023214c9) |

## Integrations

| Service | Role | Status |
|---------|------|--------|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain agent identity | Base L2 |
| [MoltGuard](https://api.moltrust.ch/guard/) | Trust scoring (0-100) | Live API |
| [x402](https://x402.org) | Per-action USDC payments | Integrated |
| Xorb Escrow | Native escrow on Polygon | [Deployed](https://polygonscan.com/address/0x4B8994De0A6f02014E71149507eFF6903367411C) |

## Project Structure

```
x.orb/
├── api/index.ts              — Vercel serverless API (production)
├── apps/
│   ├── api/                  — Modular Hono API (local dev)
│   ├── dashboard/            — React dashboard (Liquid Glass UI)
│   └── landing/              — Landing page (xorb.xyz)
├── packages/
│   ├── agent-core/           — Domain logic (8-gate pipeline, fee engine)
│   ├── xorb-types/           — Shared TypeScript types
│   ├── xorb-sdk-ts/          — @xorb/sdk (TypeScript client)
│   ├── xorb-sdk-py/          — xorb-sdk (Python client)
│   └── xorb-mcp/             — @xorb/mcp (MCP server, 10 tools)
├── xorb-contracts/           — 8 Solidity contracts (Polygon PoS)
├── xorb-db/                  — Supabase migrations (21 tables)
└── docs/                     — 17 documentation files
```

## Live URLs

| Service | URL |
|---------|-----|
| API | [api.xorb.xyz](https://api.xorb.xyz/v1/health) |
| Dashboard | [dashboard.xorb.xyz](https://dashboard.xorb.xyz) |
| Landing | [xorb.xyz](https://xorb.xyz) |
| Docs | [api.xorb.xyz/v1/docs](https://api.xorb.xyz/v1/docs) |
| Pricing | [api.xorb.xyz/v1/pricing](https://api.xorb.xyz/v1/pricing) |

## Development

```bash
pnpm install          # Install all workspace deps
pnpm dev              # Start API server (Vercel dev)
pnpm test             # Run all tests (48 agent-core + 15 API)
cd apps/dashboard && pnpm dev  # Start dashboard
```

## License

MIT — Fintex Australia Pty Ltd
