# X.orb — Owner Action Items

**Updated:** 2026-03-19
**Remaining tasks only.**

---

## DO TODAY (5 minutes)

### 1. Fund the Facilitator Wallet
The facilitator wallet (`0xF41faE67716670edBFf581aEe37014307dF71A9B`) has 0 MATIC. It needs gas to execute USDC transfers.

Send **1 MATIC** from your deployer wallet (`0xbA29f888453C5fEe4c114C5eB1ca4E6256261a25`, has ~94 MATIC) to the facilitator.

### 2. Rotate Exposed Private Keys
Your deployer and facilitator private keys were shared in this conversation. After everything is working:
- Generate new wallets
- Transfer MATIC/USDC to the new wallets
- Update Vercel env vars with new keys

---

## DO THIS WEEK

### 3. Set Up Monitoring (Sentry)
1. Create Sentry project at sentry.io
2. Add `SENTRY_DSN` to Vercel env vars
3. Ask Claude to wire into the error handler

### 4. Publish SDKs

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

### 5. Migrate `api/index.ts` to Modular Architecture
The production API runs the 1500-line monolithic `api/index.ts` because Vercel can't resolve cross-directory imports. The modular `apps/api/` has better architecture. Options:
- Configure Vercel build step to compile `apps/api/` into `api/`
- Or gradually port remaining fixes into `api/index.ts`

---

## NICE TO HAVE

| # | Task |
|---|------|
| 6 | Create status page (status.xorb.xyz) |
| 7 | Set up incident response (Slack/PagerDuty alerts) |
| 8 | Add Python SDK missing APIs (Compliance, Events, Payments) |
| 9 | Strip `smart_contracts.missing` from `/v1/integrations` response |
| 10 | Replace `console.log` with structured logger in api/index.ts |
| 11 | Add spending cap enforcement in payment middleware |

---

## EVERYTHING COMPLETED

| # | Task | Date |
|---|------|------|
| 1 | Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV`, `CRON_SECRET`, `POLYGON_RPC_URL` in Vercel | 2026-03-19 |
| 2 | Create API key (`xorb_live_bidur_2026`) | 2026-03-19 |
| 3 | Run all Supabase migrations (21 tables created) | 2026-03-19 |
| 4 | Deploy ActionVerifier (`0x463856987bD9f3939DD52df52649e9B8Cb07B057`) | 2026-03-19 |
| 5 | Deploy XorbEscrow (`0x4B8994De0A6f02014E71149507eFF6903367411C`) | 2026-03-19 |
| 6 | Deploy XorbPaymentSplitter (`0xc038C3116CD4997fF4C8f42b2d97effb023214c9`) | 2026-03-19 |
| 7 | Set payment infra env vars (facilitator, treasury, contract addresses) | 2026-03-19 |
| 8 | Create and deploy OG image for social sharing | 2026-03-19 |
| 9 | Fix payment recipient bug (`pipeline.ts:163`) | 2026-03-19 |
| 10 | Fix registry persistence (`updateReputation`/`recordAction`) | 2026-03-19 |
| 11 | Fix USDC decimals (`AgentRegistry.sol:65` 10^18 → 10^6) | 2026-03-19 |
| 12 | Fix cleanup cron auth (requires CRON_SECRET) | 2026-03-19 |
| 13 | Fix health endpoint info leakage (v0.5.1) | 2026-03-19 |
| 14 | Replace dead domains (AgentScore → MoltGuard, PayCrow → Xorb Escrow) | 2026-03-19 |
| 15 | Wire OnboardingWizard on first login | 2026-03-19 |
| 16 | Add toast notifications (sonner) on all mutations | 2026-03-19 |
| 17 | Wire Skeleton/ButtonSpinner loading components | 2026-03-19 |
| 18 | Fix broken logo (SVG gradient) | 2026-03-19 |
| 19 | Add mobile hamburger menu sidebar | 2026-03-19 |
| 20 | Fix billing to use dynamic pricing | 2026-03-19 |
| 21 | Add CSV export on Agents page | 2026-03-19 |
| 22 | Landing page: OG tags, mobile, security, semantic HTML, footer | 2026-03-19 |
| 23 | Wire on-chain agent registration + audit anchoring | 2026-03-19 |
| 24 | Add reputation hydration from Supabase on cold start | 2026-03-19 |
| 25 | Supabase-backed burst rate limiting (`apps/api/`) | 2026-03-19 |

---

## WHAT'S LIVE

| Component | URL | Status |
|-----------|-----|--------|
| API | https://api.xorb.xyz/v1/health | v0.5.1 |
| Dashboard | https://dashboard.xorb.xyz | Login + onboarding + toasts + skeletons + mobile |
| Landing | https://xorb.xyz | MoltGuard + Xorb Escrow + OG image + mobile |

## ALL 8 CONTRACTS DEPLOYED (Polygon PoS, Chain ID 137)

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

## 21 SUPABASE TABLES

`agent_registry`, `agent_actions`, `agent_events`, `api_keys`, `rate_limits`, `payment_nonces`, `marketplace_listings`, `marketplace_engagements`, `reputation_history`, `platform_events`, `platform_config`, `payments`, `sponsor_profiles`, `webhook_endpoints`, `webhook_deliveries`, `agent_audits`, `civilization_stats`, `community_posts`, `community_replies`, `decentralized_files`, `transactions`

## 11 VERCEL ENV VARS SET

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV`, `CRON_SECRET`, `POLYGON_RPC_URL`, `XORB_FACILITATOR_PRIVATE_KEY`, `XORB_FACILITATOR_ADDRESS`, `XORB_TREASURY_ADDRESS`, `ACTION_VERIFIER_ADDRESS`, `XORB_ESCROW_ADDRESS`, `XORB_PAYMENT_SPLITTER_ADDRESS`
