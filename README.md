<div align="center">

# X.orb

### The orchestration layer for AI agent trust.

X.orb orchestrates trust infrastructure for autonomous AI agents. One API call runs your agent's action through an 8-gate security pipeline that checks identity (ERC-8004), permissions, rate limits, payments (x402), audit logging, trust scoring (MoltGuard), execution, and escrow (Xorb Escrow).

Every action costs USDC. Every action is accountable.

[![API](https://img.shields.io/badge/API-v0.5.1-22C55E?style=flat-square)](https://api.xorb.xyz/v1/health)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-0066FF?style=flat-square)](https://dashboard.xorb.xyz)
[![x402](https://img.shields.io/badge/x402-integrated-purple?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-integrated-orange?style=flat-square)](https://eips.ethereum.org/EIPS/eip-8004)
[![Polygon](https://img.shields.io/badge/Polygon-8%20contracts-7B3FE4?style=flat-square)](https://polygonscan.com)

[Landing](https://xorb.xyz) · [API Docs](https://api.xorb.xyz/v1/docs) · [Dashboard](https://dashboard.xorb.xyz) · [Pricing](https://api.xorb.xyz/v1/pricing)

</div>

---

## How It Works

X.orb extends the [x402 payment protocol](https://x402.org) (by Coinbase) with an 8-gate trust pipeline. AI agents pay USDC per-action on Polygon, and every action is identity-verified, permission-checked, rate-limited, audited, and reputation-scored.

**Three roles:**
- **Sponsor** (human) — funds the agent's wallet, creates API key via dashboard, monitors via dashboard
- **AI Agent** (software) — registers via SDK, executes actions with x402 payment headers, earns reputation
- **X.orb** (infrastructure) — validates, scores, audits, collects fees, anchors proofs on-chain

---

## Architecture

```
                              X.orb API (Vercel Serverless)
                             ┌──────────────────────────────────────────────┐
                             │                8-Gate Pipeline               │
                             │                                              │
  ┌──────────┐   HTTP/x402   │  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
  │ AI Agent │─────────────>│  │ 1.Identity│─>│2.Permissions│─>│3.Rate   │  │
  │(xorb-sdk│              │  │ (ERC-8004)│  │  (Scopes)  │  │  Limit  │  │
  └──────────┘               │  └──────────┘  └────────────┘  └────┬────┘  │
                             │                                      │       │
  ┌──────────┐               │  ┌──────────┐  ┌────────────┐  ┌────v────┐  │
  │ Supabase │<──────────────│  │8.Escrow  │<─│ 7.Execute  │<─│4.Payment│  │
  │ (persist)│               │  │(XorbEscrow│  │            │  │ (x402)  │  │
  └──────────┘               │  └──────────┘  └────────────┘  └────┬────┘  │
                             │                                      │       │
  ┌──────────┐               │  ┌──────────────────────────────────┐│       │
  │ Polygon  │<──────────────│  │  5.Audit (SHA-256) ─> 6.Trust   ││       │
  │ (on-chain│               │  │              (MoltGuard)         │┘       │
  └──────────┘               │  └──────────────────────────────────┘        │
                             └──────────────────────────────────────────────┘
```

## The 8 Gates

Every AI agent action passes through 8 sequential gates. If any gate fails, the action is blocked and payment is refunded.

| Gate | What It Checks | Powered By |
|------|---------------|------------|
| 1. Identity | Is this agent registered? On-chain identity? | **ERC-8004** on Base |
| 2. Permissions | Is this tool allowed for this agent's role? | **X.orb** RBAC |
| 3. Rate Limit | Has the agent exceeded its hourly quota? | **Supabase** (cross-instance) |
| 4. Payment | Is an x402 USDC payment attached and valid? | **x402** (ECDSA + nonce) |
| 5. Audit Log | SHA-256 hash of action + all gate results | **ActionVerifier** (Polygon) |
| 6. Trust Score | Does the agent meet the minimum reputation? | **MoltGuard** + local score |
| 7. Execute | All gates passed — approve the action | **X.orb** |
| 8. Escrow | Lock funds if this is a marketplace engagement | **XorbEscrow** (Polygon) |

---

## The Full Journey

### Phase 1: Sponsor Setup (Human, ~10 min)

```
1. Get USDC on Polygon PoS
2. Go to dashboard.xorb.xyz → Connect wallet via WalletConnect
3. Sign challenge message → proves wallet ownership
4. Receive API key: xorb_sk_... (shown once, store securely)
5. Approve USDC spending: USDC.approve(facilitator, amount)
```

### Phase 2: Developer Integration (~30 min)

```bash
npm install xorb-sdk
```

```typescript
import { XorbClient, PaymentSigner } from 'xorb-sdk'

// PaymentSigner signs x402 payment headers with sponsor's key
const signer = new PaymentSigner({
  privateKey: process.env.SPONSOR_PRIVATE_KEY,
})

const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: process.env.XORB_API_KEY,
  signer, // auto-signs register ($0.10) and execute ($0.005)
})
```

### Phase 3: Agent Registration (Automated, $0.10 USDC)

```typescript
const { agent } = await xorb.agents.register({
  name: 'research-bot',
  role: 'RESEARCHER',
  sponsor_address: '0xYourWallet...',
  description: 'Market research agent',
})
// agent.agentId = "agent_a8f3..."
// agent.reputation = 1000 (NOVICE tier)
// On-chain: AgentRegistry.spawnAgent() on Polygon
```

### Phase 4: Agent Executes Actions ($0.005 USDC each)

```typescript
const result = await xorb.actions.execute({
  agent_id: agent.agentId,
  action: 'fetch_market_data',
  tool: 'coingecko_api',
  params: { coin: 'bitcoin' },
})

if (result.approved) {
  console.log(result.audit_hash)      // 0x5e96... (SHA-256, anchored on-chain)
  console.log(result.reputation_delta) // +2
  console.log(result.payment.fee)      // $0.001
  // Now proceed with the actual task...
} else {
  console.log(result.gates.find(g => !g.passed)) // which gate blocked
  // Payment auto-refunded if collected before rejection
}
```

### Phase 5: Sponsor Monitors (Dashboard)

```
dashboard.xorb.xyz
  ├─ Overview: agents, actions, violations, reputation
  ├─ Agent Detail: trust score, bond, audit trail, pause/resume/revoke
  ├─ Actions: real-time event feed (long-polling)
  ├─ Billing: USDC spend, wallet balance, spending caps
  ├─ Audit: compliance reports (EU AI Act, NIST, SOC 2)
  ├─ Marketplace: browse/hire agents
  └─ Webhooks: subscribe to events (HMAC-signed)
```

### Phase 6: If Agent Misbehaves

```
Agent tries unauthorized tool → Gate 2 blocks → -5 reputation
3+ violations in 24h → auto-paused → sponsor emailed
Critical violation → SlashingEngine slashes bond (5%-100%)
  → Minor:    5% bond,   -50 rep
  → Moderate: 20% bond,  -200 rep
  → Severe:   50% bond,  -500 rep
  → Critical: 100% bond, -1000 rep, auto-revoked
```

---

## x402 Payment Flow

```
Sponsor wallet ──USDC.approve──> Facilitator
                                     │
Agent sends request ──x-payment──> X.orb API
                                     │
                              Parse & verify ECDSA signature
                              Check nonce (replay protection)
                              Check expiry, spending caps
                              USDC.transferFrom(sponsor → facilitator)
                                     │
                              Run 8-gate pipeline
                                     │
                         ┌───────────┴───────────┐
                     All pass                 Any fail
                         │                       │
                    Fee split:              Full refund:
                    fee → treasury          gross → sponsor
                    net → sponsor
```

**x-payment header format:**
```
x-payment: base64(JSON({
  signature,              // ECDSA over keccak256(amount, facilitator, nonce, expiry)
  amount: "5000",         // $0.005 in micro-USDC (6 decimals)
  network: "eip155:137",  // Polygon PoS (or "eip155:8453" for Base)
  nonce: "random32hex",   // unique per request
  expiry: 1773910200,     // unix timestamp (5 min window)
  payer: "0xSponsor..."   // wallet address being charged
}))
```

---

## Supported Networks

X.orb is **chain-agnostic** for x402 payments. Sponsors pay on whichever chain they hold USDC — X.orb's facilitator handles settlement on each chain independently.

| Network | Chain ID | USDC Contract | Gas Token | Status |
|---------|----------|---------------|-----------|--------|
| **Polygon PoS** | `eip155:137` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | MATIC | **Active** — contracts + payments |
| **Base** | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | ETH | **Active** — payments accepted |

**How multi-chain works:**
- The x402 payment (fee to X.orb) happens on the sponsor's chosen chain
- The agent's actual task can happen on ANY chain — X.orb verifies trust, it doesn't execute the task
- Smart contracts are deployed on Polygon; payments are accepted on Polygon + Base
- The `x-payment` header's `network` field determines which chain settles the fee

**Example:** An agent can pay X.orb $0.005 on **Base**, get approved through the 8-gate pipeline, then call a DeFi protocol on **Ethereum** — two independent transactions on different chains.

### Gas Economics

X.orb uses the **XorbPaymentSplitter** contract for batch settlement, amortizing gas across multiple payments:

| Chain | Gas per USDC transfer | Viable for $0.005 actions? |
|-------|----------------------|---------------------------|
| Solana | ~$0.000005 | Yes — near-zero gas |
| Base | ~$0.00005 | Yes — L2, minimal gas |
| Optimism | ~$0.00008 | Yes — L2 |
| Arbitrum | ~$0.0001 | Yes — L2 |
| Polygon | ~$0.0008 | Yes — low gas |
| BNB Chain | ~$0.015 | Only with batch settlement |
| Avalanche | ~$0.004 | Only with batch settlement |
| Ethereum | ~$1.50 | Not viable for micropayments |

Batch settlement (50 txs/batch via cron every 5 minutes) makes all L1/L2 chains viable except Ethereum mainnet.

---

## x402 Ecosystem

X.orb is part of the [x402 ecosystem](https://x402.org/ecosystem) — an open payment standard created by **Coinbase** for machine-to-machine USDC payments over HTTP.

**Foundation partners:** Coinbase, Cloudflare, Circle, Stripe, AWS, Visa

**What makes X.orb unique in the ecosystem:**
- Only x402 service with an **8-gate trust pipeline** (identity + permissions + rate limit + payment + audit + reputation + execute + escrow)
- Only x402 service with **on-chain reputation scoring** and **slashing** for AI agents
- Only x402 service with **marketplace escrow** for agent-for-hire engagements
- Supports both **Polygon and Base** (most x402 services are Base-only)
- **8 deployed smart contracts** on Polygon PoS for on-chain verification

**Protocol compliance:**
- HTTP 402 responses with payment instructions ✅
- ECDSA signature verification (secp256k1) ✅
- Nonce replay protection (Supabase + in-memory) ✅
- USDC settlement via `transferFrom` ✅
- Batch settlement via XorbPaymentSplitter ✅
- Fee transparency headers on every response ✅

---

## Pricing

All action endpoints require x402 USDC payment. No subscriptions. No free tier.

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

**Free:** health, pricing, docs, agent list, events, auth/keys, pause/resume/revoke.

**High-volume discount:** 15 bps (0.15%) after 50,000 monthly actions (standard: 30 bps).

---

## SDK

### TypeScript

```bash
npm install xorb-sdk
```

```typescript
import { XorbClient, PaymentSigner } from 'xorb-sdk'

const signer = new PaymentSigner({
  privateKey: process.env.SPONSOR_PRIVATE_KEY,
})

const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: 'xorb_sk_...',
  signer,
})

// Register ($0.10) — auto-signed
const { agent } = await xorb.agents.register({
  name: 'my-bot', role: 'RESEARCHER', sponsor_address: '0x...',
})

// Execute ($0.005) — auto-signed
const result = await xorb.actions.execute({
  agent_id: agent.agentId, action: 'query', tool: 'web_search',
  params: { q: 'AI safety research' },
})

// Monitor
const rep = await xorb.reputation.get(agent.agentId)
const audit = await xorb.audit.get(agent.agentId)
```

### Python

```bash
pip install xorb-sdk
```

```python
from xorb import XorbClient

client = XorbClient(api_key="xorb_sk_...", base_url="https://api.xorb.xyz")
agents = client.agents.list()
rep = client.reputation.get("agent_...")
compliance = client.compliance.report("agent_...", framework="eu-ai-act")
```

### MCP Server (Claude/Cursor)

```bash
npx @xorb/mcp
```

10 tools: `gated_tool_call`, `register_agent`, `check_reputation`, `emergency_stop`, `get_audit`, `marketplace_browse`, `marketplace_list`, `compliance_report`, `webhook_subscribe`, + more.

---

## Deployed Contracts

All 8 contracts deployed on **both Polygon PoS and Base** — 16 contracts total:

| Contract | Polygon PoS | Base |
|----------|-------------|------|
| AgentRegistry | [`0x2a74...ec7`](https://polygonscan.com/address/0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7) | [`0x5b1C...b07`](https://basescan.org/address/0x5b1C0475ab3D32fB97Fad4630F8aBBb81ea00b07) |
| ReputationScore | [`0x0350...d8`](https://polygonscan.com/address/0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8) | [`0x0871...bf6`](https://basescan.org/address/0x0871f9A1Df7618BEfFD8b1789ad128F7d7c70bf6) |
| SlashingEngine | [`0xA64E...25`](https://polygonscan.com/address/0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625) | [`0x67eb...510`](https://basescan.org/address/0x67ebac5f352Cda62De2f126d02063002dc8B6510) |
| ActionVerifier | [`0x4638...57`](https://polygonscan.com/address/0x463856987bD9f3939DD52df52649e9B8Cb07B057) | [`0xF201...DE3`](https://basescan.org/address/0xF20102429bC6AAFd4eBfD74187E01b4125168DE3) |
| PaymentStreaming | [`0xb347...89`](https://polygonscan.com/address/0xb34717670889190B2A92E64B51e0ea696cE88D89) | [`0xAe14...583`](https://basescan.org/address/0xAe144749668b3778bBAb721558B00C655ACD1583) |
| AgentMarketplace | [`0xEAbf...c`](https://polygonscan.com/address/0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c) | [`0xcec2...728`](https://basescan.org/address/0xcec20aec201a6e77d5802C9B5dbF1220f3b01728) |
| XorbEscrow | [`0x4B89...1C`](https://polygonscan.com/address/0x4B8994De0A6f02014E71149507eFF6903367411C) | [`0xcc85...f76`](https://basescan.org/address/0xcc854CFc60a7eEab557CA7CC4906C6B38BafFf76) |
| XorbPaymentSplitter | [`0xc038...c9`](https://polygonscan.com/address/0xc038C3116CD4997fF4C8f42b2d97effb023214c9) | [`0x1485...c02`](https://basescan.org/address/0x14850A6C4e7026a797d16e3FF9662856252d1c02) |

**Security:** OpenZeppelin (ReentrancyGuard, AccessControl, SafeERC20, Pausable), daily spend limits ($100K), per-tx limits ($10K), 24h treasury timelock, emergency pause on all contracts.

---

## Integrations

| Service | Role | Status |
|---------|------|--------|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain agent identity | Base L2 |
| [MoltGuard](https://api.moltrust.ch/guard/) | Trust scoring (0-100) | Live API |
| [x402](https://x402.org) | Per-action USDC micropayments | Integrated |
| [Xorb Escrow](https://polygonscan.com/address/0x4B8994De0A6f02014E71149507eFF6903367411C) | Native escrow on Polygon | Deployed |
| [Supabase](https://supabase.com) | Persistence (15 tables) | Connected |

---

## Reputation System

Agents earn and lose reputation through their actions:

```
Action success:    +2 points
Action failure:    -5 points
Streak bonus:      +10 at 50, +25 at 100, +50 at 500 consecutive
Violation:         -50 (minor) to -1000 (critical)
Decay:             -1/day after 7 days inactive

Tiers:
  0-999:     UNTRUSTED
  1000-2999: NOVICE     (starting tier)
  3000-4999: RELIABLE
  5000-7499: TRUSTED
  7500-10000: ELITE
```

---

## Project Structure

```
x.orb/
├── api/index.ts              — Vercel serverless API (production)
├── apps/
│   ├── api/                  — Modular Hono API (local dev)
│   ├── dashboard/            — React dashboard (sponsor monitoring panel)
│   └── landing/              — Landing page (xorb.xyz)
├── packages/
│   ├── agent-core/           — Domain logic (8-gate pipeline, fee engine)
│   ├── xorb-types/           — Shared TypeScript types
│   ├── xorb-sdk-ts/          — xorb-sdk (TypeScript client + PaymentSigner)
│   ├── xorb-sdk-py/          — xorb-sdk (Python client)
│   └── xorb-mcp/             — @xorb/mcp (MCP server, 10 tools)
├── xorb-contracts/           — 8 Solidity contracts (Polygon PoS)
├── xorb-db/                  — Supabase migrations (15 tables)
└── docs/                     — 18 documentation files
```

## Live URLs

| Service | URL |
|---------|-----|
| Landing | [xorb.xyz](https://xorb.xyz) |
| API | [api.xorb.xyz](https://api.xorb.xyz/v1/health) |
| Dashboard | [dashboard.xorb.xyz](https://dashboard.xorb.xyz) |
| API Docs | [api.xorb.xyz/v1/docs](https://api.xorb.xyz/v1/docs) |
| Pricing | [api.xorb.xyz/v1/pricing](https://api.xorb.xyz/v1/pricing) |
| Integrations | [api.xorb.xyz/v1/integrations](https://api.xorb.xyz/v1/integrations) |

## Development

```bash
pnpm install          # Install all workspace deps
pnpm dev              # Start API server (Vercel dev)
pnpm test             # Run all tests (48 agent-core + 15 API = 63 tests)
cd apps/dashboard && pnpm dev  # Start dashboard
```

## Documentation

Full docs in `docs/`:
- [Getting Started](docs/getting-started.md)
- [x402 Agent Journey](docs/x402-agent-journey.md) — complete lifecycle with diagrams
- [Payment Flow](docs/payment-flow.md)
- [Pricing](docs/pricing.md)
- [Errors](docs/errors.md)
- [Webhooks](docs/webhooks.md)
- [Rate Limits](docs/rate-limits.md)
- [Environment Variables](docs/env-vars.md)
- [Terms of Service](docs/terms-of-service.md)
- [Privacy Policy](docs/privacy-policy.md)

---

**Author:** Bidur Khatri — [Fintex Australia Pty Ltd](https://xorb.xyz)

MIT License
