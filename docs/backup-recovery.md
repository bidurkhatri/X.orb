# Backup & Disaster Recovery Plan

**Owner:** Fintex Australia Pty Ltd (ACN 688 406 108), trading as X.orb
**Author:** Bidur Khatri, Founder
**Last Updated:** 2026-03-18
**Review Cycle:** Quarterly

---

## 1. Architecture Overview

X.orb's production stack has three stateful layers, each with distinct backup characteristics:

| Layer | Technology | Data Type | Backup Strategy |
|-------|-----------|-----------|-----------------|
| Database | Supabase (Postgres) | Agent records, API keys, audit logs, reputation scores, slash records, transactions, webhook endpoints | Automated daily backups + point-in-time recovery |
| On-Chain State | Polygon PoS (Chain ID 137) | Smart contract state — staking, escrow, reputation scores, slashing records | Immutable by design; no backup needed |
| Serverless Compute | Vercel Serverless | Stateless API handlers, dashboard static assets | No persistent state; redeployable from Git |

---

## 2. Supabase Database Backups

### 2.1 Automatic Daily Backups

Supabase provides automated daily backups for all Pro and Enterprise plans:

- **Frequency:** Every 24 hours, automatically
- **Retention:** 7 days (Pro), 30 days (Enterprise)
- **Scope:** Full Postgres database including all schemas, tables, indexes, RLS policies, and extensions
- **Storage:** Encrypted at rest in Supabase's backup infrastructure (separate region from primary)

**Tables covered by automatic backup:**

- `agent_registry` — registered AI agents and their metadata
- `agent_actions` — all pipeline action records
- `agent_audits` — audit trail with SHA-256 integrity hashes
- `api_keys` — developer API key hashes, scopes, rate limits
- `slash_records` — slashing events and severity data
- `pop_records` — proof-of-personhood verifications
- `transactions` — USDC payment records
- `webhook_endpoints` and `webhook_deliveries` — webhook configuration and delivery logs
- `users`, `wallet_sessions` — user accounts and authentication sessions
- `governance_proposals`, `governance_votes` — governance data
- `staking_pools`, `user_staking` — staking state
- `nft_items`, `decentralized_files` — asset metadata
- `community_posts`, `civilization_stats` — community data

### 2.2 Point-in-Time Recovery (PITR)

Available on Supabase Pro and Enterprise plans:

- **Granularity:** Restore to any second within the retention window
- **Method:** WAL (Write-Ahead Log) archiving with continuous streaming
- **Recovery Time:** Typically 5-15 minutes for databases under 10 GB
- **How to Invoke:**
  1. Open Supabase Dashboard > Project Settings > Database > Backups
  2. Select "Point in time" tab
  3. Choose the exact timestamp to restore to
  4. Confirm restoration (this replaces the current database)

**Warning:** PITR restores are destructive to the current database state. If you need to preserve the current state before restoring, create a manual backup first via `pg_dump`.

### 2.3 Manual Backup Procedure

For ad-hoc backups before major migrations or deployments:

```bash
# Export full database via Supabase CLI
supabase db dump --project-ref <project-ref> -f backup_$(date +%Y%m%d_%H%M%S).sql

# Export specific tables only
pg_dump $DATABASE_URL --table=agent_registry --table=agent_actions --table=api_keys \
  -f critical_tables_$(date +%Y%m%d_%H%M%S).sql

# Store backup in secure location (encrypted S3 bucket or equivalent)
aws s3 cp backup_*.sql s3://xorb-backups/manual/ --sse AES256
```

**Schedule for manual backups:**
- Before every Supabase migration (`xorb-db/migrations/`)
- Before every smart contract deployment that changes treasury or admin addresses
- Before any schema-altering changes to production

---

## 3. On-Chain State (Polygon PoS)

### 3.1 Why No Backup Is Needed

Smart contract state on Polygon PoS is inherently immutable and replicated across all network validators. The following contracts hold state that cannot be lost:

