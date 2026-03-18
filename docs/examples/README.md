# X.orb Basic Agent Example

A complete, working TypeScript example that demonstrates the full lifecycle of an AI agent on the X.orb platform: registration, action execution through the 8-gate security pipeline, reputation checking, and audit log retrieval.

## Prerequisites

- Node.js 18 or later
- An X.orb API key (generate one at `POST https://api.xorb.xyz/v1/auth/keys`)
- An EVM-compatible wallet address

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export XORB_API_KEY="xorb_sk_your_key_here"
export SPONSOR_ADDRESS="0xYourWalletAddress"

# Optional: use a custom API URL (defaults to https://api.xorb.xyz)
export XORB_API_URL="https://api.xorb.xyz"
```

## Run

```bash
# Run directly with tsx (no build step needed)
npm start

# Or build and run
npm run build
npm run start:built
```

## What It Does

1. **Connects** to the X.orb API and verifies health.
2. **Registers** a new agent with the `RESEARCHER` role.
3. **Executes** a `query` action through all 8 security gates (identity, role authorization, rate limiting, reputation, risk scoring, compliance, economic bonding, audit logging).
4. **Checks** the agent's reputation score and tier after the action.
5. **Retrieves** the agent's audit log showing the tamper-evident action history.
6. **Displays** current endpoint pricing.

## Expected Output

```
Connected to X.orb API (version 1.0.0)
---
Registering agent...
Agent registered:
  ID:         agent_1710720000000_abc123
  Name:       example-research-bot
  Role:       RESEARCHER
  Status:     active
  Reputation: 50 (NOVICE)
  Wallet:     0xDerivedSessionWallet...
---
Executing action: query / web_search ...
Action APPROVED
  Action ID:   act_1710720100000_xyz789
  Audit Hash:  sha256:9f86d081...
  Rep Delta:   +1
  Latency:     19ms
  Gates:
    [PASS] identity (2ms)
    [PASS] role_auth (1ms)
    [PASS] rate_limit (1ms)
    [PASS] reputation (3ms)
    [PASS] risk_score (5ms)
    [PASS] compliance (4ms)
    [PASS] economic_bond (2ms)
    [PASS] audit_log (1ms)
---
Checking reputation...
  Score:         51
  Tier:          NOVICE
  Total Actions: 1
  Slash Events:  0
---
Fetching audit log...
  Total Events:  1
  Violations:    0
  Latest Event:
    Action:    query
    Tool:      web_search
    Approved:  true
    Hash:      sha256:9f86d081...
    Time:      2026-03-18T10:01:40.000Z
---
Endpoint Pricing:
  POST /v1/agents                     $0.1 USDC — Agent registration
  POST /v1/actions/execute            $0.005 USDC — Per-action gate check
  ...
  Free tier: 1000 actions/month
---
Done. Your agent is live and ready to execute actions.
```

## Next Steps

- Modify the action type and tool to test different gate behaviors.
- Try a role that is not authorized for the tool to see a `role_auth` gate block.
- Execute multiple actions to watch the reputation score increase.
- Set up [webhooks](../webhooks.md) to get real-time notifications.
- Explore the [error codes](../errors.md) to build resilient error handling.
