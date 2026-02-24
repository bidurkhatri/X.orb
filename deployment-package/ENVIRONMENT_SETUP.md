# Environment Setup Guide

> Complete guide for setting up SylOS environments (Development, Staging, Production)

## Overview

SylOS supports multiple deployment environments to support your development workflow. This guide covers setting up each environment with proper configuration, security, and best practices.

## Environment Types

### 🛠️ Development
- **Purpose:** Local development and testing
- **Database:** Local SQLite or PostgreSQL
- **Blockchain:** Local Hardhat network
- **Access:** localhost only
- **Security:** Basic (development tools enabled)

### 🧪 Staging
- **Purpose:** Pre-production testing
- **Database:** Staging PostgreSQL instance
- **Blockchain:** Testnet (Sepolia, Goerli)
- **Access:** Internal network or VPN
- **Security:** Enhanced (production-like security)

### 🚀 Production
- **Purpose:** Live system for end users
- **Database:** Production PostgreSQL with high availability
- **Blockchain:** Mainnet
- **Access:** Public with SSL/TLS
- **Security:** Maximum (production-grade security)

## Prerequisites

### System Requirements

#### Development
- **OS:** Windows 10+, macOS 10.15+, or Linux
- **Memory:** 4GB RAM
- **Storage:** 20GB free space
- **CPU:** 2+ cores

#### Staging/Production
- **OS:** Ubuntu 20.04+ LTS or CentOS 8+
- **Memory:** 8GB+ RAM
- **Storage:** 100GB+ SSD
- **CPU:** 4+ cores
- **Network:** Stable with redundancy

### Software Dependencies

#### Required for All Environments
```bash
# Node.js 18+
node --version  # Should be v18.0.0+

# Git
git --version

# Package managers
npm --version
pnpm --version  # Recommended

# Docker & Docker Compose
docker --version
docker-compose --version
```

#### Additional for Staging/Production
```bash
# Database
postgresql --version
redis-server --version

# Web server
nginx --version

# Process manager
pm2 --version
```

## Environment File Structure

Create environment files in `deployment-package/environments/`:

```bash
deployment-package/
└── environments/
    ├── development.env
    ├── staging.env
    ├── production.env
    └── .env.example
```

## Development Environment Setup

### 1. Base Configuration

Create `development.env`:

```bash
# ===========================================
# SYLOS DEVELOPMENT ENVIRONMENT
# ===========================================

# Application
NODE_ENV=development
PORT=3000
HOST=localhost

# Database (SQLite for development)
DATABASE_URL=sqlite:./data/sylos-dev.db
DATABASE_DEBUG=true

# Redis (optional for development)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=dev-jwt-secret-key-change-in-production
API_SECRET_KEY=dev-api-secret-key-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-chars

# Blockchain (Local Hardhat)
BLOCKCHAIN_NETWORK=localhost
BLOCKCHAIN_RPC_URL=http://localhost:8545
BLOCKCHAIN_PRIVATE_KEY=0x59c6995e998f97a5a0044966f09453885d0ea9e24ce4e0e8a5c2b2b4a8d5a7b
BLOCKCHAIN_CONTRACT_ADDRESSES={}

# Features
FEATURE_BLOCKCHAIN=true
FEATURE_MOBILE=true
FEATURE_FILE_MANAGER=true
FEATURE_APPS=true

# Development tools
DEV_TOOLS_ENABLED=true
HOT_RELOAD=true
DEBUG_MODE=true
LOG_LEVEL=debug

# External APIs (optional for development)
INFURA_PROJECT_ID=
ALCHEMY_API_KEY=
PINATA_API_KEY=
IPFS_GATEWAY_URL=https://gateway.pinata.cloud

# File uploads
UPLOAD_MAX_SIZE=10485760  # 10MB
UPLOAD_PATH=./uploads

# Email (development - use Mailhog or similar)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@sylos.local

# Monitoring (development)
SENTRY_DSN=
ANALYTICS_ENABLED=false
```

### 2. Quick Development Setup

```bash
# 1. Navigate to deployment package
cd deployment-package

# 2. Copy development environment
cp environments/development.env.example environments/development.env

# 3. Make scripts executable
chmod +x *.sh

# 4. Run development setup
./setup-development.sh

# 5. Start development servers
./dev-start.sh
```

### 3. Development Scripts

