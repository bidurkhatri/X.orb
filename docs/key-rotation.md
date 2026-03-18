# Key Rotation Procedures

**Owner:** Fintex Australia Pty Ltd (ACN 688 406 108), trading as X.orb
**Last Updated:** 2026-03-18
**Review Cycle:** Quarterly

---

## 1. Key Inventory

X.orb manages the following secret keys across its infrastructure:

| Key | Location | Purpose | Rotation Schedule |
|-----|----------|---------|-------------------|
| Developer API Keys (`xorb_sk_*`) | Supabase `api_keys` table (SHA-256 hashed) | Authenticate developer API requests | On-demand (developer-initiated) |
| Supabase Service Key | Vercel env vars, `.env` | Server-side database access with full privileges | Quarterly |
| Supabase Anon Key | Vercel env vars, dashboard build | Client-side database access (RLS-restricted) | Quarterly (with service key) |
| Deployer Wallet Private Key | Vercel env vars, `.env` | Smart contract deployment and upgrades on Polygon PoS | Annually |
| Admin Wallet Private Key | Hardware wallet / multisig | Admin role on all smart contracts (pause, role management) | Annually or upon personnel change |
| `CRON_SECRET` | Vercel env vars | Authenticates Vercel Cron job requests to `/v1/cron/*` | Quarterly |
| PolygonScan API Key | Vercel env vars, Hardhat config | Contract verification on PolygonScan | Annually |
| RPC Provider Keys (Infura, etc.) | Vercel env vars, Hardhat config | Blockchain RPC access | Annually |

---

## 2. Developer API Key Rotation (Built-In)

The X.orb API has a built-in key rotation endpoint at `POST /v1/auth/keys/rotate`. This is the only key type that developers rotate themselves.

### How It Works

1. Developer sends a request with their current key
2. The API verifies the current key exists and is active in the `api_keys` table
3. A new key is generated with the same scopes, rate limits, and owner
4. The old key is deactivated (`is_active = false`)
5. The new key is returned in the response (this is the only time the raw key is visible)

### API Call

```bash
curl -X POST https://api.xorb.xyz/v1/auth/keys/rotate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer xorb_sk_current_key_here" \
  -d '{"current_key": "xorb_sk_current_key_here"}'
```

### Response

```json
{
  "api_key": "xorb_sk_new_key_abcdef123456...",
  "key_prefix": "xorb_sk_new_...",
  "warning": "Store this key securely. The previous key has been revoked."
}
```

### Important Notes

- The old key is immediately deactivated. There is no grace period.
- Developers must update their SDK configuration or environment variables before their next API call.
- If a developer loses their key and cannot call the rotate endpoint, they must contact support to have the old key revoked and a new one issued manually via the Supabase dashboard.

---

## 3. Supabase Service Key Rotation

**Schedule:** Quarterly (January, April, July, October)
**Risk Level:** High — incorrect rotation will cause a full API outage

### Prerequisites

- Access to the Supabase dashboard for the X.orb project
- Access to Vercel project settings for both `apps/api` and `apps/dashboard`
- A maintenance window (recommended: 02:00-04:00 AEST on a weekday)

### Procedure

**Step 1: Generate new keys in Supabase**

1. Log in to Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to Project Settings > API
3. Click "Generate new API keys" (this rotates both service_role and anon keys simultaneously)
4. Copy both the new `service_role` key and the new `anon` key immediately
5. Store them in the team password manager before proceeding

**Step 2: Update Vercel environment variables**

```bash
# Update API project
vercel env rm SUPABASE_SERVICE_KEY production --yes
vercel env add SUPABASE_SERVICE_KEY production
# Paste the new service key when prompted

vercel env rm SUPABASE_ANON_KEY production --yes
vercel env add SUPABASE_ANON_KEY production
# Paste the new anon key when prompted

# Update Dashboard project
vercel env rm VITE_SUPABASE_ANON_KEY production --yes
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste the new anon key when prompted
```

**Step 3: Redeploy all services**

```bash
# Redeploy API (picks up new env vars)
vercel --prod --cwd apps/api

# Redeploy Dashboard (rebuilds with new anon key baked into client bundle)
vercel --prod --cwd apps/dashboard
```

**Step 4: Verify**

```bash
# Test API health
curl https://api.xorb.xyz/v1/health

# Test authenticated endpoint
curl -H "Authorization: Bearer xorb_sk_test_key" \
  https://api.xorb.xyz/v1/agents

# Test dashboard loads and can authenticate
open https://dashboard.xorb.xyz
```

**Step 5: Update staging and development environments**

Repeat Steps 2-4 for staging and development Vercel projects, using the corresponding Supabase project keys for each environment.

**Step 6: Update local `.env` files**

Notify all team members to update their local `.env` files with the new keys. The old keys will stop working immediately after Supabase rotation.

### Rollback

If the new keys cause issues:
- Supabase key rotation is irreversible — you cannot restore old keys
- If the new keys were not correctly saved, contact Supabase support immediately
- As a temporary measure, the API will fall back to in-memory mode if Supabase is unreachable (development mode only; not suitable for production)

---

## 4. CRON_SECRET Rotation

**Schedule:** Quarterly (with Supabase key rotation)