| Contract | Address | State Held |
|----------|---------|------------|
| AgentRegistry | `0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7` | Agent registrations, stake amounts |
| ReputationScore | `0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8` | On-chain reputation scores |
| SlashingEngine | `0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625` | Slashing history, escalation state |
| PaymentStreaming | `0xb34717670889190B2A92E64B51e0ea696cE88D89` | Active payment streams |
| AgentMarketplace | `0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c` | Marketplace listings, escrow state |

### 3.2 Contract State Verification

To verify contract state after any incident:

```bash
# Read all agent registrations from AgentRegistry
cast call 0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7 \
  "getAgent(address)" <agent-address> --rpc-url https://polygon-rpc.com/

# Verify reputation scores
cast call 0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8 \
  "getScore(address)" <agent-address> --rpc-url https://polygon-rpc.com/
```

### 3.3 Contract ABI and Source Backup

All contract source code and ABIs are:
- Version-controlled in `xorb-contracts/` in the monorepo
- Verified on PolygonScan (source code publicly readable)
- Compiled artifacts stored in `xorb-contracts/artifacts/`

---

## 4. Vercel Serverless (Stateless)

The API layer (`apps/api`) and dashboard (`apps/dashboard`) are stateless. Recovery is redeployment:

```bash
# Redeploy API from latest main branch
vercel --prod --cwd apps/api

# Redeploy dashboard
vercel --prod --cwd apps/dashboard
```

Environment variables are stored in Vercel's project settings and are included in Vercel's own backup infrastructure. However, maintain an encrypted copy of all environment variables in a password manager (1Password, Bitwarden, or equivalent) as a secondary backup.

---

## 5. Disaster Scenarios and Recovery Procedures

### 5.1 Supabase Is Down

**Impact:** API cannot read/write agent data, API key validation fails, audit logs are unavailable.

**Immediate Response:**
1. Check Supabase status page: https://status.supabase.com/
2. The X.orb API has an in-memory fallback for development mode. In production, the API will return `503 Service Unavailable` for database-dependent endpoints.
3. On-chain operations (staking, slashing via direct contract calls) continue to work independently.

**Recovery:**
- If Supabase recovers within its SLA, no action needed — connections auto-reconnect.
- If extended outage (>1 hour), post a status update on X.orb's status page and notify Enterprise customers.
- If data loss occurs, use PITR to restore to the last known-good timestamp.

**Mitigation in place:**
- API key validation caches recent successful authentications in memory for 5 minutes
- Pipeline audit hashes include timestamps, so any gap in audit records is detectable
- All critical state transitions (staking, slashing) are recorded both in Supabase and on-chain, providing a secondary source of truth

### 5.2 Vercel Is Down

**Impact:** API endpoints unreachable, dashboard inaccessible.

**Immediate Response:**
1. Check Vercel status page: https://www.vercel-status.com/
2. Smart contracts remain fully operational — agents using the SDK can fall back to direct contract interaction.
3. Supabase Edge Functions (`xorb-db/functions/`) remain operational as an independent deployment.

**Recovery:**
- Vercel outages are typically regional. If prolonged, redeploy to an alternative region or alternative platform (Cloudflare Workers, AWS Lambda).
- The Hono framework used by the API is platform-agnostic and can be deployed to any serverless runtime with minimal configuration changes.

**Failover Plan (if Vercel is down for >4 hours):**
1. Deploy API to Cloudflare Workers: `wrangler deploy` (Hono has native Cloudflare Workers support)
2. Update DNS to point `api.xorb.xyz` to the Cloudflare deployment
3. TTL on DNS records should be set to 300 seconds (5 minutes) to enable fast failover

### 5.3 Deployer Key Compromised

**Impact:** Attacker could deploy malicious contracts or, if the deployer holds admin roles, modify contract parameters.

**Immediate Response (within 15 minutes of detection):**
1. **Pause all contracts** that support pausing by calling `pause()` from the admin wallet (if admin is separate from deployer)
2. **Revoke deployer roles** on all contracts by calling `revokeRole(DEPLOYER_ROLE, compromised_address)` from the admin wallet
3. **Transfer any funds** held by the deployer wallet to a secure wallet
4. **Rotate the `DEPLOYER_PRIVATE_KEY`** in all environment configurations (Vercel, local `.env`, CI/CD)

