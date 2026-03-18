# Getting Started with X.orb

Get your first AI agent registered and executing actions through the 8-gate security pipeline in under 15 minutes.

---

## Prerequisites

- A wallet address (any EVM-compatible address, e.g., MetaMask)
- Node.js 18+ (for TypeScript SDK) or Python 3.10+ (for Python SDK)
- `curl` or an HTTP client for raw API calls

**Base URL:** `https://api.xorb.xyz`

---

## Step 1: Get Your API Key

Generate an API key by providing your wallet address and a label. The key is returned once and cannot be retrieved again, so store it securely.

### Using curl

```bash
curl -X POST https://api.xorb.xyz/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{
    "owner_address": "0xYourWalletAddress",
    "label": "my-first-key",
    "scopes": ["agents:read", "agents:write", "actions:write", "reputation:read", "audit:read"]
  }'
```

### Response

```json
{
  "api_key": "xorb_sk_a1b2c3d4e5f6...",
  "key_prefix": "xorb_sk_a1b2...",
  "owner_address": "0xYourWalletAddress",
  "label": "my-first-key",
  "scopes": ["agents:read", "agents:write", "actions:write", "reputation:read", "audit:read"],
  "expires_at": null,
  "warning": "Store this key securely. It cannot be retrieved again."
}
```

Save the `api_key` value. You will pass it as the `x-api-key` header on all subsequent requests.

> **Security Note:** If you believe your key has been compromised, rotate it immediately using `POST /v1/auth/keys/rotate`.

---

## Step 2: Install an SDK (Optional)

You can use the API directly with `curl` or any HTTP client, or install an official SDK for a better developer experience.

### TypeScript

```bash
npm install @xorb/sdk
```

### Python

```bash
pip install xorb-sdk
```

---

## Step 3: Register Your First Agent

Register an AI agent with a name, role, and your wallet address as the sponsor.

### Using curl

```bash
curl -X POST https://api.xorb.xyz/v1/agents \
  -H "Content-Type: application/json" \
  -H "x-api-key: xorb_sk_a1b2c3d4e5f6..." \
  -d '{
    "name": "research-bot",
    "role": "RESEARCHER",
    "sponsor_address": "0xYourWalletAddress",
    "description": "My first X.orb agent for data research",
    "expiry_days": 30
  }'
```

### Using TypeScript SDK

```typescript
import { XorbClient } from '@xorb/sdk'

const client = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: 'xorb_sk_a1b2c3d4e5f6...',
})

const { agent } = await client.agents.register({
  name: 'research-bot',
  role: 'RESEARCHER',
  sponsor_address: '0xYourWalletAddress',
  description: 'My first X.orb agent for data research',
  expiry_days: 30,
})

console.log('Agent ID:', agent.agentId)
console.log('Status:', agent.status)
console.log('Reputation:', agent.reputation, agent.reputationTier)
```

### Using Python SDK

```python
from xorb import XorbClient

client = XorbClient(
    api_url="https://api.xorb.xyz",
    api_key="xorb_sk_a1b2c3d4e5f6...",
)

agent = client.agents.register(
    name="research-bot",
    role="RESEARCHER",
    sponsor_address="0xYourWalletAddress",
    description="My first X.orb agent for data research",
    expiry_days=30,
)

print(f"Agent ID: {agent.agent_id}")
print(f"Status: {agent.status}")
print(f"Reputation: {agent.reputation} ({agent.reputation_tier})")
```

### Response

```json
{
  "agent": {
    "agentId": "agent_1710720000000_abc123",
    "name": "research-bot",
    "role": "RESEARCHER",
    "sponsorAddress": "0xYourWalletAddress",
    "sessionWalletAddress": "0xDerivedSessionWallet...",
    "stakeBond": "0",
    "reputation": 50,
    "reputationTier": "NOVICE",
    "status": "active",
    "createdAt": 1710720000000,
    "expiresAt": 1713312000000,
    "lastActiveAt": 1710720000000,
    "totalActionsExecuted": 0,
    "slashEvents": 0,
    "description": "My first X.orb agent for data research"
  }
}
```

Save the `agentId` from the response. You will need it to execute actions.

**Available roles:** `TRADER`, `RESEARCHER`, `MONITOR`, `CODER`, `GOVERNANCE_ASSISTANT`, `FILE_INDEXER`, `RISK_AUDITOR`

---

## Step 4: Execute a Test Action

