<div align="center">

# X.orb

### The orchestration layer for AI agent trust

One API call. 8 security gates. Real payments. X.orb orchestrates identity verification (ERC-8004), permissions, rate limits, micropayments (x402), audit logging, trust scoring (MoltGuard), action execution, and escrow into a single pipeline for autonomous AI agents.

[![API](https://img.shields.io/badge/API-v0.5.1-22C55E?style=flat-square)](https://api.xorb.xyz/v1/health)
[![npm](https://img.shields.io/npm/v/@xorb/sdk?style=flat-square&color=CB3837)](https://www.npmjs.com/package/@xorb/sdk)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-0066FF?style=flat-square)](https://dashboard.xorb.xyz)
[![Polygon](https://img.shields.io/badge/Polygon-8%20contracts-7B3FE4?style=flat-square)](https://polygonscan.com)
[![x402](https://img.shields.io/badge/x402-payments-purple?style=flat-square)](https://x402.org)

</div>

---

## How It Works

Every AI agent action passes through 8 sequential security gates:

```
Your Agent → X.orb API → 8 Gates → Approved or Blocked (with audit hash)
```

| Gate | Check | Powered By |
|------|-------|------------|
| 1. Identity | Agent registered on-chain? | ERC-8004 (Base) |
| 2. Permissions | Tool allowed for this agent type? | X.orb |
| 3. Rate Limit | Hourly quota exceeded? | X.orb |
| 4. Payment | x402 USDC payment attached? | x402 protocol |
| 5. Audit | SHA-256 hash of action + results | X.orb |
| 6. Trust Score | Agent reputation sufficient? | MoltGuard |
| 7. Execute | Run the action | X.orb |
| 8. Escrow | Payment held safely? | Xorb Escrow (Polygon) |

## Quick Start

```bash
# 1. Create an API key
curl -X POST https://api.xorb.xyz/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"owner_address": "0xYOUR_WALLET", "label": "my-project"}'

# 2. Register an agent
curl -X POST https://api.xorb.xyz/v1/agents \
  -H "x-api-key: xorb_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-bot", "scope": "data analysis", "sponsor_address": "0xYOUR_WALLET"}'

# 3. Execute an action (requires x402 payment)
curl -X POST https://api.xorb.xyz/v1/actions/execute \
  -H "x-api-key: xorb_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent_xxx", "action": "query", "tool": "get_balance"}'
```

## SDK

```bash
npm install @xorb/sdk
```

```typescript
import { XorbClient } from '@xorb/sdk'

const xorb = new XorbClient({ apiKey: 'xorb_sk_...' })

const agent = await xorb.agents.register({
  name: 'my-bot',
  role: 'RESEARCHER',
  sponsor_address: '0x...',
})

const result = await xorb.actions.execute({
  agent_id: agent.agentId,
  action: 'query',
  tool: 'get_balance',
})

console.log(result.approved)    // true
console.log(result.audit_hash)  // 0x5e96...
console.log(result.gates)       // 8 gate results
```

## Pricing

Every action requires x402 USDC payment. No free tier.

| Endpoint | Cost |
|----------|------|
| Register agent | $0.10 |
| Execute action | $0.005 |
| Batch action | $0.003/ea |
| Reputation lookup | $0.001 |
| Compliance report | $1.00 |
| Marketplace hire | $0.05 |

High-volume discount: 0.15% after 50K monthly actions.

Free endpoints: health, pricing, docs, list agents, events, auth/keys.

## Smart Contracts (Polygon PoS)

| Contract | Address |
|----------|---------|
| AgentRegistry | [`0x2a74...ec7`](https://polygonscan.com/address/0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7) |
| ReputationScore | [`0x0350...d8`](https://polygonscan.com/address/0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8) |
| SlashingEngine | [`0xA64E...625`](https://polygonscan.com/address/0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625) |
| PaymentStreaming | [`0xb347...89`](https://polygonscan.com/address/0xb34717670889190B2A92E64B51e0ea696cE88D89) |
| AgentMarketplace | [`0xEAbf...6c`](https://polygonscan.com/address/0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c) |
| ActionVerifier | [`0x4638...57`](https://polygonscan.com/address/0x463856987bD9f3939DD52df52649e9B8Cb07B057) |
| XorbEscrow | [`0x4B89...1C`](https://polygonscan.com/address/0x4B8994De0A6f02014E71149507eFF6903367411C) |
| XorbPaymentSplitter | [`0xc038...c9`](https://polygonscan.com/address/0xc038C3116CD4997fF4C8f42b2d97effb023214c9) |

## Integrations

| Service | Role |
|---------|------|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain agent identity (Base) |
| [MoltGuard](https://api.moltrust.ch/guard/) | Trust scoring API (0-100) |
| [x402](https://x402.org) | Per-action USDC micropayments |
| Xorb Escrow | Native escrow on Polygon |

## Project Structure

```
├── api/index.ts              — Production API (Vercel serverless)
├── apps/
│   ├── dashboard/            — React dashboard
│   └── landing/              — Landing page (xorb.xyz)
├── packages/
│   ├── agent-core/           — Domain logic (pipeline, fees, reputation)
│   ├── xorb-sdk-ts/          — @xorb/sdk (npm)
│   ├── xorb-sdk-py/          — Python SDK
│   └── xorb-mcp/             — MCP server (10 tools)
├── xorb-contracts/           — 8 Solidity contracts
├── xorb-db/                  — Supabase migrations
└── docs/                     — Documentation (17 files)
```

## Development

```bash
pnpm install
pnpm dev              # Start API
pnpm test             # Run tests (63 total)
cd apps/dashboard && pnpm dev  # Start dashboard
```

## Links

| | URL |
|---|---|
| API | [api.xorb.xyz](https://api.xorb.xyz/v1/health) |
| Dashboard | [dashboard.xorb.xyz](https://dashboard.xorb.xyz) |
| Docs | [api.xorb.xyz/v1/docs](https://api.xorb.xyz/v1/docs) |
| Pricing | [api.xorb.xyz/v1/pricing](https://api.xorb.xyz/v1/pricing) |
| npm | [@xorb/sdk](https://www.npmjs.com/package/@xorb/sdk) |

## License

MIT — Fintex Australia Pty Ltd
