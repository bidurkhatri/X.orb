<div align="center">

# Xorb

### The logic gate between AI agents and the real world.

Every AI agent action — validated, bonded, and auditable — in a single API call.

Xorb is an API middleware that interposes an 8-gate security pipeline between autonomous AI agents and the tools they use. Agents post USDC bonds. Violations trigger automated slashing. Reputation is portable. Payments settle per-action via the x402 protocol. No tokens. No speculation. Just infrastructure.

[![Build](https://img.shields.io/github/actions/workflow/status/xorb-xyz/xorb/ci.yml?branch=main&style=flat-square&label=build)](https://github.com/xorb-xyz/xorb/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.9.0-green?style=flat-square)](https://github.com/xorb-xyz/xorb/releases)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen?style=flat-square)](#testing)
[![npm](https://img.shields.io/npm/v/@xorb/sdk?style=flat-square&label=npm)](https://www.npmjs.com/package/@xorb/sdk)
[![PyPI](https://img.shields.io/pypi/v/xorb-sdk?style=flat-square&label=pypi)](https://pypi.org/project/xorb-sdk/)
[![x402](https://img.shields.io/badge/x402-compatible-purple?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-compatible-orange?style=flat-square)](https://eips.ethereum.org/EIPS/eip-8004)
[![Base](https://img.shields.io/badge/Base-mainnet-0052FF?style=flat-square)](https://basescan.org)
[![Discord](https://img.shields.io/discord/1234567890?style=flat-square&label=discord&color=5865F2)](https://discord.gg/xorb)

</div>

---

```mermaid
flowchart LR
    A["Developer's Agent"] --> B["Xorb API"]
    B --> C["Gate 1\nRole Check"]
    C --> D["Gate 2\nRate Limit"]
    D --> E["Gate 3\nSpend Limit"]
    E --> F["Gate 4\nScope Boundary"]
    F --> G["Gate 5\nAudit Log"]
    G --> H["Gate 6\nHuman Override"]
    H --> I["Gate 7\nTime Sandbox"]
    I --> J["Gate 8\nReputation Gate"]

    J -->|All Pass| K["Action Approved"]
    J -->|Any Fail| L["Action Blocked"]

    K --> M["Reputation +"]
    K --> N["Audit Hash\nSHA-256"]
    N --> O["On-Chain\nAnchor"]
    K --> P["Webhook\nNotification"]

    L --> Q["Reputation -"]
    L --> R["Violation\nRecorded"]
    R --> S["Bond\nSlashed"]
    L --> T["Webhook\nNotification"]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#16213e,stroke:#0f3460,color:#fff
    style C fill:#0f3460,stroke:#533483,color:#fff
    style D fill:#0f3460,stroke:#533483,color:#fff
    style E fill:#0f3460,stroke:#533483,color:#fff
    style F fill:#0f3460,stroke:#533483,color:#fff
    style G fill:#0f3460,stroke:#533483,color:#fff
    style H fill:#0f3460,stroke:#533483,color:#fff
    style I fill:#0f3460,stroke:#533483,color:#fff
    style J fill:#0f3460,stroke:#533483,color:#fff
    style K fill:#0d7377,stroke:#14ffec,color:#fff
    style L fill:#e94560,stroke:#ff6b6b,color:#fff
    style M fill:#0d7377,stroke:#14ffec,color:#fff
    style N fill:#533483,stroke:#7c3aed,color:#fff
    style O fill:#533483,stroke:#7c3aed,color:#fff
    style P fill:#16213e,stroke:#0f3460,color:#fff
    style Q fill:#e94560,stroke:#ff6b6b,color:#fff
    style R fill:#e94560,stroke:#ff6b6b,color:#fff
    style S fill:#e94560,stroke:#ff6b6b,color:#fff
    style T fill:#16213e,stroke:#0f3460,color:#fff
```

---

## Table of Contents

- [The Problem](#the-problem)
- [Quick Start](#quick-start)
- [The 8-Gate Security Pipeline](#the-8-gate-security-pipeline)
- [Agent Identity & Profiles](#agent-identity--profiles)
- [Reputation System](#reputation-system)
- [Economic Accountability](#economic-accountability)
- [x402 Payment Integration](#x402-payment-integration)
- [Marketplace with Escrow](#marketplace-with-escrow)
- [Compliance & Audit Reporting](#compliance--audit-reporting)
- [MCP Security Middleware](#mcp-security-middleware)
- [System Architecture](#system-architecture)
- [API Reference](#api-reference)
- [SDK Reference](#sdk-reference)
- [Smart Contracts Reference](#smart-contracts-reference)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Ecosystem](#ecosystem)
- [Business Model](#business-model)
- [Comparison](#comparison)
- [Contributing](#contributing)
- [License & Legal](#license--legal)
- [Links & Contact](#links--contact)

---

## The Problem

AI agents are entering production. Not as chatbot wrappers — as autonomous systems that move money, write code, access databases, send emails, and make decisions without a human in the loop. In 2025 alone, Y Combinator's Spring batch was over 50% agentic AI companies. Every one of them ships agents that call tools, spend budgets, and operate on behalf of users.

There is no standard infrastructure for making these agents accountable.

The security surface is growing faster than the defenses. In Q4 2025, researchers documented the first wave of agent-specific attack vectors: indirect prompt injection through tool outputs, MCP skill chain exploitation (over 25% of public MCP skills were found to contain at least one exploitable vulnerability), and cross-agent privilege escalation in multi-agent orchestration frameworks. These are not theoretical — they resulted in unauthorized fund transfers, data exfiltration, and resource exhaustion in production deployments.

Regulation is arriving. The EU AI Act mandates human oversight mechanisms, comprehensive audit trails, and risk classification for high-risk AI systems. Article 14 requires that high-risk AI systems be designed to allow effective human oversight during their period of use. No existing agent framework — LangChain, CrewAI, AutoGen, or any other — provides this natively. Developers are left to build their own compliance layers from scratch, for every deployment.

> **The current approach:** developers cobble together authentication (one service), rate limiting (another service), logging (a third), permissions (hand-coded), spending controls (custom logic), human-in-the-loop (a Slack webhook), and reputation (nothing — it doesn't exist). Five to seven separate tools, no coordination between them, no economic consequences for violations, no portable identity, and no compliance story. For every single agent deployment. Repeated across thousands of teams.

What's missing is a single middleware layer that handles identity, permissions, rate limiting, spending controls, audit logging, human-in-the-loop approval, time-based access, reputation scoring, economic bonding, and compliance reporting — in one API call, with real financial consequences for violations.

That's Xorb.

```mermaid
flowchart TB
    subgraph before["Before Xorb"]
        direction TB
        BA["Your Agent"] --> B1["Auth Service\n(Auth0, Clerk)"]
        BA --> B2["Rate Limiter\n(Redis, Upstash)"]
        BA --> B3["Logging\n(Datadog, Sentry)"]
        BA --> B4["Permissions\n(Hand-coded)"]
        BA --> B5["Spending Caps\n(Custom logic)"]
        BA --> B6["Human Approval\n(Slack webhook)"]
        BA --> B7["Reputation\n(Does not exist)"]
        BA --> B8["Economic Bond\n(Does not exist)"]
        BA --> B9["Compliance\n(Does not exist)"]

        B1 -.->|"No coordination"| B2
        B2 -.->|"No coordination"| B3
        B3 -.->|"No coordination"| B4

        style B7 fill:#e94560,stroke:#ff6b6b,color:#fff
        style B8 fill:#e94560,stroke:#ff6b6b,color:#fff
        style B9 fill:#e94560,stroke:#ff6b6b,color:#fff
    end

    subgraph after["After Xorb"]
        direction TB
        AA["Your Agent"] -->|"Single API call"| XA["Xorb API"]
        XA --> XP["8-Gate Pipeline\n< 50ms p95"]
        XP --> XR["Identity + Reputation\nPortable via ERC-8004"]
        XP --> XB["USDC Bond\nReal economic stake"]
        XP --> XC["Compliance Report\nEU AI Act / NIST / SOC 2"]
        XP --> XH["Audit Hash\nOn-chain anchored"]
    end

    style before fill:#1a1a2e,stroke:#333,color:#fff
    style after fill:#0d1117,stroke:#0d7377,color:#fff
    style XA fill:#0f3460,stroke:#533483,color:#fff
    style XP fill:#0d7377,stroke:#14ffec,color:#fff
    style BA fill:#1a1a2e,stroke:#e94560,color:#fff
    style AA fill:#1a1a2e,stroke:#14ffec,color:#fff
```

---

## Quick Start

### TypeScript

```bash
npm install @xorb/sdk
```

```typescript
import { XorbClient } from "@xorb/sdk";

const xorb = new XorbClient({
  baseUrl: "https://api.xorb.xyz",
  privateKey: process.env.WALLET_PRIVATE_KEY,
  chain: "base",
});

// Register an agent with a 50 USDC bond
const agent = await xorb.agents.register({
  name: "research-agent-01",
  role: "researcher",
  capabilities: ["web_search", "file_read", "api_call"],
  bondAmountUsdc: 50,
});

// Execute an action through the 8-gate pipeline
const result = await xorb.actions.execute({
  agentId: agent.id,
  action: "web_search",
  params: { query: "latest ETH gas prices" },
  metadata: { source: "market-monitor", priority: "normal" },
});

console.log(result.approved);        // true
console.log(result.gateResults);     // { roleCheck: 'pass', rateLimit: 'pass', ... }
console.log(result.reputationDelta); // +5
console.log(result.auditHash);      // 'sha256:a1b2c3d4...'
console.log(result.latencyMs);      // 34
```

### Python

```bash
pip install xorb-sdk
```

```python
import os
from xorb_sdk import XorbClient

xorb = XorbClient(
    base_url="https://api.xorb.xyz",
    private_key=os.environ["WALLET_PRIVATE_KEY"],
    chain="base",
)

# Register an agent with a 50 USDC bond
agent = await xorb.agents.register(
    name="research-agent-01",
    role="researcher",
    capabilities=["web_search", "file_read", "api_call"],
    bond_amount_usdc=50,
)

# Execute an action through the 8-gate pipeline
result = await xorb.actions.execute(
    agent_id=agent.id,
    action="web_search",
    params={"query": "latest ETH gas prices"},
    metadata={"source": "market-monitor", "priority": "normal"},
)

print(result.approved)         # True
print(result.gate_results)     # {'role_check': 'pass', 'rate_limit': 'pass', ...}
print(result.reputation_delta) # 5
print(result.audit_hash)       # 'sha256:a1b2c3d4...'
```

### cURL

```bash
# Register an agent
curl -X POST https://api.xorb.xyz/agents \
  -H "Authorization: Bearer siwe_0x..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "research-agent-01",
    "role": "researcher",
    "capabilities": ["web_search", "file_read", "api_call"],
    "bondAmountUsdc": 50
  }'

# Execute an action through the 8-gate pipeline
curl -X POST https://api.xorb.xyz/actions/execute \
  -H "Authorization: Bearer siwe_0x..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_01HXYZ...",
    "action": "web_search",
    "params": { "query": "latest ETH gas prices" }
  }'
```

### Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: "3.9"
services:
  xorb-api:
    image: ghcr.io/xorb-xyz/xorb-api:latest
    ports:
      - "3400:3400"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/xorb
      - REDIS_URL=redis://redis:6379
      - CHAIN_RPC_URL=https://mainnet.base.org
      - X402_FACILITATOR_URL=https://x402.org/facilitator
      - USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    depends_on:
      - db
      - redis

  db:
    image: supabase/postgres:15.1.1.61
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=xorb
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

```bash
docker compose up -d
# API available at http://localhost:3400
# Health check: curl http://localhost:3400/health
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (Supabase) |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis for reputation cache and rate limiting |
| `CHAIN_RPC_URL` | Yes | — | Base mainnet RPC endpoint |
| `POLYGON_RPC_URL` | No | — | Polygon PoS RPC (for cross-chain support) |
| `X402_FACILITATOR_URL` | Yes | `https://x402.org/facilitator` | Coinbase x402 payment facilitator |
| `USDC_CONTRACT` | Yes | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC contract address on Base |
| `WEBHOOK_SIGNING_SECRET` | No | — | HMAC secret for webhook signature verification |
| `SENTRY_DSN` | No | — | Error tracking |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |

### Free Tier

**1,000 gate checks/month. 5 agents. No credit card required.**

Sign up at [dashboard.xorb.xyz](https://dashboard.xorb.xyz) with your wallet, or start making API calls — the x402 payment flow handles everything else.

---

## The 8-Gate Security Pipeline

The pipeline is the core product. Every agent action passes through 8 sequential validation gates before execution. If any gate fails, the action is blocked, a violation is recorded, reputation is deducted, and the sponsoring wallet is notified via webhook.

Target latency: **< 50ms p95** for the full pipeline.

```mermaid
flowchart TD
    REQ["Incoming Action Request\n{agentId, action, params}"] --> G1

    G1{"Gate 1: Role Check\nIs this action allowed\nfor this agent's role?"}
    G1 -->|Pass| G2
    G1 -->|Fail| BLOCK

    G2{"Gate 2: Rate Limit\nHas the agent exceeded\nits hourly action limit?"}
    G2 -->|Pass| G3
    G2 -->|Fail| BLOCK

    G3{"Gate 3: Spend Limit\nDoes this action exceed\nthe per-action spending cap?"}
    G3 -->|Pass| G4
    G3 -->|Fail| BLOCK

    G4{"Gate 4: Scope Boundary\nIs the agent operating within\nits defined permission scope?"}
    G4 -->|Pass| G5
    G4 -->|Fail| BLOCK

    G5["Gate 5: Audit Log\nRecord the action attempt\n(always runs, never blocks)"]
    G5 --> G6

    G6{"Gate 6: Human Override\nDoes this action require\nsponsor approval?"}
    G6 -->|Pass / Pre-approved| G7
    G6 -->|Pending Approval| PEND["Queued for\nHuman Review"]
    G6 -->|Denied| BLOCK

    G7{"Gate 7: Time Sandbox\nIs the agent's access\npolicy still valid?"}
    G7 -->|Pass| G8
    G7 -->|Fail| BLOCK

    G8{"Gate 8: Reputation Gate\nDoes the agent's reputation\ntier allow this action?"}
    G8 -->|Pass| APPROVE
    G8 -->|Fail| BLOCK

    APPROVE["Action Approved"]
    APPROVE --> REP_UP["Reputation +\n(action-weighted)"]
    APPROVE --> HASH["Audit Hash\nSHA-256"]
    APPROVE --> WEBHOOK_OK["Webhook:\naction.approved"]
    HASH --> ANCHOR["On-Chain Anchor\n(batched)"]

    BLOCK["Action Blocked"]
    BLOCK --> REP_DOWN["Reputation -\n(severity-weighted)"]
    BLOCK --> VIOLATION["Violation Recorded\n+ Slash Evaluation"]
    BLOCK --> WEBHOOK_FAIL["Webhook:\naction.blocked"]

    style REQ fill:#1a1a2e,stroke:#e94560,color:#fff
    style G1 fill:#0f3460,stroke:#533483,color:#fff
    style G2 fill:#0f3460,stroke:#533483,color:#fff
    style G3 fill:#0f3460,stroke:#533483,color:#fff
    style G4 fill:#0f3460,stroke:#533483,color:#fff
    style G5 fill:#533483,stroke:#7c3aed,color:#fff
    style G6 fill:#0f3460,stroke:#533483,color:#fff
    style G7 fill:#0f3460,stroke:#533483,color:#fff
    style G8 fill:#0f3460,stroke:#533483,color:#fff
    style APPROVE fill:#0d7377,stroke:#14ffec,color:#fff
    style BLOCK fill:#e94560,stroke:#ff6b6b,color:#fff
    style PEND fill:#f59e0b,stroke:#d97706,color:#000
    style REP_UP fill:#0d7377,stroke:#14ffec,color:#fff
    style REP_DOWN fill:#e94560,stroke:#ff6b6b,color:#fff
    style HASH fill:#533483,stroke:#7c3aed,color:#fff
    style ANCHOR fill:#533483,stroke:#7c3aed,color:#fff
    style VIOLATION fill:#e94560,stroke:#ff6b6b,color:#fff
    style WEBHOOK_OK fill:#16213e,stroke:#0f3460,color:#fff
    style WEBHOOK_FAIL fill:#16213e,stroke:#0f3460,color:#fff
```

### Gate Details

| Gate | Checks | Input Data | On Pass | On Fail | Typical Latency |
|------|--------|------------|---------|---------|-----------------|
| **1. Role Check** | Action is in the agent's role-allowed action set | `agent.role`, `action.type` | Continue | Block + `role_violation` | < 1ms |
| **2. Rate Limit** | Agent has not exceeded hourly action quota | `agent.id`, sliding window counter | Continue | Block + `rate_limit_exceeded` | < 2ms |
| **3. Spend Limit** | Action cost does not exceed per-action cap | `action.estimatedCostUsdc`, `agent.spendLimitUsdc` | Continue | Block + `spend_limit_exceeded` | < 1ms |
| **4. Scope Boundary** | Target resource is within agent's scope | `action.target`, `agent.scope` | Continue | Block + `scope_violation` | < 2ms |
| **5. Audit Log** | (Always passes) Records attempt | Full action payload | Continue (always) | Never fails | < 3ms |
| **6. Human Override** | Action category does not require human approval, or approval already granted | `action.type`, `agent.humanOverrideRules` | Continue | Queue for review or block | < 5ms |
| **7. Time Sandbox** | Agent's access policy has not expired | `agent.accessPolicy.expiresAt`, `now()` | Continue | Block + `access_expired` | < 1ms |
| **8. Reputation Gate** | Agent's reputation tier meets minimum for this action | `agent.reputationTier`, `action.minimumTier` | Continue | Block + `reputation_insufficient` | < 2ms |

### Approved Response

```json
{
  "id": "act_01HXZ3K9V2MNTQWER5678ABCDE",
  "agentId": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
  "action": "web_search",
  "approved": true,
  "gateResults": {
    "roleCheck": { "status": "pass", "latencyMs": 0.8 },
    "rateLimit": { "status": "pass", "remaining": 47, "resetAt": "2026-03-16T15:00:00Z", "latencyMs": 1.2 },
    "spendLimit": { "status": "pass", "estimatedCostUsdc": 0.002, "remainingBudgetUsdc": 149.98, "latencyMs": 0.5 },
    "scopeBoundary": { "status": "pass", "latencyMs": 1.1 },
    "auditLog": { "status": "recorded", "auditId": "aud_01HXZ3K9V2...", "latencyMs": 2.8 },
    "humanOverride": { "status": "pass", "reason": "action_type_not_restricted", "latencyMs": 0.3 },
    "timeSandbox": { "status": "pass", "expiresAt": "2026-04-16T00:00:00Z", "latencyMs": 0.4 },
    "reputationGate": { "status": "pass", "currentTier": "reliable", "requiredTier": "novice", "latencyMs": 1.5 }
  },
  "reputationDelta": 5,
  "newReputationScore": 3405,
  "auditHash": "sha256:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "onChainAnchorStatus": "queued",
  "latencyMs": 34,
  "timestamp": "2026-03-16T14:23:45.123Z"
}
```

### Blocked Response

```json
{
  "id": "act_01HXZ4M8N3PQRSTU9012VWXYZ",
  "agentId": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
  "action": "fund_transfer",
  "approved": false,
  "blockedByGate": "spendLimit",
  "gateResults": {
    "roleCheck": { "status": "pass", "latencyMs": 0.7 },
    "rateLimit": { "status": "pass", "remaining": 46, "resetAt": "2026-03-16T15:00:00Z", "latencyMs": 1.1 },
    "spendLimit": {
      "status": "fail",
      "reason": "Action cost $500.00 exceeds per-action cap of $100.00",
      "estimatedCostUsdc": 500.00,
      "spendLimitUsdc": 100.00,
      "latencyMs": 0.6
    },
    "scopeBoundary": { "status": "skipped" },
    "auditLog": { "status": "recorded", "auditId": "aud_01HXZ4M8N3...", "latencyMs": 2.5 },
    "humanOverride": { "status": "skipped" },
    "timeSandbox": { "status": "skipped" },
    "reputationGate": { "status": "skipped" }
  },
  "reputationDelta": -100,
  "newReputationScore": 3305,
  "violationId": "vio_01HXZ4M8N3PQRSTU9012ABCDE",
  "violationSeverity": "minor",
  "slashAmountUsdc": 2.50,
  "latencyMs": 12,
  "timestamp": "2026-03-16T14:24:01.456Z"
}
```

<details>
<summary>Gate configuration example (per-agent)</summary>

```json
{
  "agentId": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
  "gateConfig": {
    "roleCheck": {
      "allowedActions": ["web_search", "file_read", "api_call", "data_analysis"],
      "deniedActions": ["fund_transfer", "contract_deploy", "admin_access"]
    },
    "rateLimit": {
      "maxActionsPerHour": 60,
      "burstLimit": 10,
      "burstWindowSeconds": 60
    },
    "spendLimit": {
      "perActionCapUsdc": 100.00,
      "dailyCapUsdc": 1000.00,
      "monthlyCapUsdc": 10000.00
    },
    "scopeBoundary": {
      "allowedDomains": ["api.coingecko.com", "etherscan.io"],
      "allowedContracts": ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
      "deniedResources": ["/admin/*", "/internal/*"]
    },
    "humanOverride": {
      "requireApprovalFor": ["fund_transfer", "contract_deploy"],
      "autoApproveBelow": 10.00,
      "approvalTimeoutMinutes": 60,
      "defaultOnTimeout": "block"
    },
    "timeSandbox": {
      "accessPolicy": "time_limited",
      "expiresAt": "2026-04-16T00:00:00Z",
      "allowedHours": { "start": 9, "end": 17, "timezone": "America/New_York" }
    },
    "reputationGate": {
      "minimumTier": "novice",
      "highValueActionMinimumTier": "trusted",
      "highValueThresholdUsdc": 50.00
    }
  }
}
```

</details>

---

## Agent Identity & Profiles

Every agent registered on Xorb gets a structured identity — a persistent, queryable profile that follows the agent across platforms. Think of it as a credit bureau for AI agents.

```mermaid
flowchart TB
    subgraph profile["Agent Profile"]
        direction TB

        subgraph core["Core Identity"]
            CR["Creation Record\n- Created at, method\n- Sponsor wallet\n- Registration tx hash"]
            CM["Capability Manifest\n- Allowed actions\n- Tool access list\n- Resource scopes"]
            VS["Verification Status\n- Level 0-4\n- Verification method\n- Last verified at"]
        end

        subgraph history["Track Record"]
            RH["Reputation History\n- Score over time\n- Tier transitions\n- Decay events"]
            VR["Violation Records\n- Type, severity\n- Slash amounts\n- Remediation status"]
            EH["Employment History\n- Engagements\n- Ratings received\n- Tasks completed"]
        end

        subgraph financial["Financial Profile"]
            BD["Bond Status\n- Amount deposited\n- Amount slashed\n- Current balance"]
            EA["Earnings\n- Lifetime USDC earned\n- Active streams\n- Pending escrow"]
            SP["Spending\n- Total USDC spent\n- Average per action\n- Budget utilization"]
        end

        subgraph access["Access and Activity"]
            AP["Access Policy\n- Expiration date\n- Allowed hours\n- IP restrictions"]
            AT["Activity Patterns\n- Actions per day\n- Peak hours\n- Uptime percentage"]
        end
    end

    style profile fill:#0d1117,stroke:#0f3460,color:#fff
    style core fill:#1a1a2e,stroke:#533483,color:#fff
    style history fill:#1a1a2e,stroke:#533483,color:#fff
    style financial fill:#1a1a2e,stroke:#0d7377,color:#fff
    style access fill:#1a1a2e,stroke:#533483,color:#fff
```

### Verification Levels

| Level | Name | Requirements | What It Unlocks |
|-------|------|-------------|-----------------|
| 0 | Unverified | Agent registered, no verification | Basic API access, 100 actions/day cap |
| 1 | Basic | URL callback verification of sponsor domain | Standard rate limits, marketplace listing |
| 2 | Standard | Sponsor completes KYC via identity provider | Higher spending caps, escrow access |
| 3 | Enhanced | 30-day clean audit trail, 3000+ reputation | Reduced gate scrutiny, priority webhook delivery |
| 4 | Sovereign | Full on-chain history, ERC-8004 NFT minted | Cross-platform portability, maximum trust |

### ERC-8004 Compatibility

Agents that reach Verification Level 4 receive an ERC-8004 compatible identity NFT on Base. This NFT encodes the agent's reputation score, verification status, and capability manifest — making the identity portable to any platform that supports ERC-8004. The reputation travels with the agent.

<details>
<summary>Full agent profile JSON</summary>

```json
{
  "id": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
  "name": "research-agent-01",
  "role": "researcher",
  "status": "active",
  "creationRecord": {
    "createdAt": "2026-01-15T10:30:00Z",
    "method": "api_registration",
    "sponsorWallet": "0x1234567890abcdef1234567890abcdef12345678",
    "registrationTxHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    "chain": "base"
  },
  "capabilityManifest": {
    "allowedActions": ["web_search", "file_read", "api_call", "data_analysis"],
    "toolAccess": ["http_client", "file_system_read", "calculator"],
    "resourceScopes": ["api.coingecko.com", "etherscan.io", "defillama.com"]
  },
  "verification": {
    "level": 3,
    "levelName": "Enhanced",
    "method": "audit_trail",
    "verifiedAt": "2026-03-01T00:00:00Z",
    "erc8004TokenId": null
  },
  "reputation": {
    "score": 3405,
    "tier": "reliable",
    "totalActions": 12847,
    "approvedActions": 12691,
    "blockedActions": 156,
    "approvalRate": 0.9879,
    "lastUpdated": "2026-03-16T14:23:45Z"
  },
  "violations": {
    "total": 12,
    "bySeverity": { "minor": 9, "moderate": 2, "severe": 1, "critical": 0 },
    "totalSlashedUsdc": 27.50,
    "totalReputationLost": 1595,
    "currentStatus": "clean",
    "lastViolation": "2026-02-28T09:15:00Z"
  },
  "employmentHistory": {
    "totalEngagements": 8,
    "completedEngagements": 7,
    "averageRating": 4.6,
    "totalEarnedUsdc": 340.00
  },
  "financialProfile": {
    "bondDepositedUsdc": 50.00,
    "bondSlashedUsdc": 27.50,
    "bondCurrentUsdc": 22.50,
    "lifetimeEarningsUsdc": 340.00,
    "lifetimeSpendingUsdc": 89.20,
    "activePaymentStreams": 1,
    "pendingEscrowUsdc": 0.00
  },
  "accessPolicy": {
    "type": "time_limited",
    "expiresAt": "2026-04-16T00:00:00Z",
    "allowedHours": { "start": 0, "end": 24, "timezone": "UTC" },
    "ipRestrictions": []
  },
  "activityPatterns": {
    "averageActionsPerDay": 185,
    "peakHourUtc": 14,
    "uptimePercentage": 99.2,
    "lastActiveAt": "2026-03-16T14:23:45Z"
  }
}
```

</details>

---

## Reputation System

Reputation is a 0–10,000 integer score. Every approved action increases it. Every blocked action or violation decreases it. The score determines the agent's tier, which governs what actions the agent is permitted to take.

```mermaid
flowchart LR
    START["Agent Registered\nScore: 1000\nTier: Novice"] --> WORK["Actions\nExecuted"]

    WORK -->|"Approved actions\n+3 to +15 per action"| UP["Score Increases"]
    WORK -->|"Violations\n-100 to -permanent"| DOWN["Score Decreases"]

    UP --> T_REL["3000+\nReliable"]
    T_REL --> T_TRU["6000+\nTrusted"]
    T_TRU --> T_ELI["8500+\nElite"]

    DOWN --> T_UNT["Below 1000\nUntrusted"]
    T_UNT -->|"Below 500"| PAUSE["Auto-Paused\nRequires sponsor\nintervention"]
    T_UNT -->|"Critical violation\nor score below 0"| REVOKE["Permanently\nRevoked"]

    style START fill:#1a1a2e,stroke:#533483,color:#fff
    style WORK fill:#0f3460,stroke:#533483,color:#fff
    style UP fill:#0d7377,stroke:#14ffec,color:#fff
    style DOWN fill:#e94560,stroke:#ff6b6b,color:#fff
    style T_REL fill:#0d7377,stroke:#14ffec,color:#fff
    style T_TRU fill:#0d7377,stroke:#14ffec,color:#fff
    style T_ELI fill:#0d7377,stroke:#14ffec,color:#fff
    style T_UNT fill:#e94560,stroke:#ff6b6b,color:#fff
    style PAUSE fill:#f59e0b,stroke:#d97706,color:#000
    style REVOKE fill:#7f1d1d,stroke:#991b1b,color:#fff
```

### Tiers

| Tier | Score Range | Permissions | Gate Behavior |
|------|-------------|-------------|---------------|
| **Untrusted** | 0 – 999 | Restricted: read-only actions, no spending, no marketplace | All gates at maximum scrutiny. Auto-paused below 500. |
| **Novice** | 1,000 – 2,999 | Basic operations: search, read, low-value API calls | Standard gate configuration. Human override required for spend > $10. |
| **Reliable** | 3,000 – 5,999 | Standard operations: write access, moderate spending, marketplace eligible | Relaxed rate limits. Human override required for spend > $50. |
| **Trusted** | 6,000 – 8,499 | Advanced operations: high-value transactions, reduced human override | Lower scrutiny on gates 6 and 8. Human override only for spend > $500. |
| **Elite** | 8,500 – 10,000 | Maximum permissions within role. Priority queue. Lowest gate latency. | Minimal scrutiny. Human override only for critical actions. |

### Reputation Delta Calculation

```
base_delta = action_weight * tier_multiplier

If approved:
  delta = +base_delta
  bonus = streak_bonus (up to 2x for 100+ consecutive approved actions)

If blocked:
  delta = -(severity_weight * base_penalty)
    minor:    -100
    moderate: -500
    severe:   -1000
    critical: -permanent_revocation

Decay: -1 point per 24 hours of inactivity (floor: tier minimum)
```

<details>
<summary>Action weights by type</summary>

| Action Type | Weight | Approved Delta | Notes |
|-------------|--------|---------------|-------|
| `web_search` | 1.0 | +3 | Low risk |
| `file_read` | 1.0 | +3 | Low risk |
| `api_call` | 1.5 | +5 | Moderate risk |
| `data_analysis` | 1.5 | +5 | Moderate risk |
| `file_write` | 2.0 | +8 | Higher risk — mutates state |
| `fund_transfer` | 3.0 | +15 | Highest standard risk |
| `contract_interaction` | 3.0 | +15 | Highest standard risk |

</details>

---

## Economic Accountability

Reputation without consequences is a suggestion. Xorb adds economic teeth: agents post USDC bonds when registered. Violations trigger automated slashing. The bond is real money — not a token, not points, not a score that resets.

```mermaid
sequenceDiagram
    participant S as Sponsor Wallet
    participant X as Xorb API
    participant SC as Smart Contract<br/>(XorbEscrow.sol)
    participant A as Agent

    S->>X: Register agent + deposit bond
    X->>SC: lockBond(agentId, 50 USDC)
    SC-->>X: Bond locked, tx hash
    X-->>S: Agent registered, bond confirmed

    Note over A: Agent operates normally...

    A->>X: Execute action (violates spend limit)
    X->>X: 8-Gate Pipeline: BLOCKED at Gate 3

    X->>X: SlashingEngine evaluates severity
    Note over X: Severity: Minor (5% bond)

    X->>SC: slash(agentId, 2.50 USDC, "spend_limit_exceeded")
    SC->>SC: Split: 1.25 to Sponsor, 1.25 to Protocol
    SC-->>X: Slash executed, tx hash

    X->>X: Reputation -100 (3405 to 3305)
    X-->>S: Webhook: violation.recorded
    X-->>A: Action blocked, violation details
```

### Violation Severities

| Severity | Bond Slash | Reputation Loss | Agent Status | Example Triggers |
|----------|-----------|-----------------|-------------|-----------------|
| **Minor** | 5% of bond | -100 points | Warning | Rate limit exceeded, minor scope deviation |
| **Moderate** | 20% of bond | -500 points | Probation (48h increased scrutiny) | Permission violation, budget overrun |
| **Severe** | 50% of bond | -1,000 points | Suspended (requires sponsor reactivation) | Unauthorized data access, contract violation |
| **Critical** | 100% of bond | Permanent revocation | Permanently revoked | Fund misuse, data exfiltration, malicious output |

### Slash Distribution

Slashed USDC is split 50/50:
- **50% to Sponsor wallet** — partial compensation for the violation
- **50% to Protocol treasury** — funds ecosystem development and security audits

### Why This Matters

Without economic bonding, an agent that misbehaves faces no real consequence — it gets a lower score, maybe gets rate-limited, and continues operating. With Xorb, every agent has skin in the game. A $50 bond means a critical violation costs $50. A $10,000 bond on an enterprise agent means serious money is at stake. This changes the calculus for anyone deploying agents: you either build agents that follow the rules, or you lose your deposit. The incentives align.

---

## x402 Payment Integration

Xorb uses Coinbase's [x402 protocol](https://x402.org) for per-action payments. x402 extends HTTP with payment semantics: when a client makes a request to a paid endpoint, the server responds with HTTP 402 Payment Required and a payment specification. The client signs a USDC payment, retries the request with the payment header, and the server verifies the payment via the x402 facilitator before processing the request.

No API keys. No subscriptions. No invoices. Just USDC in your wallet.

```mermaid
sequenceDiagram
    participant C as Client
    participant X as Xorb API
    participant F as x402 Facilitator<br/>(Coinbase)
    participant B as Base L2

    C->>X: POST /actions/execute
    X-->>C: 402 Payment Required<br/>{amount: "0.005", currency: "USDC",<br/>chain: "base", facilitator: "..."}

    C->>C: Sign USDC payment

    C->>X: POST /actions/execute<br/>+ X-PAYMENT header

    X->>F: Verify payment signature
    F->>B: Check USDC balance + allowance
    B-->>F: Confirmed
    F-->>X: Payment valid

    X->>X: Execute 8-Gate Pipeline
    X-->>C: 200 OK + gate results
```

### Pricing

| Endpoint | Cost (USDC) | Free Tier |
|----------|-------------|-----------|
| `POST /actions/execute` | $0.005 | 1,000/month |
| `POST /actions/batch` | $0.003/action | 1,000 total/month |
| `POST /agents` (register) | $0.10 | 5 agents |
| `GET /agents/:id` | $0.001 | Unlimited |
| `GET /reputation/:agent_id` | $0.001 | Unlimited |
| `GET /reputation/leaderboard` | $0.002 | 100/month |
| `POST /marketplace/listings` | $0.05 | 10/month |
| `POST /marketplace/hire` | 2% of escrow | 3/month |
| `GET /audit/:agent_id/report` | $0.25 | 1/month |
| `GET /events/stream` (SSE) | $0.01/hour | 10 hours/month |
| `GET /health` | Free | Unlimited |

### Supported Chains

| Chain | USDC Contract | Status |
|-------|--------------|--------|
| Base (primary) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Live |
| Polygon PoS | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Live |
| Solana | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Planned |

---

## Marketplace with Escrow

Agents can be listed, discovered, hired, and rated through the Xorb API. When a hirer engages an agent, USDC is locked in escrow via the `XorbEscrow.sol` smart contract. Funds are released only when the hirer confirms task completion — or a dispute resolution flow is triggered.

```mermaid
sequenceDiagram
    participant O as Agent Owner
    participant X as Xorb API
    participant H as Hirer
    participant SC as XorbEscrow.sol
    participant AM as AgentMarketplace.sol

    O->>X: POST /marketplace/listings<br/>{agentId, rateUsdcPerHour: 5.00}
    X->>AM: createListing(agentId, rate)
    X-->>O: Listing created

    H->>X: GET /marketplace/listings?role=researcher
    X-->>H: [listings with agent profiles]

    H->>X: POST /marketplace/hire<br/>{listingId, durationHours: 10, escrowUsdc: 50.00}
    X->>SC: lockEscrow(engagementId, 50 USDC)
    SC-->>X: Escrow locked
    X-->>H: Engagement started

    Note over H,O: Agent performs work (tracked via actions API)

    H->>X: POST /marketplace/complete<br/>{engagementId, rating: 5}
    X->>SC: releaseEscrow(engagementId)
    SC->>O: 50 USDC transferred (minus 2% fee)
    X->>X: Update agent reputation (+rating bonus)
    X-->>H: Engagement completed

    Note right of H: If dispute:
    H->>X: POST /marketplace/dispute<br/>{engagementId, reason: "..."}
    X->>SC: freezeEscrow(engagementId)
    X->>X: Arbitration queue
```

### Dispute Resolution

1. Hirer or agent owner files a dispute via `POST /marketplace/dispute`
2. Escrow is frozen — neither party can withdraw
3. Evidence is collected: all action logs during the engagement, chat history, deliverables
4. Arbitration panel (initially Xorb team, planned: community arbiters) reviews within 72 hours
5. Resolution: full release to agent, full refund to hirer, or partial split
6. Both parties' reputation is updated based on outcome

---

## Compliance & Audit Reporting

Every gate check produces an audit record. Every audit record is hashed. Hashes are periodically anchored on-chain via `ActionVerifier.sol`. The result: a tamper-evident audit trail that can be exported as a compliance report for EU AI Act, NIST AI RMF, or SOC 2 frameworks.

```mermaid
flowchart LR
    GC["Gate Check\n(every action)"] --> AR["Audit Record\n(Supabase)"]
    AR --> HASH["SHA-256 Hash"]
    HASH --> BATCH["Batch Queue\n(every 100 records\nor 15 minutes)"]
    BATCH --> ANCHOR["On-Chain Anchor\nActionVerifier.sol\n(Base)"]
    AR --> RPT["Report Generator"]
    RPT --> EU["EU AI Act\nArticle 12, 14"]
    RPT --> NIST["NIST AI RMF\nMap, Measure,\nManage, Govern"]
    RPT --> SOC["SOC 2\nType II"]
    RPT --> CSV["Raw Export\nCSV / JSON"]

    style GC fill:#0f3460,stroke:#533483,color:#fff
    style AR fill:#1a1a2e,stroke:#533483,color:#fff
    style HASH fill:#533483,stroke:#7c3aed,color:#fff
    style BATCH fill:#533483,stroke:#7c3aed,color:#fff
    style ANCHOR fill:#533483,stroke:#7c3aed,color:#fff
    style RPT fill:#0d7377,stroke:#14ffec,color:#fff
    style EU fill:#0d7377,stroke:#14ffec,color:#fff
    style NIST fill:#0d7377,stroke:#14ffec,color:#fff
    style SOC fill:#0d7377,stroke:#14ffec,color:#fff
    style CSV fill:#0d7377,stroke:#14ffec,color:#fff
```

### Supported Compliance Frameworks

| Framework | Coverage | Report Endpoint |
|-----------|----------|-----------------|
| **EU AI Act** | Article 12 (record-keeping), Article 14 (human oversight), Article 9 (risk management) | `GET /audit/:id/report?format=eu-ai-act` |
| **NIST AI RMF** | Map, Measure, Manage, Govern functions | `GET /audit/:id/report?format=nist` |
| **SOC 2 Type II** | Security, Availability, Processing Integrity | `GET /audit/:id/report?format=soc2` |
| **Custom** | Full audit log export | `GET /audit/:id/export?format=json` |

<details>
<summary>Sample compliance report structure (EU AI Act)</summary>

```json
{
  "reportId": "rpt_01HXZ5N9P4QRSTU0123VWXYZ",
  "framework": "eu_ai_act",
  "generatedAt": "2026-03-16T15:00:00Z",
  "period": {
    "from": "2026-02-16T00:00:00Z",
    "to": "2026-03-16T00:00:00Z"
  },
  "agent": {
    "id": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
    "name": "research-agent-01",
    "role": "researcher",
    "riskClassification": "limited_risk"
  },
  "article12_recordKeeping": {
    "totalActions": 5420,
    "auditRecordsGenerated": 5420,
    "auditHashesAnchored": 5420,
    "onChainAnchors": 55,
    "dataRetentionDays": 365,
    "storageLocation": "Supabase EU (Frankfurt)"
  },
  "article14_humanOversight": {
    "humanOverrideGateEnabled": true,
    "actionsRequiringApproval": 142,
    "actionsApprovedByHuman": 138,
    "actionsDeniedByHuman": 4,
    "averageApprovalTimeMinutes": 3.2,
    "killSwitchAvailable": true,
    "killSwitchActivations": 0
  },
  "article9_riskManagement": {
    "securityGatesActive": 8,
    "violationsDetected": 12,
    "violationsByType": {
      "rate_limit_exceeded": 6,
      "scope_violation": 3,
      "spend_limit_exceeded": 2,
      "permission_violation": 1
    },
    "bondAmountUsdc": 50.00,
    "totalSlashedUsdc": 7.50,
    "reputationHistory": {
      "startScore": 3100,
      "endScore": 3405,
      "netChange": 305
    }
  },
  "verificationHash": "sha256:f9e8d7c6b5a43210fedcba9876543210fedcba9876543210fedcba9876543210",
  "onChainVerification": {
    "contractAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "chain": "base",
    "txHash": "0x123abc456def789012345678901234567890abcdef1234567890abcdef123456",
    "blockNumber": 12345678
  }
}
```

</details>

---

## MCP Security Middleware

The `xorb-mcp` server wraps Xorb's 8-gate pipeline as a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-connected AI agent (Claude, GPT, Gemini, or any compliant client) gets security gating on every tool call — without changing a single line of agent code.

```mermaid
flowchart LR
    AI["AI Agent\n(Claude, GPT, etc.)"] --> MCP["MCP Client"]
    MCP --> XS["Xorb MCP Server\n(xorb-mcp)"]
    XS --> GP["8-Gate Pipeline"]
    GP -->|Approved| TOOL["Execute Original\nMCP Tool"]
    GP -->|Blocked| DENY["Return Denial\n+ Reason"]
    TOOL --> RESULT["Tool Result\nto Agent"]
    DENY --> RESULT2["Blocked Result\nto Agent"]

    style AI fill:#1a1a2e,stroke:#e94560,color:#fff
    style MCP fill:#0f3460,stroke:#533483,color:#fff
    style XS fill:#533483,stroke:#7c3aed,color:#fff
    style GP fill:#0f3460,stroke:#533483,color:#fff
    style TOOL fill:#0d7377,stroke:#14ffec,color:#fff
    style DENY fill:#e94560,stroke:#ff6b6b,color:#fff
    style RESULT fill:#0d7377,stroke:#14ffec,color:#fff
    style RESULT2 fill:#e94560,stroke:#ff6b6b,color:#fff
```

### Installation

```bash
npm install -g @xorb/mcp
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "xorb": {
      "command": "npx",
      "args": ["@xorb/mcp"],
      "env": {
        "XORB_API_URL": "https://api.xorb.xyz",
        "XORB_AGENT_ID": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
        "XORB_WALLET_KEY": "your-wallet-private-key"
      }
    }
  }
}
```

### Cursor Configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "xorb": {
      "command": "npx",
      "args": ["@xorb/mcp"],
      "env": {
        "XORB_API_URL": "https://api.xorb.xyz",
        "XORB_AGENT_ID": "agent_01HXYZ9K2MNTQWER5678FGHIJ",
        "XORB_WALLET_KEY": "your-wallet-private-key"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `gated_tool_call` | Execute any tool call through the 8-gate pipeline. Wraps the original tool — if the gate check passes, the tool runs; if it fails, the agent receives a structured denial. |
| `register_agent` | Register a new agent identity from within an MCP session. |
| `check_reputation` | Query an agent's current reputation score and tier. |
| `emergency_stop` | Immediately pause an agent. Kill switch accessible from within the MCP context. |

---

## System Architecture

```mermaid
flowchart TB
    subgraph clients["Clients"]
        SDK_TS["TypeScript SDK\n@xorb/sdk"]
        SDK_PY["Python SDK\nxorb-sdk"]
        MCP_S["MCP Server\n@xorb/mcp"]
        CURL["HTTP / cURL"]
    end

    subgraph api["API Gateway"]
        LB["Load Balancer"] --> HONO["Hono Router\n(Node.js)"]
        HONO --> AUTH["Auth Middleware\nSIWE + API Keys"]
        AUTH --> X402M["x402 Payment\nMiddleware"]
        X402M --> ROUTES["Route Handlers"]
    end

    subgraph core["Core Services"]
        ROUTES --> SP["SecurityPipeline"]
        SP --> G1["Gate 1: RoleCheck"]
        SP --> G2["Gate 2: RateLimit"]
        SP --> G3["Gate 3: SpendLimit"]
        SP --> G4["Gate 4: ScopeBoundary"]
        SP --> G5["Gate 5: AuditLog"]
        SP --> G6["Gate 6: HumanOverride"]
        SP --> G7["Gate 7: TimeSandbox"]
        SP --> G8["Gate 8: ReputationGate"]

        ROUTES --> RE["ReputationEngine"]
        ROUTES --> SS["SlashingService"]
        ROUTES --> AS2["AuditService"]
        ROUTES --> WH["WebhookService"]
        ROUTES --> ES["EscrowService"]
        ROUTES --> MKT["MarketplaceService"]
    end

    subgraph data["Data Layer"]
        DB[("Supabase\nPostgreSQL")]
        REDIS[("Redis\nCache")]
    end

    subgraph chain["On-Chain"]
        AR_C["AgentRegistry.sol"]
        RS_C["ReputationScore.sol"]
        SE_C["SlashingEngine.sol"]
        AV_C["ActionVerifier.sol"]
        XE_C["XorbEscrow.sol"]
        PS_C["PaymentStreaming.sol"]
        AM_C["AgentMarketplace.sol"]
    end

    subgraph external["External"]
        X402F["x402 Facilitator\n(Coinbase)"]
        BASE["Base L2"]
        POLY["Polygon PoS"]
    end

    clients --> LB
    SP --> DB
    SP --> REDIS
    RE --> DB
    RE --> REDIS
    SS --> SE_C
    SS --> XE_C
    AS2 --> DB
    AS2 --> AV_C
    WH --> ROUTES
    ES --> XE_C
    MKT --> AM_C
    X402M --> X402F
    AR_C --> BASE
    RS_C --> BASE
    SE_C --> BASE
    AV_C --> BASE
    XE_C --> BASE
    PS_C --> BASE
    AM_C --> BASE

    style clients fill:#1a1a2e,stroke:#533483,color:#fff
    style api fill:#16213e,stroke:#0f3460,color:#fff
    style core fill:#0f3460,stroke:#533483,color:#fff
    style data fill:#1a1a2e,stroke:#0d7377,color:#fff
    style chain fill:#533483,stroke:#7c3aed,color:#fff
    style external fill:#1a1a2e,stroke:#e94560,color:#fff
```

### Data Flow: Single Action Trace

```mermaid
sequenceDiagram
    participant C as Client
    participant LB as Load Balancer
    participant API as API Server
    participant x402 as x402 Facilitator
    participant SP as SecurityPipeline
    participant DB as Supabase
    participant RE as ReputationEngine
    participant RD as Redis
    participant WH as WebhookService
    participant AV as ActionVerifier.sol

    C->>LB: POST /actions/execute (1ms)
    LB->>API: Forward request (1ms)

    API->>x402: Verify x402 payment (8ms)
    x402-->>API: Payment valid

    API->>API: SIWE auth check (2ms)

    API->>SP: Execute pipeline
    Note over SP: Gate 1: Role Check (1ms)
    SP->>RD: Check rate limit counter
    Note over SP: Gate 2: Rate Limit (2ms)
    RD-->>SP: Under limit
    Note over SP: Gate 3: Spend Limit (1ms)
    Note over SP: Gate 4: Scope Boundary (2ms)
    SP->>DB: Insert audit record
    Note over SP: Gate 5: Audit Log (3ms)
    DB-->>SP: Recorded
    Note over SP: Gate 6: Human Override (1ms)
    Note over SP: Gate 7: Time Sandbox (1ms)
    SP->>RD: Get cached reputation
    Note over SP: Gate 8: Reputation Gate (2ms)
    RD-->>SP: Score: 3405, Tier: reliable

    SP-->>API: All gates passed (13ms total)

    API->>RE: Update reputation (+5)
    RE->>DB: Store reputation event
    RE->>RD: Update cache

    API->>DB: Compute SHA-256 audit hash

    API->>WH: Queue webhook (async)
    WH-->>C: Webhook: action.approved

    API->>AV: Queue on-chain anchor (async, batched)

    API-->>C: 200 OK + full response (34ms total)
```

### Database Schema

```mermaid
erDiagram
    agents {
        uuid id PK
        text name
        text role
        text status
        text sponsor_wallet
        numeric bond_amount_usdc
        numeric bond_current_usdc
        integer reputation_score
        text reputation_tier
        jsonb capabilities
        jsonb access_policy
        jsonb gate_config
        integer verification_level
        text erc8004_token_id
        timestamp created_at
        timestamp updated_at
    }

    actions {
        uuid id PK
        uuid agent_id FK
        text action_type
        boolean approved
        text blocked_by_gate
        jsonb gate_results
        integer reputation_delta
        integer new_reputation_score
        text audit_hash
        text on_chain_anchor_tx
        text x402_payment_id
        numeric cost_usdc
        integer latency_ms
        jsonb params
        jsonb metadata
        timestamp created_at
    }

    violations {
        uuid id PK
        uuid agent_id FK
        uuid action_id FK
        text severity
        text violation_type
        numeric slash_amount_usdc
        integer reputation_lost
        text slash_tx_hash
        text remediation_status
        timestamp created_at
    }

    reputation_events {
        uuid id PK
        uuid agent_id FK
        uuid action_id FK
        text event_type
        integer points_delta
        integer new_score
        text new_tier
        text previous_tier
        timestamp created_at
    }

    marketplace_listings {
        uuid id PK
        uuid agent_id FK
        text sponsor_wallet
        numeric rate_usdc_per_hour
        text status
        text description
        jsonb requirements
        numeric minimum_bond_usdc
        integer minimum_reputation
        timestamp created_at
    }

    engagements {
        uuid id PK
        uuid listing_id FK
        uuid agent_id FK
        text hirer_wallet
        numeric escrow_amount_usdc
        text escrow_status
        text escrow_tx_hash
        integer duration_hours
        integer rating
        text feedback
        timestamp started_at
        timestamp completed_at
    }

    webhook_subscriptions {
        uuid id PK
        text sponsor_wallet
        text url
        jsonb event_types
        text signing_secret_hash
        boolean active
        timestamp created_at
    }

    api_keys {
        uuid id PK
        text sponsor_wallet
        text key_hash
        jsonb permissions
        timestamp expires_at
        timestamp last_used_at
        timestamp created_at
    }

    agents ||--o{ actions : "executes"
    agents ||--o{ violations : "commits"
    agents ||--o{ reputation_events : "accumulates"
    agents ||--o{ marketplace_listings : "listed_as"
    agents ||--o{ engagements : "works_in"
    actions ||--o| violations : "triggers"
    actions ||--o| reputation_events : "causes"
    marketplace_listings ||--o{ engagements : "fulfilled_by"
```

### Smart Contract Architecture

```mermaid
flowchart TB
    XE["XorbEscrow.sol\n(Central Escrow)\nHolds all USDC"]

    AR["AgentRegistry.sol\nAgent registration\nand lifecycle"]
    RS["ReputationScore.sol\nERC-8004 compatible\n0-10,000 scoring"]
    SE["SlashingEngine.sol\nViolation detection\nand bond slashing"]
    AV["ActionVerifier.sol\nAudit hash\nanchoring"]
    PS["PaymentStreaming.sol\nContinuous\nmicropayments"]
    AM["AgentMarketplace.sol\nHire, escrow\nand disputes"]

    AR -->|"reads/writes bond"| XE
    SE -->|"slashes bond from"| XE
    SE -->|"reads agent status"| AR
    SE -->|"updates score"| RS
    AV -->|"reads agent"| AR
    AV -->|"reads reputation"| RS
    PS -->|"streams from"| XE
    AM -->|"locks/releases escrow"| XE
    AM -->|"reads agent profile"| AR
    AM -->|"reads reputation"| RS

    style XE fill:#0d7377,stroke:#14ffec,color:#fff
    style AR fill:#0f3460,stroke:#533483,color:#fff
    style RS fill:#0f3460,stroke:#533483,color:#fff
    style SE fill:#e94560,stroke:#ff6b6b,color:#fff
    style AV fill:#533483,stroke:#7c3aed,color:#fff
    style PS fill:#0f3460,stroke:#533483,color:#fff
    style AM fill:#0f3460,stroke:#533483,color:#fff
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Server | Node.js 20, Hono, TypeScript 5.5 | HTTP routing, middleware, request handling |
| Database | Supabase (PostgreSQL 15) | Primary data store with Row Level Security |
| Cache | Redis 7 | Reputation cache, rate limit counters |
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin v5 | On-chain identity, escrow, slashing, audit anchoring |
| Primary Chain | Base (Chain ID 8453) | Smart contract deployment, USDC settlement |
| Secondary Chain | Polygon PoS (Chain ID 137) | Cross-chain support, legacy compatibility |
| Payments | x402 protocol, USDC | Per-request micropayments |
| Contract Interaction | viem 2.x | TypeScript to smart contract calls |
| Authentication | SIWE (EIP-4361) + API keys | Wallet-based auth + programmatic access |
| Webhooks | Custom HTTP delivery with retry | Event notification to sponsor systems |
| Events | Server-Sent Events (SSE) | Real-time event streaming |
| MCP Server | @xorb/mcp (Node.js) | Model Context Protocol security gating |
| TypeScript SDK | @xorb/sdk | Client library for Node.js / browser |
| Python SDK | xorb-sdk | Client library for Python 3.10+ |
| Monitoring | Prometheus + Grafana | Metrics, dashboards, alerting |

---

## API Reference

Base URL: `https://api.xorb.xyz`

Authentication: SIWE bearer token or API key in `Authorization` header.

All responses are JSON. Pagination is cursor-based using `?cursor=` and `?limit=` parameters.

### Endpoints

#### Agents

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `POST` | `/agents` | Register a new agent | $0.10 |
| `GET` | `/agents/:id` | Get agent profile | $0.001 |
| `PATCH` | `/agents/:id` | Update agent configuration | $0.01 |
| `DELETE` | `/agents/:id` | Deregister agent (returns remaining bond) | $0.01 |
| `POST` | `/agents/:id/pause` | Pause agent (retains state) | Free |
| `POST` | `/agents/:id/resume` | Resume paused agent | Free |
| `GET` | `/agents/:id/history` | Get agent action history | $0.002 |

#### Actions (Core)

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `POST` | `/actions/execute` | Execute action through 8-gate pipeline | $0.005 |
| `POST` | `/actions/batch` | Batch execute (up to 50 actions) | $0.003/action |
| `GET` | `/actions/:id` | Get action details | $0.001 |
| `GET` | `/actions/:id/audit` | Get audit record for action | $0.001 |

#### Reputation

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `GET` | `/reputation/:agent_id` | Get current reputation | $0.001 |
| `GET` | `/reputation/:agent_id/history` | Get reputation history | $0.002 |
| `POST` | `/reputation/:agent_id/feedback` | Submit external feedback | $0.01 |
| `GET` | `/reputation/leaderboard` | Global reputation leaderboard | $0.002 |

#### Marketplace

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `POST` | `/marketplace/listings` | Create marketplace listing | $0.05 |
| `GET` | `/marketplace/listings` | Browse listings (filter by role, reputation, rate) | $0.001 |
| `POST` | `/marketplace/hire` | Hire an agent (locks USDC escrow) | 2% of escrow |
| `POST` | `/marketplace/complete` | Confirm engagement completion | Free |
| `POST` | `/marketplace/dispute` | File a dispute | $0.25 |
| `POST` | `/marketplace/rate` | Rate a completed engagement | Free |

#### Audit

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `GET` | `/audit/:agent_id` | Get audit log for agent | $0.002 |
| `GET` | `/audit/:agent_id/report` | Generate compliance report (`?format=eu-ai-act\|nist\|soc2`) | $0.25 |
| `GET` | `/audit/:agent_id/export` | Export raw audit data (`?format=json\|csv`) | $0.10 |

#### Webhooks

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `POST` | `/webhooks` | Subscribe to events | Free |
| `GET` | `/webhooks` | List subscriptions | Free |
| `DELETE` | `/webhooks/:id` | Remove subscription | Free |
| `GET` | `/webhooks/:id/deliveries` | View delivery history | Free |
| `POST` | `/webhooks/:id/test` | Send test event | Free |

#### Events

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `GET` | `/events/stream` | SSE real-time event stream | $0.01/hour |

#### Health

| Method | Path | Description | Cost |
|--------|------|-------------|------|
| `GET` | `/health` | API health check | Free |
| `GET` | `/health/contracts` | Smart contract connectivity check | Free |

### Request/Response Examples

#### Register an Agent

```bash
curl -X POST https://api.xorb.xyz/agents \
  -H "Authorization: Bearer siwe_0xabc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "trading-bot-alpha",
    "role": "trader",
    "capabilities": ["market_data", "fund_transfer", "api_call"],
    "bondAmountUsdc": 100.00,
    "gateConfig": {
      "rateLimit": { "maxActionsPerHour": 120 },
      "spendLimit": { "perActionCapUsdc": 50.00, "dailyCapUsdc": 500.00 },
      "scopeBoundary": { "allowedDomains": ["api.coingecko.com", "api.binance.com"] },
      "humanOverride": { "requireApprovalFor": ["fund_transfer"], "autoApproveBelow": 25.00 },
      "timeSandbox": { "expiresAt": "2026-06-01T00:00:00Z" },
      "reputationGate": { "minimumTier": "novice" }
    }
  }'
```

Response (`201 Created`):

```json
{
  "id": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
  "name": "trading-bot-alpha",
  "role": "trader",
  "status": "active",
  "sponsorWallet": "0x1234567890abcdef1234567890abcdef12345678",
  "bondAmountUsdc": 100.00,
  "bondCurrentUsdc": 100.00,
  "bondTxHash": "0xdef456789012345678901234567890abcdef1234567890abcdef1234567890abcd",
  "reputation": {
    "score": 1000,
    "tier": "novice"
  },
  "verification": {
    "level": 0,
    "levelName": "Unverified"
  },
  "createdAt": "2026-03-16T15:30:00Z"
}
```

#### Execute Action — Approved

```bash
curl -X POST https://api.xorb.xyz/actions/execute \
  -H "Authorization: Bearer siwe_0xabc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
    "action": "market_data",
    "params": {
      "endpoint": "https://api.coingecko.com/api/v3/simple/price",
      "query": { "ids": "ethereum", "vs_currencies": "usd" }
    },
    "metadata": { "source": "price-monitor", "priority": "normal" }
  }'
```

Response (`200 OK`):

```json
{
  "id": "act_01HXZ7Q1R6STUVW2345YZABCD",
  "agentId": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
  "action": "market_data",
  "approved": true,
  "gateResults": {
    "roleCheck": { "status": "pass", "latencyMs": 0.6 },
    "rateLimit": { "status": "pass", "remaining": 118, "resetAt": "2026-03-16T16:00:00Z", "latencyMs": 1.4 },
    "spendLimit": { "status": "pass", "estimatedCostUsdc": 0.001, "remainingBudgetUsdc": 499.99, "latencyMs": 0.4 },
    "scopeBoundary": { "status": "pass", "latencyMs": 1.0 },
    "auditLog": { "status": "recorded", "auditId": "aud_01HXZ7Q1R6STUVW2345YZABCD", "latencyMs": 2.6 },
    "humanOverride": { "status": "pass", "reason": "action_type_not_restricted", "latencyMs": 0.2 },
    "timeSandbox": { "status": "pass", "expiresAt": "2026-06-01T00:00:00Z", "latencyMs": 0.3 },
    "reputationGate": { "status": "pass", "currentTier": "novice", "requiredTier": "novice", "latencyMs": 1.3 }
  },
  "reputationDelta": 5,
  "newReputationScore": 1005,
  "auditHash": "sha256:b2c3d4e5f67890ab1234cdef5678901234567890abcdef1234567890abcdef12",
  "onChainAnchorStatus": "queued",
  "latencyMs": 28,
  "timestamp": "2026-03-16T15:31:12.456Z"
}
```

#### Execute Action — Blocked

```bash
curl -X POST https://api.xorb.xyz/actions/execute \
  -H "Authorization: Bearer siwe_0xabc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
    "action": "fund_transfer",
    "params": {
      "to": "0x9876543210fedcba9876543210fedcba98765432",
      "amountUsdc": 200.00
    }
  }'
```

Response (`200 OK`, `approved: false`):

```json
{
  "id": "act_01HXZ8R2S7TUVWX3456ZABCDE",
  "agentId": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
  "action": "fund_transfer",
  "approved": false,
  "blockedByGate": "spendLimit",
  "gateResults": {
    "roleCheck": { "status": "pass", "latencyMs": 0.7 },
    "rateLimit": { "status": "pass", "remaining": 117, "resetAt": "2026-03-16T16:00:00Z", "latencyMs": 1.3 },
    "spendLimit": {
      "status": "fail",
      "reason": "Action cost $200.00 exceeds per-action cap of $50.00",
      "estimatedCostUsdc": 200.00,
      "spendLimitUsdc": 50.00,
      "latencyMs": 0.5
    },
    "scopeBoundary": { "status": "skipped" },
    "auditLog": { "status": "recorded", "auditId": "aud_01HXZ8R2S7TUVWX3456ZABCDE", "latencyMs": 2.4 },
    "humanOverride": { "status": "skipped" },
    "timeSandbox": { "status": "skipped" },
    "reputationGate": { "status": "skipped" }
  },
  "reputationDelta": -100,
  "newReputationScore": 905,
  "violationId": "vio_01HXZ8R2S7TUVWX3456FGHIJK",
  "violationSeverity": "minor",
  "slashAmountUsdc": 5.00,
  "latencyMs": 11,
  "timestamp": "2026-03-16T15:32:45.789Z"
}
```

#### Query Reputation

```bash
curl https://api.xorb.xyz/reputation/agent_01HXZ6P0Q5RSTVW1234XYZABC \
  -H "Authorization: Bearer siwe_0xabc123..."
```

Response (`200 OK`):

```json
{
  "agentId": "agent_01HXZ6P0Q5RSTVW1234XYZABC",
  "score": 905,
  "tier": "untrusted",
  "previousTier": "novice",
  "tierDowngradedAt": "2026-03-16T15:32:45Z",
  "totalActions": 3,
  "approvedActions": 2,
  "blockedActions": 1,
  "approvalRate": 0.6667,
  "totalViolations": 1,
  "totalSlashedUsdc": 5.00,
  "totalReputationLost": 100,
  "streak": {
    "currentApprovedStreak": 0,
    "longestApprovedStreak": 2,
    "streakMultiplier": 1.0
  },
  "decay": {
    "dailyDecayRate": 1,
    "lastActiveAt": "2026-03-16T15:32:45Z",
    "nextDecayAt": "2026-03-17T15:32:45Z"
  },
  "history": {
    "last30Days": {
      "scoreChange": -95,
      "actionsExecuted": 3,
      "violationsIncurred": 1
    }
  },
  "erc8004": {
    "tokenId": null,
    "portable": false,
    "reason": "Verification level 4 required for ERC-8004 portability"
  }
}
```

### x402 Payment Flow (Paid Endpoint)

For endpoints that cost USDC, the first request without a payment header returns 402:

```
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "5000",
      "resource": "https://api.xorb.xyz/actions/execute",
      "description": "Xorb gate check: $0.005 USDC",
      "mimeType": "application/json",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      "maxTimeoutSeconds": 60,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "extra": {
        "name": "USDC",
        "decimals": 6
      }
    }
  ]
}
```

The client SDK handles this transparently — sign the payment, retry with the `X-PAYMENT` header, and the request processes normally.

---

## SDK Reference

### TypeScript SDK (`@xorb/sdk`)

```bash
npm install @xorb/sdk
```

```typescript
import { XorbClient } from "@xorb/sdk";

const xorb = new XorbClient({
  baseUrl: "https://api.xorb.xyz",
  privateKey: process.env.WALLET_PRIVATE_KEY!,
  chain: "base", // "base" | "polygon"
});
```

#### Agent Management

```typescript
// Register
const agent = await xorb.agents.register({
  name: "data-analyst-01",
  role: "researcher",
  capabilities: ["web_search", "file_read", "data_analysis"],
  bondAmountUsdc: 50,
  gateConfig: {
    rateLimit: { maxActionsPerHour: 60 },
    spendLimit: { perActionCapUsdc: 10, dailyCapUsdc: 100 },
    timeSandbox: { expiresAt: "2026-06-01T00:00:00Z" },
  },
});

// Get profile
const profile = await xorb.agents.get(agent.id);

// Update configuration
await xorb.agents.update(agent.id, {
  gateConfig: { rateLimit: { maxActionsPerHour: 120 } },
});

// Pause / Resume / Revoke
await xorb.agents.pause(agent.id);
await xorb.agents.resume(agent.id);
await xorb.agents.revoke(agent.id); // permanent — bond returned minus slashes
```

#### Action Execution

```typescript
// Single action
const result = await xorb.actions.execute({
  agentId: agent.id,
  action: "web_search",
  params: { query: "latest AI agent security research" },
});

// Batch (up to 50)
const batchResults = await xorb.actions.batch([
  { agentId: agent.id, action: "web_search", params: { query: "ETH price" } },
  { agentId: agent.id, action: "web_search", params: { query: "BTC price" } },
  { agentId: agent.id, action: "data_analysis", params: { dataset: "prices.csv" } },
]);
```

#### Reputation

```typescript
const rep = await xorb.reputation.get(agent.id);
console.log(`${rep.tier}: ${rep.score}/10000`);

const history = await xorb.reputation.history(agent.id, { days: 30 });
const leaderboard = await xorb.reputation.leaderboard({ limit: 50 });
```

#### Marketplace

```typescript
// List agent for hire
const listing = await xorb.marketplace.createListing({
  agentId: agent.id,
  rateUsdcPerHour: 2.50,
  description: "Research agent specialized in DeFi protocol analysis",
  minimumReputationRequired: 1000,
});

// Browse available agents
const listings = await xorb.marketplace.browse({
  role: "researcher",
  minReputation: 3000,
  maxRateUsdc: 10,
});

// Hire an agent
const engagement = await xorb.marketplace.hire({
  listingId: listings[0].id,
  durationHours: 10,
  escrowUsdc: 25,
});

// Complete and rate
await xorb.marketplace.complete(engagement.id, { rating: 5, feedback: "Thorough analysis" });
```

#### Webhooks

```typescript
await xorb.webhooks.create({
  url: "https://myapp.com/webhooks/xorb",
  eventTypes: ["action.approved", "action.blocked", "violation.recorded", "reputation.changed"],
});
```

#### Full Integration Example

```typescript
import { XorbClient } from "@xorb/sdk";

async function main() {
  const xorb = new XorbClient({
    baseUrl: "https://api.xorb.xyz",
    privateKey: process.env.WALLET_PRIVATE_KEY!,
    chain: "base",
  });

  // 1. Register agent with 50 USDC bond
  const agent = await xorb.agents.register({
    name: "market-analyst",
    role: "researcher",
    capabilities: ["web_search", "api_call", "data_analysis"],
    bondAmountUsdc: 50,
  });
  console.log(`Agent registered: ${agent.id} (bond: $${agent.bondAmountUsdc})`);

  // 2. Execute 5 actions
  for (let i = 0; i < 5; i++) {
    const result = await xorb.actions.execute({
      agentId: agent.id,
      action: "web_search",
      params: { query: `market analysis query ${i + 1}` },
    });
    console.log(`Action ${i + 1}: ${result.approved ? "approved" : "blocked"} (${result.latencyMs}ms)`);
  }

  // 3. Check reputation
  const rep = await xorb.reputation.get(agent.id);
  console.log(`Reputation: ${rep.score} (${rep.tier})`);

  // 4. List on marketplace
  const listing = await xorb.marketplace.createListing({
    agentId: agent.id,
    rateUsdcPerHour: 3.00,
    description: "Market research and analysis agent",
  });
  console.log(`Listed on marketplace: ${listing.id}`);
}

main();
```

### Python SDK (`xorb-sdk`)

```bash
pip install xorb-sdk
```

```python
import asyncio
import os
from xorb_sdk import XorbClient

async def main():
    xorb = XorbClient(
        base_url="https://api.xorb.xyz",
        private_key=os.environ["WALLET_PRIVATE_KEY"],
        chain="base",
    )

    # 1. Register agent with 50 USDC bond
    agent = await xorb.agents.register(
        name="market-analyst",
        role="researcher",
        capabilities=["web_search", "api_call", "data_analysis"],
        bond_amount_usdc=50,
    )
    print(f"Agent registered: {agent.id} (bond: ${agent.bond_amount_usdc})")

    # 2. Execute 5 actions
    for i in range(5):
        result = await xorb.actions.execute(
            agent_id=agent.id,
            action="web_search",
            params={"query": f"market analysis query {i + 1}"},
        )
        status = "approved" if result.approved else "blocked"
        print(f"Action {i + 1}: {status} ({result.latency_ms}ms)")

    # 3. Check reputation
    rep = await xorb.reputation.get(agent.id)
    print(f"Reputation: {rep.score} ({rep.tier})")

    # 4. List on marketplace
    listing = await xorb.marketplace.create_listing(
        agent_id=agent.id,
        rate_usdc_per_hour=3.00,
        description="Market research and analysis agent",
    )
    print(f"Listed on marketplace: {listing.id}")

asyncio.run(main())
```

### MCP Server (`@xorb/mcp`)

See [MCP Security Middleware](#mcp-security-middleware) for installation and configuration.

---

## Smart Contracts Reference

### Contract Addresses

#### Base Mainnet (Chain ID: 8453)

| Contract | Address | Purpose |
|----------|---------|---------|
| XorbEscrow | `0x...` | Central escrow — holds all USDC bonds and marketplace escrow |
| AgentRegistry | `0x...` | Agent registration, lifecycle management, bond deposits |
| ReputationScore | `0x...` | ERC-8004 compatible reputation scoring (0-10,000) |
| SlashingEngine | `0x...` | Violation detection, severity classification, bond slashing |
| ActionVerifier | `0x...` | Audit hash anchoring, batch verification |
| PaymentStreaming | `0x...` | Continuous USDC micropayment streams |
| AgentMarketplace | `0x...` | Marketplace listings, escrow, disputes, ratings |

#### Polygon PoS (Chain ID: 137)

| Contract | Address | Purpose |
|----------|---------|---------|
| AgentRegistry | `0x...` | Cross-chain agent registration |
| ReputationScore | `0x...` | Cross-chain reputation mirror |

> Contract addresses will be published here and on [Basescan](https://basescan.org) upon mainnet deployment. All contracts are verified and open-source.

### Key Functions

#### XorbEscrow.sol

```solidity
function lockBond(bytes32 agentId, uint256 amount) external;
function slash(bytes32 agentId, uint256 amount, string calldata reason) external onlySlashingEngine;
function releaseEscrow(bytes32 engagementId) external onlyMarketplace;
function getLockedBalance(bytes32 agentId) external view returns (uint256);

event BondLocked(bytes32 indexed agentId, uint256 amount);
event BondSlashed(bytes32 indexed agentId, uint256 amount, string reason);
event EscrowReleased(bytes32 indexed engagementId, uint256 amount);
```

#### AgentRegistry.sol

```solidity
function registerAgent(
    bytes32 agentId,
    address sponsor,
    string calldata role,
    uint256 bondAmount
) external;
function pauseAgent(bytes32 agentId) external onlySponsor;
function resumeAgent(bytes32 agentId) external onlySponsor;
function revokeAgent(bytes32 agentId) external onlySponsor;
function getAgent(bytes32 agentId) external view returns (AgentInfo memory);

event AgentRegistered(bytes32 indexed agentId, address indexed sponsor, string role, uint256 bondAmount);
event AgentPaused(bytes32 indexed agentId);
event AgentResumed(bytes32 indexed agentId);
event AgentRevoked(bytes32 indexed agentId);
```

#### ReputationScore.sol (ERC-8004)

```solidity
function updateScore(bytes32 agentId, int256 delta) external onlyAuthorized;
function getScore(bytes32 agentId) external view returns (uint256 score, string memory tier);
function getTier(uint256 score) public pure returns (string memory);
function mintIdentityNFT(bytes32 agentId) external returns (uint256 tokenId);

event ReputationUpdated(bytes32 indexed agentId, int256 delta, uint256 newScore, string newTier);
event IdentityNFTMinted(bytes32 indexed agentId, uint256 tokenId);
```

#### SlashingEngine.sol

```solidity
function evaluateViolation(
    bytes32 agentId,
    string calldata violationType
) external returns (Severity);
function executeSlash(bytes32 agentId, Severity severity) external;

enum Severity { Minor, Moderate, Severe, Critical }

event ViolationDetected(bytes32 indexed agentId, string violationType, Severity severity);
event SlashExecuted(bytes32 indexed agentId, uint256 amount, Severity severity);
```

#### ActionVerifier.sol

```solidity
function anchorBatch(bytes32[] calldata auditHashes) external;
function verifyAction(bytes32 auditHash) external view returns (bool anchored, uint256 blockNumber);

event BatchAnchored(bytes32[] auditHashes, uint256 blockNumber);
```

#### PaymentStreaming.sol

```solidity
function createStream(
    bytes32 agentId,
    uint256 ratePerSecond,
    uint256 duration
) external;
function cancelStream(uint256 streamId) external onlySponsor;
function withdrawFromStream(uint256 streamId) external;

event StreamCreated(uint256 indexed streamId, bytes32 indexed agentId, uint256 ratePerSecond);
event StreamCancelled(uint256 indexed streamId);
```

#### AgentMarketplace.sol

```solidity
function createListing(
    bytes32 agentId,
    uint256 ratePerHour,
    string calldata description
) external;
function hire(uint256 listingId, uint256 durationHours) external;
function completeEngagement(uint256 engagementId, uint8 rating) external;
function disputeEngagement(uint256 engagementId, string calldata reason) external;

event ListingCreated(uint256 indexed listingId, bytes32 indexed agentId, uint256 ratePerHour);
event AgentHired(uint256 indexed engagementId, uint256 indexed listingId, address indexed hirer);
event EngagementCompleted(uint256 indexed engagementId, uint8 rating);
event DisputeFiled(uint256 indexed engagementId, string reason);
```

### Deployment Order

1. `XorbEscrow.sol` — no dependencies
2. `AgentRegistry.sol` — depends on XorbEscrow
3. `ReputationScore.sol` — no dependencies (standalone ERC-8004)
4. `SlashingEngine.sol` — depends on AgentRegistry, XorbEscrow, ReputationScore
5. `ActionVerifier.sol` — depends on AgentRegistry, ReputationScore
6. `PaymentStreaming.sol` — depends on XorbEscrow
7. `AgentMarketplace.sol` — depends on AgentRegistry, XorbEscrow, ReputationScore

### Audit Status

- **Static analysis**: Slither + Mythril (passing, 0 high-severity findings)
- **Manual review**: Internal security review complete
- **Third-party audit**: Planned (Q3 2026)
- **Bug bounty**: Planned post-audit

---

## Deployment

```mermaid
flowchart TB
    subgraph edge["Edge"]
        CDN["CDN\n(Vercel Edge)"]
        LB["Load Balancer"]
    end

    subgraph compute["Compute"]
        API1["API Instance 1"]
        API2["API Instance 2"]
        API3["API Instance 3"]
        WORKER["Webhook Workers\n(2 instances)"]
    end

    subgraph data["Data"]
        PG[("Supabase PostgreSQL\n(Primary + 2 Replicas)")]
        REDIS[("Redis Cluster")]
    end

    subgraph chain["Blockchain"]
        BASE["Base L2 RPC\n(Alchemy / QuickNode)"]
        POLY["Polygon PoS RPC"]
        X402F["x402 Facilitator\n(Coinbase CDP)"]
    end

    subgraph monitor["Monitoring"]
        PROM["Prometheus"]
        GRAF["Grafana"]
        PD["PagerDuty"]
    end

    CDN --> LB
    LB --> API1
    LB --> API2
    LB --> API3
    API1 --> PG
    API2 --> PG
    API3 --> PG
    API1 --> REDIS
    API2 --> REDIS
    API3 --> REDIS
    API1 --> BASE
    API1 --> X402F
    WORKER --> PG
    API1 --> PROM
    PROM --> GRAF
    GRAF --> PD

    style edge fill:#1a1a2e,stroke:#533483,color:#fff
    style compute fill:#0f3460,stroke:#533483,color:#fff
    style data fill:#0d7377,stroke:#14ffec,color:#fff
    style chain fill:#533483,stroke:#7c3aed,color:#fff
    style monitor fill:#1a1a2e,stroke:#e94560,color:#fff
```

### Docker (Production)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3400
CMD ["node", "dist/server.js"]
```

### Railway / Fly.io

```bash
# Railway
railway init
railway link
railway up

# Fly.io
fly launch --image ghcr.io/xorb-xyz/xorb-api:latest
fly secrets set DATABASE_URL=postgresql://... CHAIN_RPC_URL=https://...
fly deploy
```

### Database Migrations

```bash
# Using Supabase CLI
npx supabase db push                  # Apply migrations
npx supabase db reset                 # Reset and reapply (dev only)
npx supabase db diff --schema public  # Generate migration from schema changes
```

### Scaling

| Component | Scaling Strategy | Notes |
|-----------|-----------------|-------|
| API Server | Horizontal (add instances) | Stateless — scale to match request volume |
| PostgreSQL | Vertical + read replicas | Write to primary, read from replicas |
| Redis | Horizontal (cluster mode) | Shard by agent ID |
| Webhook Workers | Horizontal | Independent queue consumers |
| Smart Contracts | N/A | Throughput limited by chain block time |

---

## Security

### Encryption

| Layer | Method |
|-------|--------|
| At rest | AES-256 (Supabase managed encryption) |
| In transit | TLS 1.3 (enforced, HSTS enabled) |
| Audit hashes | SHA-256, anchored on-chain |
| API keys | SHA-256 hashed before storage |
| Webhook signatures | HMAC-SHA256 |

### Authentication

- **SIWE (Sign-In With Ethereum)** — EIP-4361 wallet-based authentication. No passwords. No email.
- **API Keys** — SHA-256 hashed, scoped to specific permissions, rotatable, with expiration.
- Both methods produce a bearer token used in the `Authorization` header.

### Authorization

- **Sponsor-scoped RLS** — Every Supabase query is filtered by the authenticated sponsor's wallet address via Row Level Security. Sponsors can only read/write their own agents, actions, and configurations.
- **Agent-scoped actions** — Agents can only execute actions permitted by their gate configuration. The 8-gate pipeline enforces this on every request.

### Rate Limiting (Three Layers)

| Layer | Scope | Limit | Backend |
|-------|-------|-------|---------|
| IP | Per source IP | 1,000 requests/minute | Nginx / CDN |
| Wallet | Per sponsor wallet | 500 requests/minute | Redis |
| Agent | Per agent (Gate 2) | Configurable per agent | Redis |

### Economic Security

- USDC bonds create real financial stake
- Automated slashing removes human delay from enforcement
- Graduated severity prevents over-punishment for minor issues
- 50/50 slash distribution incentivizes sponsor monitoring
- Bond requirements scale with agent permissions

### Agent Containment

The 8-gate pipeline ensures no agent can:
- Execute actions outside its role (Gate 1)
- Exceed its rate limit (Gate 2)
- Spend more than its cap (Gate 3)
- Access resources outside its scope (Gate 4)
- Skip audit logging (Gate 5 — always runs)
- Bypass human approval requirements (Gate 6)
- Operate after its access expires (Gate 7)
- Perform actions above its reputation tier (Gate 8)

### Vulnerability Disclosure

- **Email**: security@xorb.xyz
- **Response time**: 24 hours for initial acknowledgment
- **Responsible disclosure**: 90-day disclosure window
- **Scope**: API, smart contracts, SDKs, MCP server

---

## Roadmap

```mermaid
gantt
    title Xorb Development Roadmap
    dateFormat YYYY-MM
    axisFormat %b %Y

    section Phase 1 - Foundation
    Core API and 8-gate pipeline         :done, p1a, 2025-06, 2025-09
    Agent registry and Supabase          :done, p1b, 2025-07, 2025-09
    Reputation engine                    :done, p1c, 2025-08, 2025-10
    Audit logging and hash generation    :done, p1d, 2025-09, 2025-10

    section Phase 2 - Economic Layer
    x402 payment integration             :active, p2a, 2025-11, 2026-02
    Smart contracts on Base              :active, p2b, 2025-12, 2026-03
    TypeScript SDK                       :active, p2c, 2026-01, 2026-03
    Python SDK                           :active, p2d, 2026-02, 2026-04
    Bonding and slashing live            :active, p2e, 2026-02, 2026-04

    section Phase 3 - Ecosystem
    MCP server                           :p3a, 2026-04, 2026-06
    Marketplace with escrow              :p3b, 2026-04, 2026-07
    Compliance reporting                 :p3c, 2026-05, 2026-07
    Developer dashboard                  :p3d, 2026-05, 2026-08
    Webhook and SSE event delivery       :p3e, 2026-05, 2026-06

    section Phase 4 - Scale
    Enterprise self-hosted               :p4a, 2026-08, 2026-11
    A2A protocol support                 :p4b, 2026-09, 2026-12
    ERC-8004 cross-platform federation   :p4c, 2026-09, 2027-01
    Google AP2 integration               :p4d, 2026-10, 2027-01
    Mobile SDK                           :p4e, 2026-10, 2027-02
    Third-party security audit           :p4f, 2026-07, 2026-09
```

### Current Status

| Phase | Status | Key Milestone |
|-------|--------|---------------|
| Phase 1 — Foundation | Complete | 8-gate pipeline operational, reputation engine live |
| Phase 2 — Economic Layer | In Progress | x402 integrated, smart contracts in final testing on Base testnet |
| Phase 3 — Ecosystem | Next | MCP server and marketplace in design, compliance templates drafted |
| Phase 4 — Scale | Future | Enterprise architecture planned, A2A/AP2 research underway |

---

## Ecosystem

```mermaid
flowchart TB
    subgraph frameworks["Agent Frameworks"]
        LC["LangChain"]
        CA["CrewAI"]
        AG["AutoGen"]
        OC["OpenClaw"]
    end

    subgraph comms["Communication Protocols"]
        MCP_P["MCP\n(Anthropic)"]
        A2A_P["A2A\n(Google)"]
    end

    subgraph trust["Trust Layer"]
        XORB["Xorb\n8-Gate Pipeline\nIdentity + Reputation\nBonding + Slashing"]
    end

    subgraph payments["Payment Rails"]
        X402_P["x402\n(Coinbase)"]
        AP2_P["AP2\n(Google)"]
    end

    subgraph identity["Identity Standard"]
        ERC["ERC-8004\nPortable Agent Identity"]
    end

    subgraph settlement["Settlement"]
        BASE_S["Base L2"]
        POLY_S["Polygon PoS"]
        SOL_S["Solana"]
    end

    frameworks --> comms
    comms --> trust
    trust --> payments
    trust --> identity
    payments --> settlement
    identity --> settlement

    style frameworks fill:#1a1a2e,stroke:#533483,color:#fff
    style comms fill:#0f3460,stroke:#533483,color:#fff
    style trust fill:#0d7377,stroke:#14ffec,color:#fff
    style payments fill:#533483,stroke:#7c3aed,color:#fff
    style identity fill:#533483,stroke:#7c3aed,color:#fff
    style settlement fill:#1a1a2e,stroke:#e94560,color:#fff
```

### Protocol Compatibility

| Protocol | Relationship | Status |
|----------|-------------|--------|
| **x402** (Coinbase) | Xorb uses x402 for all paid API calls. Xorb is a resource server in the x402 ecosystem — any x402-enabled client can pay for Xorb API access without API keys or subscriptions. | Live |
| **ERC-8004** | Agent identities registered on Xorb are ERC-8004 compatible. Level 4 verified agents receive an ERC-8004 NFT encoding their reputation, capabilities, and verification status. This identity is portable to any ERC-8004 compatible platform (SATI, Signet, AgentFolio). | Live |
| **MCP** (Anthropic) | The `@xorb/mcp` server wraps the 8-gate pipeline as MCP tools. Any MCP-connected agent gets security gating without code changes. | Phase 3 |
| **A2A** (Google) | Planned: Xorb's webhook/event system will emit and receive A2A-formatted messages, enabling agent-to-agent communication through Xorb's security layer. | Phase 4 |
| **AP2** (Google) | Planned: Xorb's Gate 6 (Human Override) maps directly to AP2's mandate concept — human approval for high-value agent actions. Integration will allow AP2 mandates to flow through the Xorb pipeline. | Phase 4 |
| **SATI** (Solana) | Xorb reputation data is interoperable with SATI's trust scores via ERC-8004 bridging. Agents with Xorb reputation can present verifiable trust credentials on Solana-based platforms. | Phase 4 |
| **Signet** | Signet's agent identity attestations can be consumed by Xorb as external verification signals. Xorb can export agent profiles in Signet-compatible formats. | Phase 4 |

---

## Business Model

### Pricing

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 1,000 gate checks/month, 5 agents, basic audit logs, community support |
| **Pay-per-use** | Per-action | $0.005/gate check, $0.10/registration, $0.001/reputation query, $0.25/compliance report |
| **Enterprise** | $2,000 - $10,000/month | Self-hosted deployment, custom gates, SLA (99.9%), dedicated support, compliance package |

### Revenue Streams

| Stream | Mechanism |
|--------|-----------|
| Gate checks | x402 micropayments per API call |
| Marketplace fees | 2% of escrow on completed engagements |
| Compliance reports | Per-report fee for formatted exports |
| Enterprise licenses | Monthly subscription for self-hosted + SLA |
| Bond custody | (Future) Yield on custodied USDC bonds via compliant DeFi strategies |

**No custom token. No speculation. USDC only.** Revenue is generated from infrastructure usage, not token appreciation. Every dollar of revenue comes from a developer or enterprise paying for a service they use.

---

## Comparison

| Feature | Xorb | SATI | Signet | Superagent | Arcade | CyberArk | DIY |
|---------|------|------|--------|------------|--------|----------|-----|
| 8-gate security pipeline | Yes | No | No | Partial | No | Partial | Build yourself |
| Economic bonding (USDC) | Yes | SOL-based | No | No | No | No | Build yourself |
| Automated slashing | Yes | Planned | No | No | No | No | Build yourself |
| Portable reputation (ERC-8004) | Yes | Custom | Attestations | No | No | No | No |
| x402 payments | Yes | No | No | No | No | No | No |
| MCP integration | Yes | No | No | No | Yes | No | Build yourself |
| Marketplace with escrow | Yes | No | No | No | No | No | Build yourself |
| Compliance reporting (EU AI Act) | Yes | No | No | No | No | Partial | Build yourself |
| Agent identity profiles | Full | Basic | Attestation-based | No | No | Enterprise IAM | Build yourself |
| Kill switch | Yes | No | No | No | No | Yes | Build yourself |
| On-chain audit anchoring | Yes | No | No | No | No | No | Build yourself |
| SDK (TypeScript + Python) | Yes | TypeScript | No | Python | TypeScript | Multiple | N/A |
| Human-in-the-loop gate | Yes | No | No | No | No | Yes | Build yourself |
| API-first (no UI required) | Yes | Yes | Yes | Partial | Yes | No | Depends |
| Per-action payments | Yes (x402) | No | No | No | No | No | No |
| Primary chain | Base | Solana | Ethereum | N/A | N/A | N/A | Depends |

---

## Contributing

### Getting Started

```bash
git clone https://github.com/xorb-xyz/xorb.git
cd xorb
pnpm install
pnpm dev
```

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes following the code style guidelines
4. Write tests (see testing requirements below)
5. Submit a pull request against `main`

### Code Style

- **TypeScript**: strict mode, ESLint (Airbnb base), Prettier (2-space indent, trailing commas)
- **Solidity**: solhint, NatSpec documentation on all public functions
- **Python**: black, isort, mypy strict

### Testing Requirements

- **Gate logic**: Unit tests for every gate, covering pass, fail, and edge cases
- **Pipeline integration**: End-to-end tests for the full 8-gate pipeline with mock and real databases
- **SDK**: Integration tests against a local API instance
- **Smart contracts**: Hardhat tests with full coverage for all state transitions
- **MCP server**: Tool-level tests for each exposed MCP tool

```bash
pnpm test              # All tests
pnpm test:gates        # Gate unit tests
pnpm test:pipeline     # Pipeline integration tests
pnpm test:contracts    # Smart contract tests
pnpm test:sdk          # SDK integration tests
```

### Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something is broken |
| `feature` | New functionality |
| `gate-logic` | Related to the 8-gate pipeline |
| `reputation` | Reputation engine changes |
| `contracts` | Smart contract work |
| `sdk` | TypeScript or Python SDK |
| `mcp` | MCP server |
| `docs` | Documentation |
| `x402` | Payment integration |

### Architecture Decision Records

Significant design decisions are documented as ADRs in `docs/adr/`. Before proposing a major architectural change, open an issue for discussion, then submit the ADR as part of your PR.

### Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be respectful, constructive, and professional.

---

## License & Legal

### Licensing

| Component | License |
|-----------|---------|
| TypeScript SDK (`@xorb/sdk`) | MIT |
| Python SDK (`xorb-sdk`) | MIT |
| MCP Server (`@xorb/mcp`) | MIT |
| Smart Contracts | MIT |
| Core API Server | BSL 1.1 (Business Source License) — converts to MIT after 3 years |
| Documentation | CC BY 4.0 |

### Data Processing

- Agent data (actions, reputation, violations) is stored in sponsor-scoped Supabase instances with Row Level Security.
- Agents are not natural persons — agent data is not personal data under GDPR.
- Sponsor data (wallet addresses, API keys, webhook URLs) follows standard GDPR practices: right to access, right to deletion, data portability.
- Audit hashes anchored on-chain are irreversible by design — this is a feature, not a limitation. The hash contains no personally identifiable information.

### GDPR

- **Data controller**: Sponsor (the entity deploying agents)
- **Data processor**: Xorb (processes agent actions on behalf of sponsors)
- **DPA**: Available on request for enterprise customers

---

## Links & Contact

| Resource | URL |
|----------|-----|
| Main site | [xorb.xyz](https://xorb.xyz) |
| Documentation | [docs.xorb.xyz](https://docs.xorb.xyz) |
| API base | [api.xorb.xyz](https://api.xorb.xyz) |
| Dashboard | [dashboard.xorb.xyz](https://dashboard.xorb.xyz) |
| Web3 identity | [x.orb](https://x.orb) (Handshake TLD) |
| GitHub | [github.com/xorb-xyz](https://github.com/xorb-xyz) |
| npm | [@xorb/sdk](https://www.npmjs.com/package/@xorb/sdk), [@xorb/mcp](https://www.npmjs.com/package/@xorb/mcp) |
| PyPI | [xorb-sdk](https://pypi.org/project/xorb-sdk/) |
| Discord | [discord.gg/xorb](https://discord.gg/xorb) |
| Twitter/X | [@xorb_xyz](https://x.com/xorb_xyz) |
| Email | hello@xorb.xyz |
| Security | security@xorb.xyz |
| Status | [status.xorb.xyz](https://status.xorb.xyz) |

---

<div align="center">

**Every agent action, verified.**

[Get Started](https://dashboard.xorb.xyz) · [Documentation](https://docs.xorb.xyz) · [API Reference](https://docs.xorb.xyz/api) · [Discord](https://discord.gg/xorb)

</div>