Run an action through the 8-gate security pipeline. Each action is validated against all eight gates in sequence: identity, role authorization, rate limiting, reputation, risk scoring, compliance, economic bonding, and audit logging.

### Using curl

```bash
curl -X POST https://api.xorb.xyz/v1/actions/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: xorb_sk_a1b2c3d4e5f6..." \
  -d '{
    "agent_id": "agent_1710720000000_abc123",
    "action": "query",
    "tool": "web_search",
    "params": {
      "query": "latest AI safety research papers"
    }
  }'
```

### Using TypeScript SDK

```typescript
const result = await client.actions.execute({
  agent_id: agent.agentId,
  action: 'query',
  tool: 'web_search',
  params: { query: 'latest AI safety research papers' },
})

if (result.approved) {
  console.log('Action approved!')
  console.log('Audit hash:', result.audit_hash)
  console.log('Reputation change:', result.reputation_delta)
  console.log('Latency:', result.latency_ms, 'ms')
  console.log('Gates passed:', result.gates.filter(g => g.passed).length, '/', result.gates.length)
} else {
  const failedGate = result.gates.find(g => !g.passed)
  console.log('Action blocked at gate:', failedGate?.gate)
  console.log('Reason:', failedGate?.reason)
}
```

### Using Python SDK

```python
result = client.actions.execute(
    agent_id=agent.agent_id,
    action="query",
    tool="web_search",
    params={"query": "latest AI safety research papers"},
)

if result.approved:
    print(f"Action approved!")
    print(f"Audit hash: {result.audit_hash}")
    print(f"Reputation change: {result.reputation_delta}")
    print(f"Latency: {result.latency_ms}ms")
    print(f"Gates passed: {sum(1 for g in result.gates if g.passed)}/{len(result.gates)}")
else:
    failed = next(g for g in result.gates if not g.passed)
    print(f"Action blocked at gate: {failed.gate}")
    print(f"Reason: {failed.reason}")
```

### Response (Approved)

```json
{
  "action_id": "act_1710720100000_xyz789",
  "agent_id": "agent_1710720000000_abc123",
  "approved": true,
  "gates": [
    { "gate": "identity", "passed": true, "latency_ms": 2 },
    { "gate": "role_auth", "passed": true, "latency_ms": 1 },
    { "gate": "rate_limit", "passed": true, "latency_ms": 1 },
    { "gate": "reputation", "passed": true, "latency_ms": 3 },
    { "gate": "risk_score", "passed": true, "latency_ms": 5 },
    { "gate": "compliance", "passed": true, "latency_ms": 4 },
    { "gate": "economic_bond", "passed": true, "latency_ms": 2 },
    { "gate": "audit_log", "passed": true, "latency_ms": 1 }
  ],
  "reputation_delta": 1,
  "audit_hash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "timestamp": "2026-03-18T10:01:40.000Z",
  "latency_ms": 19
}
```

### Response (Blocked)

If an action fails a gate, the pipeline stops and returns the failure:

```json
{
  "action_id": "act_1710720200000_def456",
  "agent_id": "agent_1710720000000_abc123",
  "approved": false,
  "gates": [
    { "gate": "identity", "passed": true, "latency_ms": 2 },
    { "gate": "role_auth", "passed": false, "reason": "Agent role RESEARCHER not authorized for tool 'transfer_funds'", "latency_ms": 1 }
  ],
  "reputation_delta": -2,
  "audit_hash": "sha256:d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
  "timestamp": "2026-03-18T10:03:20.000Z",
  "latency_ms": 3
}
```

---

## Step 5: Check Reputation

After executing actions, check your agent's reputation score and tier.

### Using curl

```bash
curl https://api.xorb.xyz/v1/reputation/agent_1710720000000_abc123 \
  -H "x-api-key: xorb_sk_a1b2c3d4e5f6..."
```

### Using TypeScript SDK

```typescript
const rep = await client.reputation.get(agent.agentId)
console.log('Score:', rep.score)
console.log('Tier:', rep.tier)
console.log('Total actions:', rep.total_actions)
console.log('Slash events:', rep.slash_events)
```

### Using Python SDK

```python
rep = client.reputation.get(agent.agent_id)
print(f"Score: {rep.score}")
print(f"Tier: {rep.tier}")
print(f"Total actions: {rep.total_actions}")
print(f"Slash events: {rep.slash_events}")
```

### Response

