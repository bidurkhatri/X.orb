# @xorb/sdk

TypeScript SDK for [X.orb](https://xorb.xyz) — the orchestration layer for AI agent trust.

## Install

```bash
npm install @xorb/sdk
```

## Quick Start

```typescript
import { XorbClient } from '@xorb/sdk'

const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: 'xorb_sk_...',
})

// Register an agent
const { agent } = await xorb.agents.register({
  name: 'my-bot',
  role: 'RESEARCHER',
  sponsor_address: '0x...',
})

// Execute action through 8-gate pipeline
const result = await xorb.actions.execute({
  agent_id: agent.agentId,
  action: 'query',
  tool: 'get_balance',
})

if (result.approved) {
  console.log('Approved!', result.audit_hash)
} else {
  const failed = result.gates.find(g => !g.passed)
  console.log('Blocked:', failed?.gate, failed?.reason)
}
```

## API

- `xorb.agents.register(params)` — Register agent
- `xorb.agents.list()` — List agents
- `xorb.agents.get(id)` — Get agent
- `xorb.agents.pause(id, address)` — Pause agent
- `xorb.agents.resume(id, address)` — Resume agent
- `xorb.agents.revoke(id, address)` — Revoke agent
- `xorb.actions.execute(params)` — Execute through 8-gate pipeline
- `xorb.actions.batch(actions)` — Batch execute
- `xorb.reputation.get(id)` — Get trust score
- `xorb.webhooks.subscribe(url, events)` — Subscribe to events
- `xorb.audit.get(id)` — Get audit log
- `xorb.health()` — Health check
- `xorb.pricing()` — Get pricing

## Links

- [API](https://api.xorb.xyz)
- [Dashboard](https://dashboard.xorb.xyz)
- [GitHub](https://github.com/bidurkhatri/X.orb)
