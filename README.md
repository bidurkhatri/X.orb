<div align="center">

# X.orb

### The orchestration layer for AI agent trust.

X.orb doesn't build trust infrastructure — it orchestrates it. One API call runs your agent's action through an 8-gate pipeline that checks identity (ERC-8004), permissions, rate limits, payments (x402), audit logging, trust scoring (AgentScore), execution, and escrow (PayCrow).

[![API](https://img.shields.io/badge/API-LIVE-22C55E?style=flat-square)](https://api.xorb.xyz/v1/health)
[![Dashboard](https://img.shields.io/badge/Dashboard-LIVE-0066FF?style=flat-square)](https://xorb-dashboard.vercel.app)
[![x402](https://img.shields.io/badge/x402-integrated-purple?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-integrated-orange?style=flat-square)](https://eips.ethereum.org/EIPS/eip-8004)
[![Base](https://img.shields.io/badge/Base-L2-0052FF?style=flat-square)](https://basescan.org)

</div>

---

## What X.orb Does

```
Your Agent → X.orb API → 8 Gates → Action Approved or Blocked
```

Every AI agent action passes through 8 sequential gates. If any gate fails, the action is blocked and the agent's trust score drops.

| Gate | What It Checks | Powered By |
|------|---------------|------------|
| 1. Identity | Is this agent registered on-chain? | **ERC-8004** IdentityRegistry on Base |
| 2. Permissions | Is this tool allowed for this agent's scope? | **X.orb** (unique) |
| 3. Rate Limit | Has the agent exceeded its hourly quota? | **X.orb** middleware |
| 4. Payment | Is an x402 payment attached? | **x402** protocol |
| 5. Audit Log | Record the action attempt | **X.orb** immutable log |
| 6. Trust Score | Does the agent's trust score allow this? | **AgentScore** API |
| 7. Execute | Run the action | **X.orb** |
| 8. Escrow | Is the payment escrowed safely? | **PayCrow** |

## Why X.orb Exists

The agent economy has identity (ERC-8004), payments (x402), trust scoring (AgentScore), and escrow (PayCrow). But nobody orchestrates them into a single security check.

**X.orb is the glue.** One API call, 8 gates, 4 integrations.

## Quick Start

### Register an agent

```bash
curl -X POST https://api.xorb.xyz/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-research-bot",
    "scope": "research",
    "sponsor_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
    "description": "Monitors whale wallets"
  }'
```

### Execute an action through the 8-gate pipeline

```bash
curl -X POST https://api.xorb.xyz/v1/actions/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_xxx",
    "action": "query",
    "tool": "get_balance",
    "params": { "address": "0x..." }
  }'
```

### Response (approved)

```json
{
  "action_id": "act_xxx",
  "agent_id": "agent_xxx",
  "approved": true,
  "gates": [
    { "gate": "identity", "passed": true, "source": "local + erc8004" },
    { "gate": "permissions", "passed": true, "scope": "research" },
    { "gate": "rate_limit", "passed": true, "used": 1, "limit": 120 },
    { "gate": "x402_payment", "passed": true, "protocol": "x402" },
    { "gate": "audit_log", "passed": true, "logged": true },
    { "gate": "trust_score", "passed": true, "source": "agentscore", "score": 72 },
    { "gate": "execute", "passed": true },
    { "gate": "escrow_check", "passed": true, "source": "paycrow" }
  ],
  "integrations_consulted": ["erc8004", "agentscore", "x402", "paycrow"],
  "latency_ms": 45
}
```

### Response (blocked)

```json
{
  "approved": false,
  "gates": [
    { "gate": "identity", "passed": true },
    { "gate": "permissions", "passed": false, "reason": "Tool \"swap\" not in scope \"research\"" }
  ]
}
```

## API Endpoints

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| GET | `/v1/health` | API status + integration health | Free |
| GET | `/v1/integrations` | List orchestrated services | Free |
| GET | `/v1/pricing` | Endpoint pricing | Free |
| POST | `/v1/agents` | Register agent (ERC-8004 lookup) | $0.10 |
| GET | `/v1/agents` | List agents | Free |
| GET | `/v1/agents/:id` | Agent details | Free |
| PATCH | `/v1/agents/:id` | Pause/resume | Free |
| DELETE | `/v1/agents/:id` | Revoke agent | Free |
| POST | `/v1/actions/execute` | **8-gate pipeline** | $0.005 |
| GET | `/v1/trust/:id` | Trust score (AgentScore + PayCrow) | $0.001 |

## Agent Scopes

Instead of rigid roles, X.orb uses **scopes** that define what tools an agent can access:

| Scope | Tools | Rate Limit |
|-------|-------|------------|
| `trading` | get_balance, fetch_market_data, swap, submit_transaction_proposal | 60/hr |
| `research` | get_balance, fetch_market_data, read_notes, search_files, query_chain | 120/hr |
| `monitoring` | get_balance, fetch_market_data, alert_user, subscribe_events | 300/hr |
| `coding` | read_file, write_file, search_files, run_tests, git_commit | 60/hr |
| `governance` | read_proposals, draft_proposal, vote, delegate | 30/hr |
| `general` | get_balance, fetch_market_data, read_notes | 60/hr |

## Integrations

X.orb orchestrates — it doesn't replace.

| Service | Role | Standard | Status |
|---------|------|----------|--------|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain agent identity | Ethereum EIP | Registry on Base |
| [AgentScore](https://agentscore.dev) | Trust scoring (0-100) | API | Integrated |
| [x402](https://x402.org) | Per-action micropayments | HTTP 402 | `@x402/hono` |
| [PayCrow](https://paycrow.xyz) | Escrow + dispute resolution | USDC | Integrated |

## Project Structure

```
x.orb/
├── api/index.ts              — Vercel serverless API (self-contained)
├── apps/
│   ├── api/                  — Full modular API (local dev)
│   └── dashboard/            — React dashboard (Liquid Glass UI)
├── packages/
│   ├── agent-core/           — Domain logic (8-gate pipeline)
│   ├── xorb-types/           — Shared TypeScript types
│   ├── xorb-sdk-ts/          — @xorb/sdk (TypeScript client)
│   ├── xorb-sdk-py/          — xorb-sdk (Python client)
│   └── xorb-mcp/             — @xorb/mcp (MCP server)
├── xorb-contracts/           — Solidity contracts (Base)
├── xorb-db/                  — Supabase tables
└── xorb-docs/                — Documentation
```

## Live URLs

| Service | URL |
|---------|-----|
| API | https://api.xorb.xyz |
| Dashboard | https://xorb-dashboard.vercel.app |
| Repo | https://github.com/bidurkhatri/X.orb |

## License

MIT — Fintex / Bidur
