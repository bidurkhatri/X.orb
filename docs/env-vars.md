# X.orb Environment Variable Checklist

All environment variables used by the X.orb API server, contracts tooling, and deployment pipeline. Set these in your `.env` file (local) or Vercel project settings (production).

---

## Required — Core

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment. Controls dev fallbacks, logging verbosity, and error detail. | `development`, `production` |
| `SUPABASE_URL` | Supabase project URL for database and auth. | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (full access, server-side only). Never expose to the client. | `eyJhbGciOiJIUzI1NiIs...` |

---

## Required — Payments (x402)

These are required once the platform accepts paid actions (beyond the free tier).

| Variable | Description | Example |
|----------|-------------|---------|
| `XORB_FACILITATOR_PRIVATE_KEY` | Private key of the facilitator wallet that executes USDC transfers on behalf of the platform. Must have ETH for gas and USDC approval from payers. | `0xabc123...` (64 hex chars) |
| `XORB_FACILITATOR_ADDRESS` | Public address of the facilitator wallet. Derived from the private key above. Used for balance checks and allowance verification. | `0x742d35Cc6634C053...` |
| `XORB_TREASURY_ADDRESS` | Address where platform fees are collected. Should be a multisig or cold wallet in production. | `0x8Ba1f109551bD432...` |
| `XORB_PAYMENT_SPLITTER_ADDRESS` | Address of the deployed `PaymentSplitter` contract that handles fee splitting between treasury and recipient. | `0xb34717670889190B...` |
| `XORB_CHAIN` | Target blockchain identifier. Determines RPC endpoint and contract addresses. | `polygon` (default), `base`, `polygon-amoy` |

---

## Required — Smart Contracts

These are used by the contract deployment scripts and by the API when interacting with on-chain components.

| Variable | Description | Example |
|----------|-------------|---------|
| `DEPLOYER_PRIVATE_KEY` | Private key used for contract deployment. Only needed during deployment, not at runtime. | `0xdef456...` (64 hex chars) |
| `RPC_URL` | Primary RPC endpoint for the target chain. Used by deployment scripts. | `https://polygon-rpc.com` |
| `POLYGON_RPC_URL` | Polygon PoS RPC endpoint. Used by the API server for on-chain reads (reputation, registry, verification). | `https://polygon-mainnet.g.alchemy.com/v2/KEY` |
| `AGENT_REGISTRY_ADDRESS` | Deployed address of the `AgentRegistry` contract. | `0x2a7457C2f30F9C0B...` |
| `SLASHING_ENGINE_ADDRESS` | Deployed address of the `SlashingEngine` contract. | `0xA64E71Aa00F8f6e8...` |
| `ACTION_VERIFIER_ADDRESS` | Deployed address of the `ActionVerifier` contract. Used for on-chain audit hash anchoring. | `0x...` (not yet deployed) |

---

## Required — Observability

| Variable | Description | Example |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry Data Source Name for error tracking and performance monitoring. Required in production. | `https://abc@o123.ingest.sentry.io/456` |

---

## Optional

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CRON_SECRET` | Shared secret for authenticating Vercel cron job requests. If set, cron endpoints validate the `Authorization: Bearer <secret>` header. | *(none — cron endpoints open)* | `cron_sec_abc123...` |
| `RESEND_API_KEY` | API key for Resend email service. Used for sending violation notices, enforcement alerts, and account notifications. If unset, email sending is skipped with a warning log. | *(none — emails disabled)* | `re_abc123...` |
| `ENABLE_ONCHAIN_ANCHORING` | Controls audit hash anchoring mode. `daily` writes a single Merkle root per day. `per_action` anchors every action individually (expensive). `disabled` skips anchoring entirely. | `daily` | `daily`, `per_action`, `disabled` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins for the API. If unset, defaults to `*` in development and blocks all cross-origin requests in production. | `*` (dev) / *(none)* (prod) | `https://dashboard.xorb.xyz,https://app.xorb.xyz` |
| `BATCH_SETTLEMENT_THRESHOLD` | Number of queued payments required before `settleBatch` is triggered by the cron job. Lower values settle faster but cost more gas per action. | `50` | `25`, `50`, `100` |
| `IMMEDIATE_PAYMENT_THRESHOLD` | Action value in micro-USDC above which payments bypass the batch queue and settle immediately. Default is $100 USDC. | `100000000` (= $100) | `50000000` (= $50) |

---

## Environment File Template

```bash
# === Core ===
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# === Payments ===
XORB_FACILITATOR_PRIVATE_KEY=0x_your_facilitator_private_key
XORB_FACILITATOR_ADDRESS=0x_your_facilitator_address
XORB_TREASURY_ADDRESS=0x_your_treasury_address
XORB_PAYMENT_SPLITTER_ADDRESS=0x_your_splitter_address
XORB_CHAIN=polygon

# === Contracts ===
DEPLOYER_PRIVATE_KEY=0x_your_deployer_key
RPC_URL=https://polygon-rpc.com
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
AGENT_REGISTRY_ADDRESS=0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7
SLASHING_ENGINE_ADDRESS=0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625
ACTION_VERIFIER_ADDRESS=0x_not_yet_deployed

# === Observability ===
SENTRY_DSN=https://your-dsn@sentry.io/project

# === Optional ===
CRON_SECRET=your_cron_secret
RESEND_API_KEY=re_your_resend_key
ENABLE_ONCHAIN_ANCHORING=daily
ALLOWED_ORIGINS=https://dashboard.xorb.xyz
BATCH_SETTLEMENT_THRESHOLD=50
IMMEDIATE_PAYMENT_THRESHOLD=100000000
```

---

## Security Notes

1. **Never commit `.env` files to version control.** The `.gitignore` already excludes `.env*`.
2. **`SUPABASE_SERVICE_KEY`** has full database access. Use it only server-side.
3. **`XORB_FACILITATOR_PRIVATE_KEY`** controls the wallet that moves USDC. In production, consider using a KMS-backed signer instead of a raw private key in an environment variable.
4. **`DEPLOYER_PRIVATE_KEY`** is only needed during contract deployment. Remove it from production environments after deployment is complete.
5. **`CRON_SECRET`** should always be set in production to prevent unauthorized triggering of batch settlement and other cron jobs.

---

*Fintex Australia Pty Ltd (ACN 688 406 108) — contact@xorb.xyz*
