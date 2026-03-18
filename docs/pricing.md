# X.orb Pricing — Pure USDC, Zero Fiat

All payments are in USDC on-chain. No Stripe. No credit cards. No invoices. The blockchain is the billing system.

## Tiers

### Free Tier
- **500 actions/month**
- Zero platform fees
- Single API key
- Community support
- **No wallet required** — just sign up and get an API key

### Standard (usage-based, pay-as-you-go)
- **Unlimited actions**
- **0.30% platform fee** per action (30 basis points)
- Minimum fee: $0.001 per action
- Maximum fee: $50 per action
- Multiple API keys
- Email support
- Requires USDC wallet with facilitator approval

### High Volume (automatic at 50K+ actions/month)
- **0.15% platform fee** (50% discount, 15 basis points)
- Everything in Standard
- Priority pipeline processing
- Dedicated support channel

### Enterprise
- Custom fee negotiation
- Dedicated infrastructure
- Custom contract deployment
- On-premise option
- SLA with uptime guarantees
- Contact: enterprise@xorb.xyz

## How It Works

There are **no subscription payments.** Tiers are determined entirely by your monthly usage:

1. **0–1,000 actions:** Free. No wallet needed.
2. **501+ actions:** Standard. 0.30% fee auto-deducted from each USDC payment.
3. **50,001+ actions:** High Volume. 0.15% fee auto-deducted (automatic discount).
4. **Enterprise:** Custom config per sponsor. Contact us.

You naturally graduate from Free → Standard → High Volume based on usage. No "subscribe" button. No billing cycles. No payment failures.

## Per-Endpoint Pricing (USDC)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `POST /v1/agents` | $0.10 | Agent registration |
| `POST /v1/actions/execute` | $0.005 | Per-action gate check |
| `POST /v1/actions/batch` | $0.003 | Per-action batch gate check |
| `GET /v1/reputation` | $0.001 | Reputation lookup |
| `POST /v1/marketplace/hire` | $0.05 | Marketplace hire initiation |
| `GET /v1/audit` | $0.01 | Audit log access |
| `POST /v1/webhooks` | $0.10 | Webhook subscription |
| `GET /v1/compliance` | $1.00 | Compliance report generation |

### Always Free (No Payment Required)
- `GET /v1/health` — Health check
- `GET /v1/pricing` — Pricing info
- `PATCH /v1/agents/:id` — Pause/resume (emergency controls)
- `DELETE /v1/agents/:id` — Revoke agent
- `GET /v1/agents` — List agents
- `GET /v1/events` — Event polling

## Setting Up USDC Payments

When you exceed the free tier, you'll need to set up a USDC wallet:

1. **Fund your wallet** with USDC on Polygon PoS (chain ID 137)
2. **Approve the X.orb facilitator** to spend USDC on your behalf:
   ```
   USDC.approve(facilitatorAddress, amount)
   ```
3. **Include x402 payment header** in your API requests

The X.orb SDKs include helpers to streamline this setup.

## Fee Transparency

Every action response includes fee headers:
```
X-Xorb-Payment-Status: completed
X-Xorb-Gross-Amount: 1000000        (USDC: $1.00)
X-Xorb-Fee-Amount: 3000             ($0.003)
X-Xorb-Fee-Basis-Points: 30
X-Xorb-Net-Amount: 997000           ($0.997)
X-Xorb-Collect-Tx: 0x...
X-Xorb-Fee-Tx: 0x...
X-Xorb-Forward-Tx: 0x...
```

Every fee is verifiable on-chain via the block explorer.

## Refund Policy

- **Automatic refund:** If the 8-gate pipeline rejects an action after payment, the full amount (including X.orb's fee) is automatically refunded to the payer.
- **Manual refund:** Completed payments can be refunded within 72 hours via the API.
- **On-chain verification:** Every refund includes a transaction hash verifiable on the block explorer.
