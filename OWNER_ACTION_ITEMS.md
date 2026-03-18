# X.orb — Owner Action Items

**Updated:** 2026-03-19
**Remaining tasks only.** Everything else has been completed.

---

## DO TODAY (5 minutes)

### 1. Fund the Facilitator Wallet
The facilitator wallet (`0xF41faE67716670edBFf581aEe37014307dF71A9B`) has 0 MATIC. It needs gas to execute USDC transfers.

Send **1 MATIC** from your deployer wallet (`0xbA29f888453C5fEe4c114C5eB1ca4E6256261a25`, has 94 MATIC) to the facilitator.

### 2. Create OG Image
The landing page has `<meta property="og:image" content="https://xorb.xyz/og-image.png">` but the file doesn't exist.

Create a 1200x630px image (dark background, "X.orb" logo, tagline) and upload to `apps/landing/public/og-image.png` or host at `xorb.xyz/og-image.png`.

### 3. Rotate Exposed Private Keys
Your deployer and facilitator private keys were shared in this conversation. After everything is working:
- Generate new wallets
- Transfer MATIC/USDC to the new wallets
- Update Vercel env vars with new keys

---

## DO THIS WEEK

### 4. Set Up Monitoring (Sentry)
1. Create Sentry project at sentry.io
2. Add `SENTRY_DSN` to Vercel env vars
3. Ask Claude to wire into the error handler

### 5. Publish SDKs

**TypeScript:**
```bash
cd packages/xorb-sdk-ts && npm login && npm publish --access public
```

**Python:**
```bash
cd packages/xorb-sdk-py && pip install twine build && python -m build && twine upload dist/*
```

**MCP Server:**
```bash
cd packages/xorb-mcp && npm publish --access public
```

### 6. Configure ALLOWED_ORIGINS
Add to Vercel:
```
ALLOWED_ORIGINS=https://dashboard.xorb.xyz,https://xorb.xyz
```

### 7. Migrate `api/index.ts` to Modular Architecture
The production API still runs the 1500-line monolithic `api/index.ts` because Vercel can't resolve cross-directory imports. The modular `apps/api/` has better architecture (Supabase-backed rate limiting, typed errors, etc.). Options:
- Configure Vercel build step to compile `apps/api/` into `api/`
- Or gradually port remaining fixes into `api/index.ts`

---

## NICE TO HAVE

| # | Task |
|---|------|
| 8 | Create status page (status.xorb.xyz) |
| 9 | Set up incident response (Slack/PagerDuty alerts) |
| 10 | Add Python SDK missing APIs (Compliance, Events, Payments) |
| 11 | Strip `smart_contracts.missing` from `/v1/integrations` response |
| 12 | Replace `console.log` with structured logger (~39 instances in api/index.ts) |
| 13 | Add spending cap enforcement in payment middleware |

---

## WHAT'S DEPLOYED

| Component | URL | Version |
|-----------|-----|---------|
| API | https://api.xorb.xyz/v1/health | v0.5.1 |
| Dashboard | https://dashboard.xorb.xyz | Login + onboarding + toasts |
| Landing | https://xorb.xyz | MoltGuard + Xorb Escrow + OG tags |

## DEPLOYED CONTRACTS (Polygon PoS, Chain ID 137)

| Contract | Address |
|----------|---------|
| AgentRegistry | `0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7` |
| ReputationScore | `0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8` |
| SlashingEngine | `0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625` |
| PaymentStreaming | `0xb34717670889190B2A92E64B51e0ea696cE88D89` |
| AgentMarketplace | `0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c` |
| ActionVerifier | `0x463856987bD9f3939DD52df52649e9B8Cb07B057` |
| XorbEscrow | `0x4B8994De0A6f02014E71149507eFF6903367411C` |
| XorbPaymentSplitter | `0xc038C3116CD4997fF4C8f42b2d97effb023214c9` |

**All 8 contracts deployed.**

## SUPABASE TABLES (21 total)

All required tables exist: `agent_registry`, `agent_actions`, `agent_events`, `api_keys`, `rate_limits`, `payment_nonces`, `marketplace_listings`, `marketplace_engagements`, `reputation_history`, `platform_events`, `platform_config`, `payments`, `sponsor_profiles`, `webhook_endpoints`, `webhook_deliveries` + 6 legacy tables.

## VERCEL ENV VARS SET

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV`, `CRON_SECRET`, `POLYGON_RPC_URL`, `XORB_FACILITATOR_PRIVATE_KEY`, `XORB_FACILITATOR_ADDRESS`, `XORB_TREASURY_ADDRESS`, `ACTION_VERIFIER_ADDRESS`, `XORB_ESCROW_ADDRESS`, `XORB_PAYMENT_SPLITTER_ADDRESS`
