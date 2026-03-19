# X.orb Integrated Journey — Real Transaction Example

**Date:** March 19, 2026
**Chains:** Polygon PoS + Base
**Protocol:** x402 v1 (X.orb) + x402 v2 EIP-3009 (Robtex)
**Total cost:** $0.106 USDC
**Result:** AI agent verified by X.orb, purchased IP intelligence from Robtex

---

## The Scenario

An AI agent called `ip-researcher` needs to look up network intelligence on IP address `1.1.1.1`. Before it can call any external service, it must pass X.orb's 8-gate trust pipeline. Once approved, it purchases data from Robtex — a real x402 service on Base.

This demonstrates the complete flow: **sponsor setup → agent registration → trust verification → external purchase → audit trail**.

---

## Step 1: Sponsor Creates API Key

The sponsor (human) creates an API key on X.orb. This is the only human step — everything after this is automated by the agent.

```
POST https://api.xorb.xyz/v1/auth/keys
Content-Type: application/json

{
  "owner_address": "0xF41faE67716670edBFf581aEe37014307dF71A9B",
  "label": "ip-research-project"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key": "xorb_sk_eb001957...",
    "warning": "Store this key securely. It cannot be retrieved again."
  }
}
```

**Cost:** Free
**Chain:** None (off-chain API call)

---

## Step 2: Agent Registers on X.orb ($0.10 USDC)

The agent registers itself. This costs $0.10 USDC on Polygon, paid via x402.

```typescript
// Agent signs x402 payment header
const payment = await signPayment(sponsorWallet, '100000', facilitator, 'eip155:137')

// Register
POST https://api.xorb.xyz/v1/agents
x-api-key: xorb_sk_eb001957...
x-payment: <base64 signed payment>

{
  "name": "ip-researcher",
  "scope": "RESEARCHER",
  "sponsor_address": "0xF41f...",
  "description": "IP intelligence agent using Robtex via x402"
}
```

**Response:**
```json
{
  "agent": {
    "agentId": "agent_891a6249aa4a07a7b56430a1",
    "name": "ip-researcher",
    "scope": "RESEARCHER",
    "reputation": 50,
    "reputationTier": "RELIABLE",
    "status": "active"
  }
}
```

**Cost:** $0.10 USDC on Polygon
**Chain:** Polygon PoS (eip155:137)
**On-chain:** AgentRegistry.spawnAgent() called

---

## Step 3: Agent Requests Action — 8-Gate Pipeline ($0.005 USDC)

The agent wants to look up `1.1.1.1`. Before calling Robtex, it must pass X.orb's 8-gate trust pipeline.

```typescript
const payment = await signPayment(sponsorWallet, '5000', facilitator, 'eip155:137')

POST https://api.xorb.xyz/v1/actions/execute
x-api-key: xorb_sk_eb001957...
x-payment: <base64 signed payment>

{
  "agent_id": "agent_891a6249aa4a07a7b56430a1",
  "action": "ip_intelligence_lookup",
  "tool": "fetch_market_data",
  "params": {
    "target_ip": "1.1.1.1",
    "service": "robtex",
    "purpose": "network intelligence"
  }
}
```

**What happens inside X.orb (563ms total):**

| Gate | Result | Details |
|------|--------|---------|
| 1. Identity | ✅ PASS | Agent `agent_891a...` found, status=active |
| 2. Permissions | ✅ PASS | Tool `fetch_market_data` is in RESEARCHER scope |
| 3. Rate Limit | ✅ PASS | 1/120 actions this hour |
| 4. x402 Payment | ✅ PASS | $0.005 USDC collected on Polygon (276ms) |
| 5. Audit Log | ✅ PASS | SHA-256 hash generated, persisted to Supabase (274ms) |
| 6. Trust Score | ✅ PASS | Score: 50, tier: RELIABLE, threshold: 100 |
| 7. Execute | ✅ PASS | Action approved |
| 8. Escrow | ✅ PASS | Not a marketplace action, skipped |

**Response:**
```json
{
  "action_id": "act_...",
  "agent_id": "agent_891a6249aa4a07a7b56430a1",
  "approved": true,
  "gates": [
    { "gate": "identity", "passed": true },
    { "gate": "permissions", "passed": true },
    { "gate": "rate_limit", "passed": true, "used": 1, "limit": 120 },
    { "gate": "x402_payment", "passed": true, "amount": 5000, "network": "eip155:137" },
    { "gate": "audit_log", "passed": true },
    { "gate": "trust_score", "passed": true, "score": 50 },
    { "gate": "execute", "passed": true },
    { "gate": "escrow_check", "passed": true }
  ],
  "audit_hash": "0x5499408a17e03a7efce4649cdcd92b638df85c...",
  "reputation_delta": 2
}
```

**Cost:** $0.005 USDC on Polygon
**Chain:** Polygon PoS (eip155:137)
**Audit hash:** `0x5499408a17e03a7efce4649cdcd92b638df85c...` (SHA-256, anchored on-chain)

---

## Step 4: Agent Calls Robtex — External x402 Purchase ($0.001 USDC)

