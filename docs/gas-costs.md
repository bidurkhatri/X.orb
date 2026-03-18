# X.orb Gas Cost Analysis — Polygon PoS / Base

**Last updated:** March 2026
**Network:** Polygon PoS (Chain ID 137), with Base L2 as future option
**Assumptions:** Gas price ~30 gwei on Polygon, MATIC ~$0.50, USDC 6 decimals

---

## Batch Mode (Default — Recommended)

Batch mode queues payments and settles them in groups of up to 50. This is the default for all Standard and High Volume tier actions.

| Operation | Gas Units | Approx. Cost (USD) | Notes |
|-----------|-----------|---------------------|-------|
| `USDC.transferFrom` (collect from payer) | ~46,000 | ~$0.0005 | ERC-20 transfer with allowance check |
| Queue storage (write action to batch) | ~25,000 | ~$0.0003 | SSTORE for new batch entry |
| **Per-action total (collection)** | **~71,000** | **~$0.008** | Paid at action submission time |

### Settlement Batch

| Operation | Gas Units | Approx. Cost (USD) | Notes |
|-----------|-----------|---------------------|-------|
| `settleBatch(50)` — 50 payments | ~350,000 | ~$0.040 | Loops through queued payments, transfers to recipients + treasury |
| **Per-payment within batch** | **~7,000** | **~$0.0008** | Amortized cost per payment in a full batch |

### Effective Cost Per Action (Batch Mode)

```
Collection gas:    $0.008
Settlement gas:    $0.001  (amortized)
────────────────────────
Total gas/action:  ~$0.009
```

**Breakeven at 30 bps fee:** Action value must exceed **$3.00** for the platform fee ($0.009) to cover gas costs.

For actions under $3.00, the minimum fee of $0.01 ensures gas is always covered.

---

## Immediate Mode

Immediate mode processes payment in a single transaction — no batching. Used when the action value exceeds the `IMMEDIATE_PAYMENT_THRESHOLD` (default: $100 USDC / 100,000,000 micro-USDC).

| Operation | Gas Units | Approx. Cost (USD) | Notes |
|-----------|-----------|---------------------|-------|
| `processPayment` (collect + split + forward) | ~120,000 | ~$0.015 | Single tx: transferFrom + fee split + forward to recipient |

**Breakeven at 30 bps fee:** Action value must exceed **$5.00** for the fee to cover gas.

Since immediate mode is only triggered for actions >= $100, breakeven is always satisfied.

---

## Audit Hash Anchoring

On-chain audit trail anchoring writes a SHA-256 hash of the action audit log to the `ActionVerifier` contract.

| Operation | Gas Units | Approx. Cost (USD) | Notes |
|-----------|-----------|---------------------|-------|
| `anchorHash(bytes32)` | ~45,000 | ~$0.005 | Single SSTORE + event emit |

**Recommendation:** Do not anchor every action individually. Instead, compute a daily Merkle root of all action hashes and anchor once per day. This reduces anchoring costs from `$0.005 * N` to a flat `$0.005/day` regardless of volume.

| Strategy | 1K actions/month | 10K actions/month | 100K actions/month |
|----------|-----------------|-------------------|---------------------|
| Per-action anchoring | $5.00 | $50.00 | $500.00 |
| Daily Merkle root | $0.15 | $0.15 | $0.15 |

Daily Merkle root is the default. Per-action anchoring can be enabled via `ENABLE_ONCHAIN_ANCHORING=per_action` for compliance-critical deployments.

---

## Minimum Fee

The minimum platform fee is **$0.01** (10,000 micro-USDC).

This floor ensures every action covers its gas cost even for micro-payments. At batch mode gas of ~$0.009/action, a $0.01 minimum fee provides a small margin above breakeven.

---

## Monthly Cost Projections

Assumes batch mode (default), 30 bps standard fee, 15 bps high-volume fee (50,001+ actions), daily Merkle root anchoring, and 500 free actions/month.

| Monthly Actions | Free Tier Actions | Billable Actions | Fee Rate | Platform Revenue | Gas Costs | Net Revenue | Notes |
|-----------------|-------------------|------------------|----------|-----------------|-----------|-------------|-------|
| 500 | 500 | 0 | — | $0.00 | $4.50 | **-$4.50** | Pure cost — subsidized for adoption |
| 1,000 | 500 | 500 | 30 bps | $15.00 | $9.00 | **$6.00** | Assumes avg $10/action |
| 5,000 | 500 | 4,500 | 30 bps | $135.00 | $45.00 | **$90.00** | Comfortable margin |
| 10,000 | 500 | 9,500 | 30 bps | $285.00 | $90.00 | **$195.00** | Solid unit economics |
| 50,000 | 500 | 49,500 | 30 bps | $1,485.00 | $450.00 | **$1,035.00** | Just below discount threshold |
| 100,000 | 500 | 99,500 | blended | $1,785.00 | $450.00* | **$1,335.00** | First 49,500 @ 30 bps, rest @ 15 bps |

*Gas costs at high volume benefit from batch fill rates approaching 100%, reducing per-action settlement cost.

### Cost Breakdown by Component (per action, batch mode)

| Component | Cost |
|-----------|------|
| Collection gas (USDC.transferFrom + queue) | $0.008 |
| Settlement gas (amortized per 50-batch) | $0.001 |
| Audit anchoring (daily Merkle root, amortized) | ~$0.00005 |
| **Total gas per action** | **~$0.009** |

---

## Gas Price Sensitivity

All estimates above assume 30 gwei on Polygon. Gas prices can fluctuate:

| Gas Price (gwei) | Per-Action Gas (Batch) | Per-Action Gas (Immediate) |
|-------------------|----------------------|---------------------------|
| 10 | $0.003 | $0.005 |
| 30 (baseline) | $0.009 | $0.015 |
| 100 | $0.030 | $0.050 |
| 300 (spike) | $0.090 | $0.150 |

At sustained gas prices above 100 gwei, the system automatically increases batch sizes and delays settlement to amortize costs. The cron job `settle-batch` runs every 5 minutes but skips settlement if the batch is below the `BATCH_SETTLEMENT_THRESHOLD` (default: 50) unless the oldest queued payment is over 15 minutes old.

---

## Base L2 Comparison

Base L2 offers even lower gas costs. If/when X.orb deploys to Base:

| Operation | Polygon Cost | Base Cost (est.) | Savings |
|-----------|-------------|-----------------|---------|
| Batch collection | $0.008 | $0.001 | 87% |
| Immediate payment | $0.015 | $0.002 | 87% |
| Audit anchor | $0.005 | $0.0007 | 86% |

Base deployment is planned for a future release. The `XORB_CHAIN` env var controls which network is used.

---

## Summary

- **Use batch mode** for all standard actions. It is 40% cheaper per action than immediate mode.
- **Minimum fee of $0.01** ensures gas costs are always covered.
- **Daily Merkle root** reduces audit anchoring costs by 99%+ compared to per-action anchoring.
- **First 500 actions/month are free** — gas for these is absorbed by X.orb as a customer acquisition cost.
- **High-volume discount** (15 bps) activates automatically at 50,001 actions/month with no application required.

---

*Fintex Australia Pty Ltd (ACN 688 406 108) — contact@xorb.xyz*