Create `dev-start.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting SylOS Development Environment"

# Start database (SQLite - no setup needed)
echo "📁 Database: SQLite (built-in)"

# Start Redis (if installed)
if command -v redis-server &> /dev/null; then
    echo "🔴 Starting Redis..."
    redis-server --daemonize yes
fi

# Start blockchain local network
echo "⛓️  Starting local blockchain..."
cd ../smart-contracts
npx hardhat node &

cd ../deployment-package

# Start web application
echo "🌐 Starting web application..."
cd ../minimax-os
npm run dev &

# Start mobile development server
cd ../sylos-mobile
npm start &

echo "✅ Development environment started!"
echo "📱 Web App: http://localhost:3000"
echo "📱 Mobile: http://localhost:19006"
echo "⛓️  Blockchain: http://localhost:8545"
echo "🔴 Redis: redis://localhost:6379"
```

## Staging Environment Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nodejs npm postgresql redis-server nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install PM2
sudo npm install -g pm2

# Log out and back in for group changes
```

### 2. Database Setup

```bash
# Create staging database and user
sudo -u postgres psql << EOF
CREATE DATABASE sylos_staging;
CREATE USER sylos_staging WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE sylos_staging TO sylos_staging;
\q
EOF

# Configure PostgreSQL
sudo nano /etc/postgresql/13/main/postgresql.conf
# Set: max_connections = 100
# Set: shared_buffers = 256MB
# Set: effective_cache_size = 1GB

sudo systemctl restart postgresql
```

### 3. Staging Configuration

Create `staging.env`:

```bash
# ===========================================
# SYLOS STAGING ENVIRONMENT
# ===========================================

# Application
NODE_ENV=staging
PORT=3000
HOST=0.0.0.0

# Database (PostgreSQL)
DATABASE_URL=postgresql://sylos_staging:secure_password@localhost:5432/sylos_staging
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=staging-jwt-secret-very-strong-key-here
API_SECRET_KEY=staging-api-secret-very-strong-key-here
ENCRYPTION_KEY=staging-encryption-key-32-chars-exactly

# Blockchain (Testnet)
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
BLOCKCHAIN_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_FOR_TESTNET
BLOCKCHAIN_CONTRACT_ADDRESSES={"token":"0x...","governance":"0x...","wrapped":"0x..."}

# Features
FEATURE_BLOCKCHAIN=true
FEATURE_MOBILE=true
FEATURE_FILE_MANAGER=true
FEATURE_APPS=true

# Security
CORS_ORIGIN=https://staging.sylos.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Features
FEATURE_BLOCKCHAIN=true
FEATURE_MOBILE=true
FEATURE_FILE_MANAGER=true
FEATURE_APPS=true

# Email (Staging)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM=noreply@staging.sylos.yourdomain.com

# File uploads
UPLOAD_MAX_SIZE=52428800  # 50MB
UPLOAD_PATH=/var/lib/sylos/uploads

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
ANALYTICS_ENABLED=true
ANALYTICS_ID=GA_TRACKING_ID