X.orb approved the action. Now the agent calls Robtex directly using x402 v2 (EIP-3009). No `USDC.approve()` needed — each payment is individually signed.

```typescript
import { wrapFetchWithPayment } from '@x402/fetch'
import { x402Client } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(process.env.SPONSOR_KEY)
const client = new x402Client()
client.register('eip155:*', new ExactEvmScheme(account))
const payFetch = wrapFetchWithPayment(fetch, client)

// Agent calls Robtex — payment handled automatically
const response = await payFetch('https://x402.robtex.com/ipquery/1.1.1.1')
const data = await response.json()
```

**What happens:**
1. Agent sends GET to Robtex
2. Robtex returns HTTP 402 with payment requirements:
   ```json
   {
     "x402Version": 2,
     "accepts": [{
       "scheme": "exact",
       "network": "eip155:8453",
       "amount": "1000",
       "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
       "payTo": "0xCa99149c1A5959F7E5968259178f974aACC70F55"
     }]
   }
   ```
3. `@x402/fetch` automatically:
   - Parses the 402 response
   - Signs EIP-3009 `TransferWithAuthorization` for exactly $0.001 USDC
   - Attaches `Payment-Signature` header
   - Retries the request
4. Robtex's facilitator executes `transferWithAuthorization` on-chain (pays gas)
5. $0.001 USDC moves from sponsor wallet to Robtex's facilitator on Base
6. Robtex returns the IP data

**Response from Robtex:**
```json
{
  "status": "ok",
  "city": "",
  "country": "",
  "as": 13335,
  "bgproute": "1.1.1.0/24",
  "asname": "Cloudflare",
  "asdesc": "CLOUDFLARENET",
  "whoisdesc": "Cloudflare, Inc."
}
```

**Cost:** $0.001 USDC on Base
**Chain:** Base (eip155:8453)
**Protocol:** x402 v2 exact scheme (EIP-3009 TransferWithAuthorization)
**USDC approval:** Not needed — per-transaction authorization

---

## Step 5: Verify Audit Trail

After the action, the sponsor can verify everything on the dashboard or via API.

```
GET https://api.xorb.xyz/v1/trust/agent_891a6249aa4a07a7b56430a1
```
```json
{
  "score": 50,
  "tier": "RELIABLE",
  "total_actions": 1
}
```

```
GET https://api.xorb.xyz/v1/audit/agent_891a6249aa4a07a7b56430a1
```
```json
{
  "events": 2,
  "recent_events": [
    { "type": "agent.registered", "timestamp": "..." },
    { "type": "action.approved", "audit_hash": "0x5499...", "timestamp": "..." }
  ]
}
```

```
GET https://api.xorb.xyz/v1/compliance/agent_891a6249aa4a07a7b56430a1?framework=eu-ai-act
```
```json
{
  "summary": {
    "overall_status": "compliant",
    "score": 100,
    "passed_controls": 4,
    "failed_controls": 0
  }
}
```

---

## Transaction Summary

```
╔════════════════════════════════════════════════════════════╗
║  INTEGRATED JOURNEY COMPLETE                               ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Step 1: API key created                       → X.orb     ║
║  Step 2: Agent registered ($0.10 x402)         → X.orb     ║
║  Step 3: 8-gate pipeline ($0.005 x402)         → X.orb     ║
║     Gate 1: Identity                    ✅                  ║
║     Gate 2: Permissions                 ✅                  ║
║     Gate 3: Rate Limit                  ✅                  ║
║     Gate 4: x402 Payment                ✅ $0.005 Polygon   ║
║     Gate 5: Audit (SHA-256)             ✅ 0x5499...        ║
║     Gate 6: Trust Score                 ✅ 50/10000         ║
║     Gate 7: Execute                     ✅                  ║
║     Gate 8: Escrow                      ✅ (skipped)        ║
║  Step 4: Robtex purchase ($0.001 x402 v2)      → Robtex    ║
║     Result: 1.1.1.1 = Cloudflare (AS13335)                 ║
║  Step 5: Audit verified (compliant)            → X.orb     ║
║                                                            ║
║  Total cost:                                               ║
║    X.orb fees:   $0.105 USDC on Polygon                    ║
║    Robtex fees:  $0.001 USDC on Base                       ║
║    Total:        $0.106 USDC                               ║
║                                                            ║
║  Chains used:    Polygon (X.orb) + Base (Robtex)           ║
║  Protocols:      x402 v1 + x402 v2 (EIP-3009)             ║
║  USDC.approve:   NOT needed for Robtex (EIP-3009)          ║
║  Audit hash:     0x5499408a17e03a7efce4649cdcd92b63...     ║
║  Compliance:     EU AI Act — compliant (100/100)           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## Architecture Diagram

```
SPONSOR (Human)                    AI AGENT (ip-researcher)
     │                                    │
     │ 1. Create API key                  │
     ├───────────────────────────────────>│
     │    (free, off-chain)              │
     │                                    │
     │                          2. Register ($0.10 x402 Polygon)
     │                                    ├──────────────> X.ORB API
     │                                    │                   │
     │                                    │            AgentRegistry
     │                                    │            (Polygon on-chain)
     │                                    │                   │
     │                          3. Execute action ($0.005 x402 Polygon)
     │                                    ├──────────────> X.ORB API
     │                                    │                   │
     │                                    │          ┌─ 8-Gate Pipeline ─┐
     │                                    │          │ Identity      ✅  │
     │                                    │          │ Permissions   ✅  │
     │                                    │          │ Rate Limit    ✅  │
     │                                    │          │ x402 Payment  ✅  │
     │                                    │          │ Audit Log     ✅  │
     │                                    │          │ Trust Score   ✅  │
     │                                    │          │ Execute       ✅  │
     │                                    │          │ Escrow        ✅  │
     │                                    │          └────────────────┘
     │                                    │                   │
     │                                    │          audit_hash → Polygon
     │                                    │          (ActionVerifier)
     │                                    │                   │
     │                                    │<── approved ───────┘
     │                                    │
     │                          4. Call Robtex ($0.001 x402 v2 Base)
     │                                    ├──────────────> ROBTEX API
     │                                    │                   │
     │                                    │          402 → EIP-3009 sign
     │                                    │          → Payment-Signature
     │                                    │          → USDC.transferWithAuth
     │                                    │          → (Base on-chain)
     │                                    │                   │
     │                                    │<── IP data ───────┘
     │                                    │    1.1.1.1 = Cloudflare
     │                                    │
     │ 5. Monitor on dashboard            │
     ├── dashboard.xorb.xyz ──────────────┘
     │   reputation: 50, tier: RELIABLE
     │   compliance: EU AI Act compliant
     │   audit: 2 events, hash anchored