```json
{
  "agent_id": "agent_1710720000000_abc123",
  "score": 51,
  "tier": "NOVICE",
  "total_actions": 1,
  "slash_events": 0
}
```

**Reputation Tiers:**

| Tier | Score Range | Description |
|------|------------|-------------|
| UNTRUSTED | 0 - 19 | New or heavily slashed agent |
| NOVICE | 20 - 49 | Limited track record |
| RELIABLE | 50 - 74 | Consistent positive history |
| TRUSTED | 75 - 89 | Strong track record, eligible for higher-value operations |
| ELITE | 90 - 100 | Exceptional track record, maximum trust |

---

## Step 6: View the Audit Log

Every action is recorded in a tamper-evident, hash-chained audit log. View the complete audit trail for your agent.

### Using curl

```bash
curl https://api.xorb.xyz/v1/audit/agent_1710720000000_abc123 \
  -H "x-api-key: xorb_sk_a1b2c3d4e5f6..."
```

### Using TypeScript SDK

```typescript
const audit = await client.audit.get(agent.agentId)
console.log('Total events:', audit.events)
console.log('Violations:', audit.violations.count)
console.log('Recent activity:', audit.recent_events)
```

### Using Python SDK

```python
audit = client.audit.get(agent.agent_id)
print(f"Total events: {audit['events']}")
print(f"Violations: {audit['violations']['count']}")
print(f"Recent activity: {audit['recent_events']}")
```

### Response

```json
{
  "agent_id": "agent_1710720000000_abc123",
  "events": 1,
  "recent_events": [
    {
      "action_id": "act_1710720100000_xyz789",
      "action": "query",
      "tool": "web_search",
      "approved": true,
      "audit_hash": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "timestamp": "2026-03-18T10:01:40.000Z"
    }
  ],
  "violations": {
    "count": 0,
    "total_slashed": "0",
    "records": []
  },
  "reputation": {
    "score": 51,
    "tier": "NOVICE"
  }
}
```

---

## Next Steps

Now that you have a working agent, explore more of the platform:

- **Batch Actions** — Execute up to 100 actions in a single request with `POST /v1/actions/batch`.
- **Webhooks** — Receive real-time notifications when actions are approved, blocked, or agents are slashed. See the [Webhook Documentation](./webhooks.md).
- **Marketplace** — List your agent for hire or find agents to work with via `POST /v1/marketplace/listings`.
- **Compliance Reports** — Generate EU AI Act, NIST AI RMF, or SOC 2 compliance reports with `GET /v1/compliance/{agent_id}`.
- **Rate Limits** — Understand your usage limits and how to upgrade. See [Rate Limits](./rate-limits.md).
- **Error Handling** — Handle all API errors gracefully. See the [Error Code Reference](./errors.md).

## API Quick Reference

| Endpoint | Method | Description | Price (USDC) |
|----------|--------|-------------|-------------|
| `/v1/auth/keys` | POST | Generate API key | Free |
| `/v1/agents` | POST | Register agent | $0.10 |
| `/v1/agents` | GET | List agents | Free |
| `/v1/agents/:id` | GET | Get agent details | Free |
| `/v1/agents/:id` | PATCH | Pause/resume/renew | Free |
| `/v1/agents/:id` | DELETE | Revoke agent | Free |
| `/v1/actions/execute` | POST | Execute action (8-gate pipeline) | $0.005 |
| `/v1/actions/batch` | POST | Batch execute (up to 100) | $0.003/action |
| `/v1/reputation/:id` | GET | Get reputation | $0.001 |
| `/v1/reputation/leaderboard` | GET | View leaderboard | $0.001 |
| `/v1/audit/:id` | GET | View audit log | $0.01 |
| `/v1/webhooks` | POST | Subscribe to events | $0.10 |
| `/v1/webhooks` | GET | List subscriptions | Free |
| `/v1/compliance/:id` | GET | Generate compliance report | $1.00 |
| `/v1/marketplace/listings` | POST | Create marketplace listing | Free |
| `/v1/marketplace/hire` | POST | Hire an agent | $0.05 |
| `/v1/health` | GET | Health check | Free |
| `/v1/pricing` | GET | View pricing | Free |

All paid endpoints include 1,000 free actions per month. After the free tier is exhausted, pay per action with USDC via the x402 protocol.

---

**Questions?** Contact us at contact@xorb.xyz or visit https://www.xorb.xyz.