# SSL
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/staging.sylos.crt
SSL_KEY_PATH=/etc/ssl/private/staging.sylos.key
```

### 4. Nginx Configuration

Create `/etc/nginx/sites-available/sylos-staging`:

```nginx
server {
    listen 80;
    server_name staging.sylos.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.sylos.yourdomain.com;

    ssl_certificate /etc/ssl/certs/staging.sylos.crt;
    ssl_certificate_key /etc/ssl/private/staging.sylos.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /static {
        alias /var/www/sylos/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/sylos-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'sylos-staging',
    script: '../minimax-os/dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'staging',
      PORT: 3000
    },
    error_file: '/var/log/sylos/staging-error.log',
    out_file: '/var/log/sylos/staging-out.log',
    log_file: '/var/log/sylos/staging-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

## Production Environment Setup

### 1. Server Hardening

```bash
# Create deploy user
sudo adduser deploy
sudo usermod -aG sudo,www-data,docker deploy

# Configure SSH
sudo nano /etc/ssh/sshd_config
# Disable root login, password auth, change port

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Install fail2ban
sudo apt install fail2ban
```

### 2. Production Database Setup

```bash
# Install PostgreSQL with optimizations
sudo apt install -y postgresql-13 postgresql-contrib-13

# Configure PostgreSQL
sudo nano /etc/postgresql/13/main/postgresql.conf
```

Edit PostgreSQL configuration:
```ini
# Memory settings
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 20MB
maintenance_work_mem = 512MB

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Connection settings
max_connections = 200

# Logging
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

Create production database:
```bash
sudo -u postgres psql << EOF
CREATE DATABASE sylos_production;
CREATE USER sylos_prod WITH ENCRYPTED PASSWORD 'generate-strong-password';
GRANT ALL PRIVILEGES ON DATABASE sylos_production TO sylos_prod;
ALTER USER sylos_prod CREATEDB;
\q
```

### 3. SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d production.sylos.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Production Configuration

Create `production.env`:

```bash
# ===========================================
# SYLOS PRODUCTION ENVIRONMENT
# ===========================================

# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (PostgreSQL with connection pool)
DATABASE_URL=postgresql://sylos_prod:strong_password@localhost:5432/sylos_production
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_SSL=true

# Redis (with authentication)
REDIS_URL=redis://:strong_redis_password@localhost:6379/0
REDIS_TLS=true

# Security (Generate strong keys!)
JWT_SECRET=ultra-secure-jwt-secret-256-bits-minimum
API_SECRET_KEY=ultra-secure-api-key-256-bits-minimum
ENCRYPTION_KEY=ultra-secure-encryption-key-32
BCRYPT_ROUNDS=12

# Blockchain (Mainnet)
BLOCKCHAIN_NETWORK=mainnet
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_PRODUCTION_INFURA_ID
BLOCKCHAIN_PRIVATE_KEY=0xYOUR_PRODUCTION_PRIVATE_KEY
BLOCKCHAIN_GAS_PRICE=20000000000  # 20 gwei
BLOCKCHAIN_CONTRACT_ADDRESSES={"token":"0x...","governance":"0x...","wrapped":"0x..."}

# Security headers
CORS_ORIGIN=https://sylos.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
HELMET_ENABLED=true

# Features (all enabled in production)
FEATURE_BLOCKCHAIN=true
FEATURE_MOBILE=true
FEATURE_FILE_MANAGER=true
FEATURE_APPS=true
FEATURE_MULTI_USER=true
FEATURE_ADVANCED_PERMISSIONS=true

# Email (Production SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_production_sendgrid_api_key
SMTP_FROM=noreply@sylos.yourdomain.com

# File uploads
UPLOAD_MAX_SIZE=104857600  # 100MB
UPLOAD_PATH=/var/lib/sylos/uploads
UPLOAD_BACKEND=local  # or s3, gcs
UPLOAD_CDN_URL=https://cdn.sylos.yourdomain.com

# CDN and Static files
CDN_URL=https://cdn.sylos.yourdomain.com
STATIC_URL=https://sylos.yourdomain.com/static
ASSET_VERSION=1.0.0

# Monitoring and logging
SENTRY_DSN=https://your-production-sentry-dsn@sentry.io/project
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=/var/log/sylos/app.log

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_ID=GA_PRODUCTION_ID
HOTJAR_ID=your_hotjar_id

# Performance
COMPRESSION=true
CACHE_TTL=3600
SESSION_TIMEOUT=86400000  # 24 hours
REQUEST_TIMEOUT=30000  # 30 seconds

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION=30  # Keep 30 days
BACKUP_S3_BUCKET=sylos-production-backups

# Security
FORCE_HTTPS=true
SECURE_COOKIES=true
SESSION_SECURE=true
CSRF_PROTECTION=true

# Health checks
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/health
HEALTH_CHECK_DB=true
HEALTH_CHECK_REDIS=true
```

### 5. Production Nginx Configuration

Create `/etc/nginx/sites-available/sylos`:

```nginx
# Upstream for load balancing
upstream sylos_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name sylos.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name sylos.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/sylos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sylos.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; img-src 'self' https: data:; font-src 'self' https: data:;" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/json;

    # Main application
    location / {
        proxy_pass http://sylos_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://sylos_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://sylos_backend;
        access_log off;
    }

    # Block common exploit attempts
    location ~* \.(htaccess|htpasswd|ini|phps|fla|psd|log|sh|sql|conf)$ {
        deny all;
    }
}
```

Enable the site and reload nginx:
```bash
sudo ln -s /etc/nginx/sites-available/sylos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Environment-Specific Scripts