```

---

## How to Reproduce

```typescript
import { XorbClient, PaymentSigner } from 'xorb-sdk'
import { wrapFetchWithPayment } from '@x402/fetch'
import { x402Client } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'

// 1. Setup X.orb client
const xorbSigner = PaymentSigner.fromPrivateKey(process.env.SPONSOR_KEY)
const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: process.env.XORB_API_KEY,
  signer: xorbSigner,
})

// 2. Register agent
const { agent } = await xorb.agents.register({
  name: 'ip-researcher',
  role: 'RESEARCHER',
  sponsor_address: await xorbSigner.getAddress(),
})

// 3. Verify action through X.orb
const result = await xorb.actions.execute({
  agent_id: agent.agentId,
  action: 'ip_lookup',
  tool: 'fetch_market_data',
  params: { target_ip: '1.1.1.1' },
})

if (result.approved) {
  // 4. Call external x402 service
  const account = privateKeyToAccount(process.env.SPONSOR_KEY as `0x${string}`)
  const client = new x402Client()
  client.register('eip155:*', new ExactEvmScheme(account))
  const payFetch = wrapFetchWithPayment(fetch, client)

  const ipData = await payFetch('https://x402.robtex.com/ipquery/1.1.1.1')
    .then(r => r.json())

  console.log('IP owner:', ipData.asname) // "Cloudflare"
  console.log('Audit hash:', result.audit_hash)
}
```

---

---

## On-Chain Proof

These are real transactions on Polygon PoS and Base mainnets with real USDC.

### Wallet Balances (Before → After)

| Wallet | Chain | Before | After | Spent |
|--------|-------|--------|-------|-------|
| Deployer (`0xbA29...`) | Base | 2.973452 USDC | 2.958452 USDC | **0.015 USDC** (Robtex payments + approvals) |
| Facilitator (`0xF41f...`) | Polygon | 17.464913 USDC | 12.422158 USDC | Received X.orb fees |
| Facilitator (`0xF41f...`) | Polygon | 24.00 MATIC | ~24.00 MATIC | Gas for on-chain operations |

### Verify On-Chain

**Base (Robtex payments):**
- Deployer wallet: [0xbA29f888453C5fEe4c114C5eB1ca4E6256261a25](https://basescan.org/address/0xbA29f888453C5fEe4c114C5eB1ca4E6256261a25)
- 11 transactions total (contract deployments + USDC approvals + x402 payments)

**Polygon (X.orb operations):**
- Facilitator wallet: [0xF41faE67716670edBFf581aEe37014307dF71A9B](https://polygonscan.com/address/0xF41faE67716670edBFf581aEe37014307dF71A9B)
- USDC approval: [0xe1c8a0c975d5c0d06949c99db49b4433c27b284be2f2d0da2f08497baf671bab](https://polygonscan.com/tx/0xe1c8a0c975d5c0d06949c99db49b4433c27b284be2f2d0da2f08497baf671bab)

**Smart Contracts Used:**
- AgentRegistry (Polygon): [0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7](https://polygonscan.com/address/0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7)
- ActionVerifier (Polygon): [0x463856987bD9f3939DD52df52649e9B8Cb07B057](https://polygonscan.com/address/0x463856987bD9f3939DD52df52649e9B8Cb07B057)
- USDC (Polygon): [0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359](https://polygonscan.com/address/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
- USDC (Base): [0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

---

*All transactions executed on March 19, 2026 on Polygon PoS and Base mainnets with real USDC. Verifiable on-chain.*