### Procedure

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```

2. Update in Vercel:
   ```bash
   vercel env rm CRON_SECRET production --yes
   vercel env add CRON_SECRET production
   # Paste the new secret
   ```

3. Update the Vercel Cron configuration if cron jobs use the secret as a query parameter or header.

4. Redeploy the API:
   ```bash
   vercel --prod --cwd apps/api
   ```

5. Verify cron endpoints:
   ```bash
   curl -H "Authorization: Bearer NEW_CRON_SECRET" \
     https://api.xorb.xyz/v1/cron/reputation-decay
   ```

---

## 5. Deployer Wallet Key Rotation

**Schedule:** Annually, or immediately upon suspected compromise
**Risk Level:** Critical — the deployer key can deploy contracts and may hold admin roles

### Prerequisites

- Hardware wallet or secure air-gapped machine for key generation
- Sufficient MATIC in the new wallet for gas fees (minimum 5 MATIC recommended)
- Confirmation that the deployer wallet does NOT currently hold admin roles on production contracts (admin should be a separate wallet)

### Procedure

**Step 1: Generate a new deployer wallet**

```bash
# Generate new wallet (do this on a secure, air-gapped machine if possible)
cast wallet new
```

Record the new address and private key. Store the private key in the team's hardware security module (HSM) or password manager vault.

**Step 2: Fund the new wallet**

Transfer MATIC from the treasury or an operational wallet to the new deployer address:

```bash
cast send --private-key $OLD_DEPLOYER_KEY \
  --rpc-url https://polygon-rpc.com/ \
  --value 5ether \
  $NEW_DEPLOYER_ADDRESS
```

**Step 3: Transfer any roles from old deployer to new deployer**

If the old deployer holds any contract roles (it should not in production, but verify):

```bash
# Check roles on AgentRegistry
cast call 0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7 \
  "hasRole(bytes32,address)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  $OLD_DEPLOYER_ADDRESS \
  --rpc-url https://polygon-rpc.com/

# If roles exist, grant to new deployer then revoke from old (must be done by admin)
```

**Step 4: Update environment variables**

```bash
# Vercel
vercel env rm DEPLOYER_PRIVATE_KEY production --yes
vercel env add DEPLOYER_PRIVATE_KEY production
# Paste the new private key

vercel env rm PRIVATE_KEY production --yes
vercel env add PRIVATE_KEY production
# Paste the new private key
```

**Step 5: Drain remaining funds from old wallet**

```bash
# Send all remaining MATIC from old deployer to treasury
cast send --private-key $OLD_DEPLOYER_KEY \
  --rpc-url https://polygon-rpc.com/ \
  --value $(cast balance $OLD_DEPLOYER_ADDRESS --rpc-url https://polygon-rpc.com/) \
  $TREASURY_ADDRESS
```

**Step 6: Verify**

```bash
# Verify new deployer can interact with contracts (read-only test)
cast call 0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7 \
  "name()" --rpc-url https://polygon-rpc.com/

# Deploy to testnet first to verify the key works
DEPLOYER_PRIVATE_KEY=$NEW_KEY npx hardhat run scripts/deploy.ts --network amoy
```

**Step 7: Document**

Record the rotation in the team's key rotation log:
- Date of rotation
- Old deployer address (for audit trail — never log private keys)
- New deployer address
- Who performed the rotation
- Verification steps completed

---

## 6. RPC Provider and Block Explorer API Key Rotation

**Schedule:** Annually
**Risk Level:** Low — these keys provide read access and verification capabilities only

### Procedure

1. Log in to the provider dashboard (Infura, Alchemy, PolygonScan, etc.)
2. Generate a new API key
3. Update in Vercel and Hardhat config:
   ```bash
   vercel env rm POLYGON_RPC_URL production --yes
   vercel env add POLYGON_RPC_URL production
   # Enter: https://polygon-mainnet.infura.io/v3/NEW_KEY

   vercel env rm POLYGONSCAN_API_KEY production --yes
   vercel env add POLYGONSCAN_API_KEY production
   ```
4. Test contract verification:
   ```bash
   npx hardhat verify --network polygon $CONTRACT_ADDRESS
   ```
5. Revoke the old API key in the provider dashboard

---

## 7. Rotation Schedule Summary

| Month | Keys to Rotate |
|-------|---------------|
| January | Supabase keys, CRON_SECRET |
| April | Supabase keys, CRON_SECRET |
| July | Supabase keys, CRON_SECRET, Deployer wallet (annual), RPC/Explorer keys (annual) |
| October | Supabase keys, CRON_SECRET |

### Calendar Reminders

Set recurring calendar events for the rotation schedule. Each event should include:
- Which keys to rotate
- Links to this document
- The names of personnel authorized to perform the rotation

---

## 8. Emergency Rotation (Suspected Compromise)

If any key is suspected to be compromised, perform an emergency rotation regardless of the regular schedule:

1. **Immediately** revoke/rotate the compromised key using the procedures above
2. **Audit** all actions taken with the compromised key since the estimated time of compromise
3. **Notify** affected customers if the compromise could impact their data or operations
4. **Document** the incident using the incident response runbook (`docs/incident-response.md`)
5. **Review** how the compromise occurred and update security practices accordingly

### Emergency Contacts

| Role | Contact |
|------|---------|
| Key Rotation Authority | Bidur Khatri (bidur@xorb.xyz) |
| Supabase Support | https://supabase.com/support |
| Vercel Support | https://vercel.com/support |