### Development Script
```bash
#!/bin/bash
# setup-development.sh

echo "🛠️  Setting up SylOS Development Environment"

# Create directories
mkdir -p data logs uploads

# Install dependencies
npm install
npm install -g @expo/cli hardhat

# Setup environment
cp environments/development.env.example environments/development.env

echo "✅ Development environment ready!"
echo "Run './dev-start.sh' to start development servers"
```

### Staging Script
```bash
#!/bin/bash
# setup-staging.sh

echo "🧪 Setting up SylOS Staging Environment"

# Create necessary directories
sudo mkdir -p /var/lib/sylos/uploads
sudo mkdir -p /var/log/sylos
sudo chown deploy:www-data /var/lib/sylos
sudo chown deploy:www-data /var/log/sylos

# Install production dependencies
npm ci --only=production

# Setup PM2
npm install -g pm2
pm2 ecosystem.config.js

echo "✅ Staging environment ready!"
echo "Run './deploy-sylos.sh staging' to deploy"
```

### Production Script
```bash
#!/bin/bash
# setup-production.sh

echo "🚀 Setting up SylOS Production Environment"

# System hardening
sudo apt update && sudo apt upgrade -y
sudo apt install -y fail2ban ufw logrotate

# Create directories with proper permissions
sudo mkdir -p /var/lib/sylos/{uploads,backups,data}
sudo mkdir -p /var/log/sylos
sudo chown -R deploy:www-data /var/lib/sylos
sudo chown -R deploy:adm /var/log/sylos

# Setup log rotation
sudo nano /etc/logrotate.d/sylos

# Install and configure services
sudo systemctl enable postgresql redis-server nginx
sudo systemctl start postgresql redis-server nginx

echo "✅ Production environment ready!"
echo "Run './deploy-sylos.sh production' to deploy"
```

## Testing Environments

### Environment Validation
```bash
#!/bin/bash
# validate-environment.sh

ENVIRONMENT=${1:-"development"}

echo "🔍 Validating $ENVIRONMENT environment..."

# Check environment file
if [[ ! -f "environments/$ENVIRONMENT.env" ]]; then
    echo "❌ Environment file not found: environments/$ENVIRONMENT.env"
    exit 1
fi

# Load environment
source "environments/$ENVIRONMENT.env"

# Validate required variables
required_vars=("NODE_ENV" "DATABASE_URL" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Required variable not set: $var"
        exit 1
    fi
done

# Test database connection
if command -v psql &> /dev/null; then
    echo "🗄️  Testing database connection..."
    # Add database connection test
fi

# Test Redis connection
if command -v redis-cli &> /dev/null; then
    echo "🔴 Testing Redis connection..."
    redis-cli ping > /dev/null
fi

echo "✅ Environment validation passed!"
```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

#### Redis Connection Issues
```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis
redis-cli ping

# Check Redis configuration
sudo nano /etc/redis/redis.conf
```

#### Environment Variables Not Loading
```bash
# Check environment file format
file environments/production.env

# Validate environment file
source environments/production.env
echo $NODE_ENV

# Check for syntax errors
bash -n environments/production.env
```

### Environment-Specific Logs

#### Development
- Application: Console output
- Database: SQLite file in `data/`
- Blockchain: `hardhat.log`

#### Staging/Production
- Application: PM2 logs (`pm2 logs sylos`)
- Database: `/var/log/postgresql/`
- Nginx: `/var/log/nginx/`
- System: `/var/log/syslog`

## Best Practices

### Security
1. **Never commit environment files** to version control
2. **Use strong, unique secrets** for each environment
3. **Enable SSL/TLS** for staging and production
4. **Implement proper CORS** policies
5. **Use environment-specific API keys**

### Performance
1. **Enable connection pooling** for databases
2. **Use Redis for caching** in staging/production
3. **Implement CDN** for static assets
4. **Enable compression** (gzip/brotli)
5. **Monitor resource usage** regularly

### Maintenance
1. **Regular backups** of databases and uploads
2. **Automated updates** for security patches
3. **Health checks** and monitoring
4. **Log rotation** and cleanup
5. **Capacity planning** reviews

## Next Steps

After setting up your environment:

1. **Development:** Start coding in `minimax-os/`
2. **Staging:** Deploy and test with `./deploy-sylos.sh staging`
3. **Production:** Follow the [Production Checklist](./PRODUCTION_CHECKLIST.md)

For mobile development, see [Mobile Build Guide](./MOBILE_BUILD_GUIDE.md)

For security best practices, see [Security Guide](./SECURITY.md)