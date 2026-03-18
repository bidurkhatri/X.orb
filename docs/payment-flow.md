# Payment Flow — How Money Moves Through X.orb

All payments are in USDC on-chain. X.orb uses the x402 protocol both to
orchestrate agent payments AND to collect its own platform fees.

## Architecture

```
SPONSOR WALLET (holds USDC)
  │
  │ ERC-20 approve(facilitatorAddress, amount)  ← one-time setup
  ▼
XORB FACILITATOR WALLET ←── USDC.transferFrom(payer, facilitator, gross)
  │
  │ 8-gate pipeline executes
  │
  ├─ APPROVED ──→ USDC.transfer(facilitator → treasury, fee)     ← XORB REVENUE
  │               USDC.transfer(facilitator → recipient, net)     ← ACTION RECIPIENT
  │
  └─ REJECTED ──→ USDC.transfer(facilitator → payer, gross)      ← FULL REFUND
```

## Wallet Architecture

### Facilitator Wallet (hot wallet)
- **Purpose:** Temporarily holds USDC during pipeline execution
- **Access:** API server via `XORB_FACILITATOR_PRIVATE_KEY` env var
- **Expected balance:** Low (only in-flight payments, held for seconds)
- **Risk:** Limited (funds only held during pipeline execution)
- **Upgrade path:** Migrate to AWS KMS or GCP KMS for key management

### Treasury Wallet (warm wallet)
- **Purpose:** Receives platform fees after successful actions
- **Access:** Founder only (hardware wallet recommended)
- **Address:** `XORB_TREASURY_ADDRESS` env var
- **Expected balance:** Growing (all platform revenue accumulates here)
- **Risk:** Higher (holds accumulated revenue)
- **Upgrade path:** Deploy as a Safe (Gnosis) multisig for institutional-grade key management

## Step-by-Step Flow

### 1. Agent Sends Action Request
```
POST /v1/actions/execute
Headers:
  x-api-key: xorb_sk_...
  x-payment: <base64-encoded payment header>
Body:
  { "agent_id": "agent_...", "action": "transfer", "tool": "send_usdc" }
```

The x-payment header contains:
- `amount`: USDC in 6 decimals (e.g., 1000000 = $1.00)
- `recipient`: intended recipient address
- `nonce`: unique string to prevent replay
- `expiry`: Unix timestamp
- `signature`: ECDSA signature over keccak256(abi.encode(amount, recipient, nonce, expiry))
- `payer`: sponsor wallet address
- `network`: chain identifier (e.g., "eip155:137" for Polygon)

### 2. Auth Gate
- Validates API key against Supabase `api_keys` table
- Sets `sponsorAddress` from authenticated key owner

### 3. x402 Payment Gate (X.orb as Facilitator)
1. Verify ECDSA signature — recover signer address
2. Verify nonce hasn't been replayed (atomic insert into `payment_nonces`)
3. Verify payment hasn't expired
4. Check payer's USDC allowance for facilitator >= grossAmount
5. Check payer's USDC balance >= grossAmount
6. Calculate X.orb fee: `grossAmount × fee_basis_points / 10000`
7. Execute `USDC.transferFrom(payer, facilitator, grossAmount)` — ON-CHAIN TX
8. Record payment in `payments` table (status: `held`)
9. Attach payment context to pipeline

### 4. Remaining Gates Execute
- Registry, Permissions, Rate Limit, Spend Limit, Audit, Compliance, Execute, Reputation

### 5a. All Gates Pass (Action Approved)
- Split from facilitator wallet:
  - `USDC.transfer(facilitator → treasury, feeAmount)` — X.orb's revenue
  - `USDC.transfer(facilitator → recipient, netAmount)` — or to XorbEscrow if escrow required
- Update payment: `status='completed'`, `fee_tx_hash`, `forward_tx_hash`, `completed_at`
- Return action result with fee headers

### 5b. Any Gate Rejects (Action Denied)
- Full refund: `USDC.transfer(facilitator → payer, grossAmount)` — includes would-be fee
- Update payment: `status='refunded'`, `refund_tx_hash`, `refund_reason`, `refunded_at`
- Return rejection with refund info

### 6. Escrow Settlement (if applicable)
- On engagement completion: `XorbEscrow.release()` → funds to agent owner
- On dispute: XorbEscrow holds until resolution
- On cancellation: `XorbEscrow.refund()` → funds back to hirer

## Critical Design Constraints

1. **Fee split happens AFTER pipeline approval, never before.** This prevents needing to claw back fees on rejected actions.

2. **Payer must approve the facilitator wallet.** First-time setup: `USDC.approve(facilitatorAddress, type(uint256).max)`. This is a one-time on-chain transaction per payer.

3. **Refund window: 72 hours.** Fees are held in treasury but marked as `pending` for 72 hours. Only after maturity can they be withdrawn.

4. **Free tier users need no wallet.** First 500 actions/month are free. No x402 header required. Only when the free tier is exhausted does the API return 402 Payment Required.

## Fee Structure

| Tier | Monthly Actions | Fee Rate | Min Fee | Max Fee |
|------|----------------|----------|---------|---------|
| Free | 0–500 | 0% | — | — |
| Standard | 501+ | 0.30% (30 bps) | $0.001 | $50.00 |
| High Volume | 50,001+ | 0.15% (15 bps) | $0.001 | $50.00 |
| Enterprise | Custom | Negotiated | — | — |

All amounts in USDC. All fees collected on-chain. All transactions verifiable on block explorer.

## Edge Cases

### On-chain tx fails at step 3.7 (collect)
- Do NOT proceed with pipeline
- Return 402 Payment Required with error details
- Payment record created with `status='failed'`

### Split tx fails at step 5a (fee/forward)
- Gross amount is still in facilitator wallet (safe)
- Retry the split up to 3 times
- If all retries fail: mark payment as `held` and alert admin
- Manual resolution within 24 hours

### Payer has insufficient allowance
- Return 402 with message: "Insufficient USDC allowance. Call USDC.approve(facilitator, amount) first."
- Include facilitator address and approval instructions

### Payer has insufficient balance
- Return 402 with message: "Insufficient USDC balance."
- Include required amount and payer's current balance
