# SylOS Secrets Management Configuration

## Environment Variables

### Required for All Environments
- `NODE_ENV` - Node.js environment (development/staging/production)
- `NETWORK_NAME` - Blockchain network name
- `RPC_URL` - RPC endpoint URL
- `CHAIN_ID` - Blockchain chain ID
- `EXPLORER_URL` - Block explorer URL
- `CURRENCY_SYMBOL` - Network currency symbol

### Contract Deployment
- `DEPLOYER_PRIVATE_KEY` - Private key for contract deployment (KEEP SECURE)
- `VERIFIER_API_KEY` - API key for contract verification

### Frontend Configuration
- `FRONTEND_URL` - Frontend application URL
- `API_URL` - Backend API URL
- `IPFS_GATEWAY` - IPFS gateway URL

### Database Configuration
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection string

### External Services
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `PINATA_API_KEY` - Pinata API key for IPFS
- `PINATA_SECRET_KEY` - Pinata secret key

### Monitoring and Analytics
- `SENTRY_DSN` - Sentry error tracking DSN
- `ANALYTICS_ID` - Analytics service ID

## Environment-Specific Secrets

### Development
```bash
# Minimal secrets for development
DEPLOYER_PRIVATE_KEY=0x123...abc
VERIFIER_API_KEY=dev_key_123
DATABASE_URL=postgresql://dev:dev@localhost:5432/sylos_dev
REDIS_URL=redis://localhost:6379
```

### Staging
```bash
# Staging environment secrets
DEPLOYER_PRIVATE_KEY=0x456...def
VERIFIER_API_KEY=staging_key_456
DATABASE_URL=postgresql://stage:stage@staging-db:5432/sylos_staging
REDIS_URL=redis://staging-redis:6379
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...
PINATA_API_KEY=staging_pinata_key
PINATA_SECRET_KEY=staging_pinata_secret
```

### Production
```bash
# Production environment secrets
DEPLOYER_PRIVATE_KEY=0x789...ghi  # HIGHLY SECURE
VERIFIER_API_KEY=production_key_789
DATABASE_URL=postgresql://prod:secure@prod-cluster:5432/sylos_production
REDIS_URL=redis://prod-cluster:6379
SUPABASE_URL=https://production-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...  # PUBLIC KEY
SUPABASE_SERVICE_KEY=eyJhbGciOi...  # SECURE KEY
PINATA_API_KEY=production_pinata_key
PINATA_SECRET_KEY=production_pinata_secret
SENTRY_DSN=https://xxx@sentry.io/123456
```

## Platform-Specific Secret Management

### GitHub Actions
1. Go to repository Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `TESTNET_DEPLOYER_PRIVATE_KEY`
   - `TESTNET_RPC_URL`
   - `MAINNET_DEPLOYER_PRIVATE_KEY`
   - `MAINNET_RPC_URL`
   - `POLYGONSCAN_API_KEY`
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `PINATA_API_KEY`
   - `PINATA_SECRET_KEY`
   - `DISCORD_WEBHOOK`
   - `SNYK_TOKEN`

### GitLab CI/CD
1. Go to project Settings > CI/CD > Variables
2. Add variables with the same names as above
3. Set variable types to "Masked" for sensitive data

### Local Development
Create `.env.local` files in each project directory:
```bash
# minimax-os/.env.local
VITE_DEPLOYER_PRIVATE_KEY=0x123...abc
VITE_RPC_URL=https://rpc-mumbai.maticvigil.com
VITE_CHAIN_ID=80001
# ... other variables
```

## Security Best Practices

### Private Keys
- Never commit private keys to version control
- Use environment variables only
- Rotate keys regularly
- Use test keys for development
- Use hardware wallets for production

### API Keys
- Restrict API key permissions
- Set appropriate rate limits
- Use different keys for different environments
- Monitor API key usage
- Rotate keys periodically

### Database Connections
- Use connection pooling
- Set up read replicas
- Use SSL/TLS encryption
- Implement proper access controls
- Regular backups

### General Security
- Enable 2FA on all service accounts
- Use strong, unique passwords
- Regular security audits
- Monitor for suspicious activity
- Keep dependencies updated
- Use dependency scanning
- Implement proper logging

## Secret Rotation Schedule

### Private Keys
- Development: Weekly
- Staging: Bi-weekly
- Production: Monthly

### API Keys
- Development: Monthly
- Staging: Every 2 months
- Production: Quarterly

### Database Passwords
- Development: Weekly
- Staging: Bi-weekly
- Production: Monthly

## Emergency Procedures

### Key Compromise
1. Immediately revoke the compromised key
2. Generate a new key pair
3. Update all configurations
4. Redeploy affected services
5. Notify team members
6. Document the incident

### Service Outage
1. Check secret accessibility
2. Verify environment variables
3. Restart affected services
4. Monitor for errors
5. Update documentation if needed

## Tools and Commands

### Check Environment Variables
```bash
# List all environment variables
env | grep -E "(SYLOS|REACT|VITE)"

# Check specific variable
echo $DEPLOYER_PRIVATE_KEY | head -c 10...
```

### Validate Configuration
```bash
# Check if required variables are set
./deployment/scripts/validate-config.sh --env production

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test RPC connection
curl -X POST $RPC_URL -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Secrets Backup
```bash
# Export non-sensitive configuration
./deployment/scripts/backup-config.sh --env production

# Note: Never backup private keys or sensitive secrets
```

## Compliance and Auditing

### Access Logging
- Log all secret access attempts
- Monitor for unauthorized access
- Regular access reviews
- Implement proper audit trails

### Compliance Checks
- Regular security assessments
- Compliance with industry standards
- Data protection regulations
- Regular penetration testing

### Documentation
- Keep this document updated
- Document all secret management procedures
- Train team members on security practices
- Regular security training