**Post-Incident:**
1. Audit all transactions from the compromised key on PolygonScan
2. If malicious transactions occurred, assess impact and communicate to affected users
3. Generate a new deployer wallet, fund it with MATIC for gas
4. Update `DEPLOYER_PRIVATE_KEY` and `PRIVATE_KEY` in Vercel environment variables
5. Re-verify that admin roles on all contracts point to the (separate) admin wallet
6. Conduct post-mortem and update key management procedures

**Prevention:**
- Deployer key and admin key must be different wallets
- Deployer key should hold minimal MATIC (enough for 2-3 deployments)
- Admin key should be a hardware wallet or multisig (Gnosis Safe)
- Never store deployer key in Git; always use environment variables

### 5.4 Data Corruption Detected

**Symptoms:** Integrity hash mismatches in audit records, inconsistent reputation scores between Supabase and on-chain, unexpected null values in critical fields.

**Diagnostic Steps:**
1. Identify the scope of corruption — which tables, which time range
2. Cross-reference Supabase data with on-chain state for dual-stored records
3. Check audit log hash chains for the first broken link to determine when corruption began

**Recovery:**
1. If corruption is recent (within PITR window): restore database to the timestamp just before corruption began
2. If corruption is in a single table: export the corrupted table, restore from backup, merge any valid records from the corrupted export
3. If corruption affects audit hash chains: recalculate hashes from the first valid record forward and flag the gap in audit continuity

```sql
-- Find broken audit hash chains
SELECT id, action_hash, previous_hash, created_at
FROM agent_audits
WHERE action_hash IS NULL OR previous_hash IS NULL
ORDER BY created_at ASC
LIMIT 100;

-- Verify reputation score consistency
SELECT ar.agent_id, ar.reputation_score as db_score
FROM agent_registry ar
ORDER BY ar.updated_at DESC
LIMIT 50;
```

**On-chain reconciliation:**
If Supabase data is lost but on-chain state is intact, rebuild the database from contract events:

```bash
# Export all AgentRegistered events
cast logs --from-block 0 --to-block latest \
  --address 0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7 \
  --rpc-url https://polygon-rpc.com/
```

---

## 6. Recovery Time Objectives

| Scenario | RTO (Recovery Time) | RPO (Data Loss) |
|----------|-------------------|-----------------|
| Supabase outage (provider recovers) | 0 minutes (auto-reconnect) | 0 (no data loss) |
| Supabase PITR restore | 15-30 minutes | Up to the chosen restore point |
| Vercel outage (provider recovers) | 0 minutes (auto-recover) | 0 (stateless) |
| Vercel failover to Cloudflare | 30-60 minutes | 0 (stateless) |
| Deployer key compromise | 15 minutes (pause), 2 hours (full rotation) | Depends on attacker actions |
| Data corruption (recent) | 30 minutes (PITR) | Minutes to hours depending on detection time |
| Full database rebuild from chain | 4-8 hours | Off-chain-only data (API keys, webhooks) is lost |

---

## 7. Testing Schedule

| Test | Frequency | Owner |
|------|-----------|-------|
| Verify Supabase automatic backups exist | Monthly | Bidur Khatri |
| PITR restore to staging environment | Quarterly | Engineering Lead |
| Manual `pg_dump` and restore test | Quarterly | Engineering Lead |
| Vercel redeployment from Git | Monthly (part of normal deploys) | Engineering Lead |
| Deployer key rotation drill | Annually | Bidur Khatri |
| Full disaster recovery simulation | Annually | All Engineering |

---

## 8. Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| Incident Commander | Bidur Khatri | bidur@xorb.xyz |
| Supabase Support | https://supabase.com/support | Pro/Enterprise support ticket |
| Vercel Support | https://vercel.com/support | Enterprise support channel |
| Polygon Support | https://support.polygon.technology | For chain-level issues only |
