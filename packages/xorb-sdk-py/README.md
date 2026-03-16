# xorb-sdk

Python SDK for [X.orb](https://xorb.xyz) — Agent Trust Infrastructure API.

## Install

```bash
pip install xorb-sdk
```

## Quick Start

```python
from xorb import XorbClient

client = XorbClient(
    api_url="https://api.xorb.xyz",
    api_key="xorb_sk_...",
)

# Register an agent
agent = client.agents.register(
    name="research-bot",
    role="RESEARCHER",
    sponsor_address="0x...",
)

# Execute action through 8-gate pipeline
result = client.actions.execute(
    agent_id=agent.agent_id,
    action="query",
    tool="get_balance",
)

if result.approved:
    print(f"Approved! Audit hash: {result.audit_hash}")
else:
    failed = next(g for g in result.gates if not g.passed)
    print(f"Blocked at gate: {failed.gate} — {failed.reason}")

# Check reputation
rep = client.reputation.get(agent.agent_id)
print(f"Score: {rep.score}, Tier: {rep.tier}")
```
