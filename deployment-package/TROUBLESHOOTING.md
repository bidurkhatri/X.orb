# Troubleshooting Guide

> Comprehensive troubleshooting guide for SylOS deployment and operation

## Table of Contents

1. [Common Installation Issues](#common-installation-issues)
2. [Web Application Problems](#web-application-problems)
3. [Mobile App Issues](#mobile-app-issues)
4. [Blockchain Integration Problems](#blockchain-integration-problems)
5. [Database Issues](#database-issues)
6. [Network & Connectivity Problems](#network--connectivity-problems)
7. [Performance Issues](#performance-issues)
8. [Security Issues](#security-issues)
9. [Environment-Specific Issues](#environment-specific-issues)
10. [Log Analysis](#log-analysis)
11. [Diagnostic Tools](#diagnostic-tools)
12. [Emergency Procedures](#emergency-procedures)

## Common Installation Issues

### Prerequisites Not Met

#### Node.js Version Issues
```bash
# Check current version
node --version

# If version is too old, install correct version
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 8.x.x or higher
```

**Error:** `Node.js version v16.x.x found. Required: v18.0.0 or higher`

**Solution:**
1. Check Node.js version: `node --version`
2. If version is < 18, upgrade using nvm or package manager
3. Verify installation: `node --version` and `npm --version`

#### Permission Errors
```bash
# Error: EACCES: permission denied

# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.config

# Fix script permissions
chmod +x deployment-package/*.sh

# Fix directory permissions
sudo chown -R $USER:$USER /path/to/sylos-workspace
```

**Error:** `Permission denied` when running deployment scripts

**Solution:**
1. Make scripts executable: `chmod +x *.sh`
2. Fix ownership: `sudo chown -R $USER:$USER .`
3. Run with appropriate permissions

#### Docker Not Available
```bash
# Check Docker installation
docker --version
docker-compose --version

# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and back in, then test
docker run hello-world
```

**Error:** `command not found: docker`

**Solution:**
1. Install Docker following official instructions
2. Ensure user is in docker group: `sudo usermod -aG docker $USER`
3. Log out and back in for group changes to take effect

### Environment Configuration Issues

#### Missing Environment File
```bash
# Error: Environment file not found

# Check available environments
ls -la environments/

# Create missing environment file
cp environments/.env.example environments/development.env

# Verify file exists
ls -la environments/development.env
```

**Error:** `Environment file 'development.env' not found`

**Solution:**
1. List available environment files: `ls environments/`
2. Copy example file: `cp environments/.env.example environments/development.env`
3. Edit the file with correct values: `nano environments/development.env`

#### Invalid Environment Variables
```bash
# Validate environment file
source environments/development.env
echo $NODE_ENV  # Should output 'development'

# Check for syntax errors
bash -n environments/development.env  # Should return nothing if valid
```

**Error:** `Invalid environment variable: DATABASE_URL`

**Solution:**
1. Check environment file syntax: `bash -n environments/development.env`
2. Verify variable format: `DATABASE_URL=postgresql://user:pass@host:port/db`
3. Ensure no spaces around `=`: `CORRECT=var` not `CORRECT = var`

## Web Application Problems

### Build Failures

#### Webpack/Build Errors
```bash
# Clear caches and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint

# Verify build process
npm run build
```

**Error:** `Module not found` or `Cannot resolve module`

**Solution:**
1. Clear npm cache: `npm cache clean --force`
2. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check for import/export errors in source code
4. Verify all dependencies are properly installed

#### Memory Issues During Build
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Or set in package.json scripts
# "build": "NODE_OPTIONS='--max-old-space-size=4096' webpack --mode production"
```

**Error:** `JavaScript heap out of memory`

**Solution:**
1. Increase Node.js memory limit: `export NODE_OPTIONS="--max-old-space-size=4096"`
2. Close other applications to free memory
3. Consider upgrading server RAM

### Runtime Issues

#### Application Won't Start
```bash
# Check logs
npm run dev  # Look for error messages

# Check if port is in use
lsof -i :3000
netstat -tlnp | grep 3000

# Kill process using port
kill -9 $(lsof -t -i:3000)
```

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
1. Find process using the port: `lsof -i :3000`
2. Kill the process: `kill -9 <PID>`
3. Or use a different port: `PORT=3001 npm start`

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database status
sudo systemctl status postgresql

# Check connection string format
echo $DATABASE_URL  # Should be: postgresql://user:pass@host:port/db
```

**Error:** `Connection refused` or `Authentication failed`

**Solution:**
1. Verify database is running: `sudo systemctl status postgresql`
2. Check connection string format
3. Verify credentials: `psql $DATABASE_URL`
4. Check firewall rules: `sudo ufw status`

#### API Endpoints Not Working
```bash
# Test API endpoint
curl -X GET http://localhost:3000/api/health

# Check backend logs
tail -f logs/app.log

# Verify routes are registered
npm run dev  # Check for route registration logs
```

**Error:** `404 Not Found` or `Cannot GET /api/endpoint`

**Solution:**
1. Verify API server is running: `curl http://localhost:3000/api/health`
2. Check route definitions in source code
3. Verify middleware is properly configured
4. Check for CORS issues with cross-origin requests

### SSL/HTTPS Issues

#### Certificate Problems
```bash
# Check certificate validity
openssl x509 -in /path/to/cert.pem -text -noout

# Test SSL configuration
curl -I https://your-domain.com

# Check certificate expiration
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Error:** `SSL certificate error` or `Certificate expired`

**Solution:**
1. Check certificate validity: `openssl x509 -in cert.pem -text -noout`
2. Renew Let's Encrypt certificate: `sudo certbot renew`
3. Verify certificate chain: `curl -I https://your-domain.com`
4. Check nginx configuration: `sudo nginx -t`

## Mobile App Issues

### Development Issues

#### Expo Start Problems
```bash
# Clear Expo cache
npx expo start --clear

# Reset Metro bundler
npx expo start --reset-cache

# Check Expo version
npx expo --version
```

**Error:** `Metro bundler failed to start` or `Unable to resolve module`

**Solution:**
1. Clear Metro cache: `npx expo start --clear`
2. Reset cache: `npx expo start --reset-cache`
3. Reinstall dependencies: `rm -rf node_modules && npm install`
4. Check for import errors in source code

#### Device Connection Issues

**iOS Simulator:**
```bash
# Reset simulator
# iOS Simulator → Device → Erase All Content and Settings

# Check simulator is running
xcrun simctl list devices

# Rebuild and install
npx expo run:ios
```

**Android Emulator:**
```bash
# Check connected devices
adb devices

# Start emulator
emulator -avd <avd_name>

# Clear app data
adb shell pm clear com.sylos.mobile

# Reinstall app
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Error:** `No devices found` or `Unable to connect to Metro`

**Solution:**
1. Ensure device/emulator is running
2. Check USB debugging (Android) or simulator (iOS)
3. Scan QR code with Expo Go app
4. Check network connectivity between device and dev server

### Build Issues

#### Android Build Failures
```bash
# Clean Android build
cd android
./gradlew clean
cd ..

# Rebuild with verbose logging
cd android
./gradlew assembleRelease --stacktrace --info

# Check Android SDK
sdkmanager --list | grep "build-tools"
```

**Error:** `Execution failed for task ':app:assembleRelease'` or `Build tools version not found`

**Solution:**
1. Clean build directory: `cd android && ./gradlew clean`
2. Update Android SDK build tools: `sdkmanager "build-tools;33.0.0"`
3. Check Gradle version compatibility
4. Verify environment variables: `echo $ANDROID_HOME`

#### iOS Build Failures
```bash
# Clean iOS build
cd ios
rm -rf Pods
rm Podfile.lock
pod install
cd ..

# Check Xcode version
xcodebuild -version

# Verify provisioning profile
security find-identity -v -p codesigning
```

**Error:** `Code signing error` or `Provisioning profile not found`

**Solution:**
1. Clean CocoaPods: `cd ios && rm -rf Pods && pod install`
2. Open project in Xcode and configure signing
3. Verify developer account is active
4. Check bundle identifier matches provisioning profile

### Production Build Issues

#### EAS Build Problems
```bash
# Check EAS CLI version
eas --version

# Login to Expo
eas login

# Check build status
eas build:list

# View build logs
eas build:view <build-id>
```

**Error:** `EAS build failed` or `Authentication failed`

**Solution:**
1. Login to Expo: `eas login`
2. Check EAS configuration: `cat eas.json`
3. Verify project settings in app.json
4. Check build logs for specific errors

## Blockchain Integration Problems

### Smart Contract Deployment

#### Gas Estimation Issues
```bash
# Check network connection
npx hardhat run scripts/network-info.js --network localhost

# Estimate gas manually
npx hardhat run scripts/estimate-gas.js

# Check account balance
npx hardhat run scripts/check-balance.js --network localhost
```

**Error:** `Gas estimation failed` or `Insufficient funds`

**Solution:**
1. Check account balance: `npx hardhat run scripts/check-balance.js`
2. Verify network connection
3. Adjust gas price: `gasPrice: ethers.utils.parseUnits('20', 'gwei')`
4. Check private key is correct

#### Contract Verification Issues
```bash
# Verify contract on Etherscan
npx hardhat run scripts/verify.js --network mainnet

# Check constructor arguments
echo $CONSTRUCTOR_ARGS
```

**Error:** `Contract verification failed` or `Constructor args mismatch`

**Solution:**
1. Verify constructor arguments match deployment
2. Check Solidity version compatibility
3. Use correct verification API key
4. Ensure contract is not verified already

### Web3 Connection Issues

#### Provider Connection
```javascript
// Test Web3 connection
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

try {
  const network = await provider.getNetwork();
  console.log('Connected to network:', network);
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

**Error:** `Failed to connect to provider` or `Invalid RPC URL`

**Solution:**
1. Verify RPC URL is correct and accessible
2. Check if blockchain node is running
3. Test connection with curl: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545`
4. Check network configuration

#### Transaction Issues
```javascript
// Check transaction status
const receipt = await provider.getTransactionReceipt(txHash);
console.log('Transaction status:', receipt.status);

// Check gas price
const gasPrice = await provider.getGasPrice();
console.log('Current gas price:', gasPrice.toString());
```

**Error:** `Transaction failed` or `Out of gas`

**Solution:**
1. Check transaction receipt: `provider.getTransactionReceipt(txHash)`
2. Increase gas limit if needed: `gasLimit: 300000`
3. Check account balance for gas fees
4. Verify contract address is correct

## Database Issues

### PostgreSQL Problems

#### Connection Refused
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check if listening on correct port
sudo netstat -tlnp | grep 5432

# Test connection
psql -h localhost -U postgres -d sylos_production
```

**Error:** `Connection refused` or `FATAL: password authentication failed`

**Solution:**
1. Start PostgreSQL: `sudo systemctl start postgresql`
2. Check connection: `psql -h localhost -U postgres`
3. Verify pg_hba.conf allows connections
4. Check firewall rules: `sudo ufw status`

#### Performance Issues
```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Check database size
SELECT pg_size_pretty(pg_database_size('sylos_production'));

-- Check table sizes
SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Error:** `Queries taking too long` or `Database is slow`

**Solution:**
1. Check slow query log: `SELECT * FROM pg_stat_statements`
2. Add indexes to frequently queried columns
3. Analyze tables: `ANALYZE table_name;`
4. Vacuum database: `VACUUM ANALYZE;`

#### Migration Issues
```bash
# Check migration status
npm run migrate:status

# Run specific migration
npm run migrate:up -- 20230101120000

# Rollback migration
npm run migrate:down -- 20230101120000
```

**Error:** `Migration failed` or `Table already exists`

**Solution:**
1. Check migration status: `npm run migrate:status`
2. Verify migration files are correct
3. Check for circular dependencies
4. Backup database before running migrations

### Redis Issues

#### Connection Problems
```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping  # Should return PONG

# Check Redis configuration
redis-cli config get "*"
```

**Error:** `Connection refused` or `Redis server is down`

**Solution:**
1. Start Redis: `sudo systemctl start redis-server`
2. Test connection: `redis-cli ping`
3. Check Redis logs: `tail -f /var/log/redis/redis-server.log`
4. Verify configuration: `redis-cli config get "*"`

## Network & Connectivity Problems

### DNS Issues
```bash
# Test DNS resolution
nslookup sylos.yourdomain.com
dig sylos.yourdomain.com

# Check local hosts file
cat /etc/hosts

# Test with different DNS servers
nslookup sylos.yourdomain.com 8.8.8.8
```

**Error:** `DNS resolution failed` or `Name or service not known`

**Solution:**
1. Check DNS configuration: `cat /etc/resolv.conf`
2. Test DNS resolution: `nslookup your-domain.com`
3. Update /etc/hosts if needed
4. Check domain registrar settings

### Firewall Issues
```bash
# Check firewall status
sudo ufw status
sudo iptables -L

# Test port connectivity
nc -zv localhost 3000
telnet localhost 3000

# Check open ports
sudo netstat -tlnp
```

**Error:** `Connection timeout` or `Port unreachable`

**Solution:**
1. Check firewall rules: `sudo ufw status`
2. Open required ports: `sudo ufw allow 80/tcp`
3. Test port connectivity: `nc -zv localhost 3000`
4. Verify nginx configuration: `sudo nginx -t`

### SSL/TLS Issues
```bash
# Test SSL certificate
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443

# Check certificate chain
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Test HTTPS redirect
curl -I http://your-domain.com
```

**Error:** `SSL certificate error` or `Handshake failure`

**Solution:**
1. Check certificate validity: `openssl x509 -in cert.pem -text -noout`
2. Verify certificate chain
3. Test with SSL checker tools
4. Update nginx SSL configuration

## Performance Issues

### Slow Response Times
```bash
# Check system resources
top
htop
iostat 1 5

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Monitor application metrics
pm2 monit
```

**Error:** `Response time > 5 seconds` or `Application is slow`

**Solution:**
1. Check system resources: `top`, `htop`
2. Optimize database queries
3. Enable caching: Redis, CDN
4. Scale horizontally: load balancing

### High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Check for memory leaks
node --inspect deployment-package/deploy-sylos.sh

# Monitor with PM2
pm2 show sylos-app
pm2 logs sylos-app
```

**Error:** `Out of memory` or `High memory usage`

**Solution:**
1. Check memory usage: `free -h`
2. Identify memory-hungry processes: `ps aux --sort=-%mem`
3. Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`
4. Restart application periodically

### Database Bottlenecks
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Error:** `Database queries timing out` or `Connection pool exhausted`

**Solution:**
1. Optimize slow queries: add indexes, rewrite queries
2. Increase connection pool size
3. Use connection pooling (pg-pool)
4. Implement query caching

## Security Issues

### Authentication Failures
```bash
# Check JWT token
echo $JWT_SECRET

# Test token generation
node -e "console.log(require('./src/utils/jwt.js').generateTokens({id: 1, email: 'test@example.com'}))"

# Check user database
psql $DATABASE_URL -c "SELECT id, email, role FROM users LIMIT 5;"
```

**Error:** `Invalid token` or `Authentication failed`

**Solution:**
1. Verify JWT secret is set: `echo $JWT_SECRET`
2. Check token expiration
3. Verify user credentials in database
4. Check session management

### SSL Certificate Issues
```bash
# Check certificate expiration
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
curl -I https://your-domain.com

# Check Let's Encrypt renewal
sudo certbot certificates
```

**Error:** `Certificate expired` or `SSL handshake failed`

**Solution:**
1. Check certificate expiration: `sudo certbot certificates`
2. Renew certificate: `sudo certbot renew`
3. Update nginx configuration
4. Verify certificate chain

## Environment-Specific Issues

### Development Environment
```bash
# Check development setup
./scripts/system-check.sh

# View development logs
tail -f logs/development.log

# Reset development environment
./scripts/reset-development.sh
```

**Common Issues:**
- Hot reload not working → Clear cache: `npm run dev -- --clear`
- Database connection issues → Check SQLite file permissions
- Environment variables not loading → Verify .env file format

### Staging Environment
```bash
# Check staging configuration
source environments/staging.env
echo $NODE_ENV  # Should output 'staging'

# Test staging deployment
./deploy-sylos.sh staging --skip-deps

# Check staging logs
tail -f /var/log/sylos/staging.log
```

**Common Issues:**
- SSL certificate not working → Check staging domain DNS
- Database migration fails → Verify migration scripts
- Memory issues → Check server resources

### Production Environment
```bash
# Check production status
pm2 status
sudo systemctl status nginx postgresql

# Monitor production
pm2 monit

# Check production logs
pm2 logs sylos-app --lines 100
```

**Common Issues:**
- High load → Check system resources and optimize
- Database connection pool exhausted → Increase pool size
- Out of disk space → Clean logs and temporary files

## Log Analysis

### Application Logs
```bash
# View recent application logs
tail -f logs/app.log

# Search for errors
grep -i error logs/app.log

# Count error occurrences
grep -c ERROR logs/app.log

# Filter by date
grep "2023-01-01" logs/app.log
```

### System Logs
```bash
# System logs
sudo tail -f /var/log/syslog
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f

# Authentication logs
sudo tail -f /var/log/auth.log

# Application logs
pm2 logs sylos-app
```

### Database Logs
```bash
# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log

# Check for errors
grep ERROR /var/log/postgresql/postgresql-13-main.log

# Monitor connections
grep "connection" /var/log/postgresql/postgresql-13-main.log
```

## Diagnostic Tools

### System Information
```bash
#!/bin/bash
# diagnostic-tool.sh

echo "=== SylOS Diagnostic Report ==="
echo "Date: $(date)"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime)"
echo

echo "=== System Resources ==="
echo "CPU: $(lscpu | grep 'Model name' | cut -d: -f2 | xargs)"
echo "Memory: $(free -h | awk '/^Mem:/{print $2}')"
echo "Disk: $(df -h / | awk 'NR==2{print $2}')"
echo

echo "=== Network ==="
echo "IP Address: $(hostname -I | awk '{print $1}')"
echo "Open Ports: $(netstat -tlnp | grep LISTEN)"
echo

echo "=== Services ==="
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PostgreSQL: $(psql --version | head -1)"
echo "Redis: $(redis-cli --version)"
echo

echo "=== Application Status ==="
echo "PM2 Status: $(pm2 list 2>/dev/null || echo 'Not running')"
echo "Nginx Status: $(systemctl is-active nginx 2>/dev/null || echo 'Not running')"
echo "PostgreSQL Status: $(systemctl is-active postgresql 2>/dev/null || echo 'Not running')"
echo

echo "=== Disk Usage ==="
df -h

echo "=== Memory Usage ==="
free -h

echo "=== Running Processes ==="
ps aux --sort=-%mem | head -10
```

### Network Diagnostics
```bash
# Test connectivity
curl -I http://localhost:3000
curl -I http://localhost:3000/api/health

# Check DNS resolution
nslookup your-domain.com
dig your-domain.com

# Test SSL
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check open ports
nmap -p 80,443,3000,5432,6379 localhost
```

### Database Diagnostics
```bash
# PostgreSQL diagnostics
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
psql $DATABASE_URL -c "SELECT datname, size FROM pg_database;"

# Redis diagnostics
redis-cli info
redis-cli ping
```

## Emergency Procedures

### Application Down
```bash
#!/bin/bash
# emergency-recovery.sh

echo "🚨 Emergency recovery started..."

# 1. Check critical services
echo "Checking critical services..."
systemctl is-active nginx || echo "NGINX is down"
systemctl is-active postgresql || echo "PostgreSQL is down"
pm2 list || echo "PM2/Node.js apps are down"

# 2. Restart services
echo "Restarting services..."
sudo systemctl restart nginx
sudo systemctl restart postgresql
pm2 restart all

# 3. Clear caches
echo "Clearing caches..."
redis-cli FLUSHALL
npm run cache:clear 2>/dev/null || echo "Cache clear not available"

# 4. Check logs for errors
echo "Checking recent errors..."
tail -n 50 /var/log/nginx/error.log
pm2 logs sylos-app --lines 20

# 5. Verify services
echo "Verifying service status..."
curl -f http://localhost:3000/api/health || echo "Application not responding"
psql $DATABASE_URL -c "SELECT 1;" || echo "Database not responding"

echo "✅ Emergency recovery completed"
```

### Security Incident
```bash
#!/bin/bash
# security-incident-response.sh

echo "🚨 Security incident response initiated..."

# 1. Isolate affected systems
echo "Isolating affected systems..."
sudo ufw deny from suspicious_ip 2>/dev/null || echo "Firewall isolation completed"

# 2. Block malicious traffic
echo "Blocking malicious traffic..."
sudo fail2ban-client set sshd banip suspicious_ip 2>/dev/null || echo "Fail2ban action completed"

# 3. Rotate secrets
echo "Rotating sensitive credentials..."
# Note: This should be done manually in production

# 4. Enable security lockdown
echo "Enabling security lockdown..."
./scripts/security-lockdown.sh

# 5. Alert stakeholders
echo "Alerting stakeholders..."
./scripts/alert-stakeholders.sh

# 6. Collect evidence
echo "Collecting incident evidence..."
cp /var/log/auth.log logs/security-incident-$(date +%Y%m%d-%H%M%S).log
cp /var/log/nginx/access.log logs/security-incident-$(date +%Y%m%d-%H%M%S).log

echo "✅ Security incident response completed"
```

### Database Recovery
```bash
#!/bin/bash
# database-recovery.sh

echo "🗄️  Database recovery initiated..."

# 1. Stop application
pm2 stop sylos-app

# 2. Backup current database
pg_dump $DATABASE_URL > backup-before-recovery-$(date +%Y%m%d-%H%M%S).sql

# 3. Check database integrity
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# 4. Restore from backup if needed
# psql $DATABASE_URL < backup-20230101-120000.sql

# 5. Verify recovery
psql $DATABASE_URL -c "SELECT count(*) FROM users;"

# 6. Restart application
pm2 start sylos-app

echo "✅ Database recovery completed"
```

## Getting Help

### Self-Diagnosis Checklist
- [ ] Check system resources (CPU, memory, disk)
- [ ] Review error logs for patterns
- [ ] Verify environment variables are set
- [ ] Test individual components (database, Redis, etc.)
- [ ] Check network connectivity and DNS
- [ ] Review recent configuration changes

### Log Collection Script
```bash
#!/bin/bash
# collect-logs.sh

echo "Collecting logs for support..."

mkdir -p support-logs-$(date +%Y%m%d-%H%M%S)
cd support-logs-$(date +%Y%m%d-%H%M%S)

# System information
uname -a > system-info.txt
free -h > memory-info.txt
df -h > disk-info.txt

# Application logs
cp ../logs/app.log . 2>/dev/null || echo "App log not found" > app.log
cp ../logs/error.log . 2>/dev/null || echo "Error log not found" > error.log

# System logs
journalctl -u nginx --since "1 hour ago" > nginx-logs.txt
journalctl -u postgresql --since "1 hour ago" > postgres-logs.txt

# PM2 logs
pm2 logs sylos-app --lines 100 > pm2-logs.txt

echo "Logs collected in $(pwd)"
echo "Archive this directory and share with support team"
```

### When to Escalate
- Security incidents
- Data loss or corruption
- Complete system outage
- Performance degradation affecting users
- Repeated failures after troubleshooting

### Contact Information
- Technical Lead: [Your contact]
- DevOps Team: [Your contact]
- Security Team: [Your contact]
- Emergency Hotline: [Your contact]

---

**Remember:** Always backup data before making changes in troubleshooting procedures. Test solutions in a non-production environment first when possible.