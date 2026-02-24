# SylOS Comprehensive Deployment Guide

> Complete walkthrough for deploying SylOS from development to production

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Development Deployment](#development-deployment)
5. [Staging Deployment](#staging-deployment)
6. [Production Deployment](#production-deployment)
7. [Post-Deployment](#post-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Introduction

This guide provides a comprehensive walkthrough for deploying SylOS in various environments. SylOS is a modern operating system that combines traditional desktop functionality with blockchain integration, mobile support, and Web3 technologies.

### What is SylOS?

SylOS is a next-generation operating system featuring:
- **Web-based Desktop** - Modern interface with desktop applications
- **Mobile Companion** - React Native mobile app
- **Blockchain Integration** - Smart contracts and Web3 support
- **IPFS Storage** - Decentralized file storage
- **Multi-environment** - Development, staging, and production support

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx)                    │
└─────────────────────────────────────────────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
┌───▼────┐           ┌──────▼──────┐           ┌──▼────┐
│  Web   │           │    API      │           │ Mobile│
│  App   │           │  Gateway    │           │  App  │
└────────┘           └─────────────┘           └───────┘
       │                       │                       │
    ┌──▼────┐              ┌───▼────┐              ┌──▼────┐
    │React  │              │ Node.js│              │React  │
    │ +     │              │ +      │              │Native │
    │ Vite  │              │ Express│              │ +     │
    │       │              │        │              │ Expo  │
    └───────┘              └────────┘              └───────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│ PostgreSQL  │         │    Redis    │         │   Local     │
│  Database   │         │   Cache     │         │  Storage    │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│ Blockchain  │         │    IPFS     │         │  CDN/S3     │
│  Network    │         │  Storage    │         │  Assets     │
└─────────────┘         └─────────────┘         └─────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vite | Web application |
| **Mobile** | React Native + Expo | Mobile application |
| **Backend** | Node.js + Express | API server |
| **Database** | PostgreSQL | Primary data store |
| **Cache** | Redis | Session and cache |
| **Blockchain** | Hardhat + Ethers.js | Smart contracts |
| **Storage** | IPFS + S3 | File storage |
| **Web Server** | Nginx | Reverse proxy |
| **Process Manager** | PM2 | Process management |
| **CI/CD** | GitHub Actions | Automated deployment |

## Prerequisites

### System Requirements

#### Development Environment
- **Operating System:** Windows 10+, macOS 10.15+, or Linux
- **Memory:** 4GB RAM minimum, 8GB recommended
- **Storage:** 20GB free space
- **CPU:** 2+ cores
- **Network:** Stable internet connection

#### Production Environment
- **Operating System:** Ubuntu 20.04+ LTS or CentOS 8+
- **Memory:** 16GB RAM minimum, 32GB recommended
- **Storage:** 100GB+ SSD
- **CPU:** 8+ cores
- **Network:** High-speed with redundancy

### Required Software

#### Core Dependencies
```bash
# Node.js 18+
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Git
sudo apt install git  # Ubuntu/Debian
brew install git      # macOS

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Nginx
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# PM2
npm install -g pm2
```

#### Database Setup
```bash
# Create database and user
sudo -u postgres createuser --interactive sylos_user
sudo -u postgres createdb sylos_production

# Set password
sudo -u postgres psql
\password sylos_user
\q
```

## Development Deployment

### Quick Setup (5 minutes)

```bash
# Clone repository
git clone <your-sylos-repository>
cd sylos-workspace/deployment-package

# Run quick setup
./quick-setup.sh

# Start development environment
./dev-start.sh
```

### Manual Setup

#### 1. Configure Environment

```bash
# Create development environment
cp environments/development.env.example environments/development.env

# Edit configuration
nano environments/development.env
```

Key settings for development:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite:./data/sylos-dev.db
JWT_SECRET=dev-secret-change-in-production
BLOCKCHAIN_NETWORK=localhost
LOG_LEVEL=debug
```

#### 2. Install Dependencies

```bash
# Web application
cd ../minimax-os
npm install
cd ../deployment-package

# Mobile application
cd ../sylos-mobile
npm install
cd ../deployment-package

# Smart contracts
cd ../smart-contracts
npm install
cd ../deployment-package
```

#### 3. Start Services

```bash
# Start all services
./dev-start.sh

# Or start individually
./dev-web.sh       # Web app only
./dev-mobile.sh    # Mobile app only
./dev-blockchain.sh # Blockchain only
```

#### 4. Access Services

- **Web App:** http://localhost:3000
- **Mobile Dev:** http://localhost:19006
- **Blockchain:** http://localhost:8545
- **Database:** SQLite file at `./data/sylos-dev.db`

### Development Workflow

#### Code Changes
1. Make changes to source files
2. Hot reload will automatically update the browser
3. Check console for errors
4. Test functionality

#### Database Changes
```bash
# Create migration
npm run migrate:create <migration_name>

# Run migrations
npm run migrate:up

# Rollback migration
npm run migrate:down
```

#### Testing
```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Mobile tests
cd ../sylos-mobile
npm test
```

## Staging Deployment

### Server Setup

#### 1. Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create deploy user
sudo adduser deploy
sudo usermod -aG sudo,www-data deploy

# SSH key setup
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 2. Install Dependencies

```bash
# Switch to deploy user
sudo su - deploy

# Install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install global packages
npm install -g pm2

# Clone repository
git clone <your-repository> sylos-workspace
cd sylos-workspace/deployment-package
```

#### 3. Configure Database

```bash
# Create staging database
sudo -u postgres createdb sylos_staging
sudo -u postgres createuser sylos_staging

# Set strong password
sudo -u postgres psql
ALTER USER sylos_staging WITH ENCRYPTED PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE sylos_staging TO sylos_staging;
\q
```

#### 4. Configure Environment

```bash
# Create staging environment
cp environments/staging.env.example environments/staging.env

# Edit configuration
nano environments/staging.env
```

Critical settings for staging:
```bash
NODE_ENV=staging
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://sylos_staging:strong_password@localhost:5432/sylos_staging
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=staging-jwt-secret-very-strong-key
CORS_ORIGIN=https://staging.sylos.yourdomain.com
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d staging.sylos.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### 6. Deploy Application

```bash
# Build and deploy
./deploy-sylos.sh staging

# Configure PM2
pm2 ecosystem.config.js

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 7. Configure Nginx

```nginx
# /etc/nginx/sites-available/sylos-staging
server {
    listen 80;
    server_name staging.sylos.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.sylos.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/staging.sylos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.sylos.yourdomain.com/privkey.pem;

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
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/sylos-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Staging Testing

#### 1. Functional Testing
```bash
# Test web application
curl https://staging.sylos.yourdomain.com

# Test API
curl https://staging.sylos.yourdomain.com/api/health

# Test database connection
psql $DATABASE_URL -c "SELECT version();"
```

#### 2. Performance Testing
```bash
# Install load testing tool
npm install -g artillery

# Run load test
artillery run tests/load-test.yml

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://staging.sylos.yourdomain.com
```

#### 3. Security Testing
```bash
# Run security scan
npm audit

# Test SSL configuration
curl -I https://staging.sylos.yourdomain.com

# Check security headers
curl -I https://staging.sylos.yourdomain.com | grep -i "x-\|strict\|content-security"
```

## Production Deployment

### Security Hardening

#### 1. System Security

```bash
# Server hardening script
#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Install security tools
sudo apt install -y fail2ban logwatch rkhunter

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# SSH hardening
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
sudo systemctl restart ssh

echo "Security hardening completed!"
```

#### 2. Database Security

```sql
-- Production database setup
-- Run as postgres user

-- Create production database
CREATE DATABASE sylos_production;

-- Create application user
CREATE USER sylos_prod WITH ENCRYPTED PASSWORD 'generate_strong_password';

-- Grant permissions
GRANT CONNECT ON DATABASE sylos_production TO sylos_prod;
GRANT USAGE ON SCHEMA public TO sylos_prod;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sylos_prod;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sylos_prod;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;
```

### Production Environment

#### 1. Environment Configuration

```bash
# Create production environment
cp environments/production.env.example environments/production.env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 64)" >> environments/production.env
echo "API_SECRET_KEY=$(openssl rand -base64 64)" >> environments/production.env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> environments/production.env
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> environments/production.env

# Edit configuration
nano environments/production.env
```

#### 2. Production Configuration

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://sylos_prod:generated_password@localhost:5432/sylos_production
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_SSL=true

REDIS_URL=redis://:generated_password@localhost:6379/0
REDIS_TLS=true

JWT_SECRET=generated_256_bit_secret
API_SECRET_KEY=generated_256_bit_secret
ENCRYPTION_KEY=generated_32_bit_key

CORS_ORIGIN=https://sylos.yourdomain.com
HELMET_ENABLED=true

BLOCKCHAIN_NETWORK=mainnet
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
BLOCKCHAIN_PRIVATE_KEY=0x_your_production_private_key

# Security
FORCE_HTTPS=true
SECURE_COOKIES=true
SESSION_SECURE=true
CSRF_PROTECTION=true

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_PATH=/var/log/sylos/app.log
```

#### 3. SSL Certificate

```bash
# Obtain production certificate
sudo certbot --nginx -d sylos.yourdomain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 4. Production Deployment

```bash
# Run production deployment
./deploy-sylos.sh production

# Configure PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sylos',
    script: '../minimax-os/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/sylos/error.log',
    out_file: '/var/log/sylos/out.log',
    log_file: '/var/log/sylos/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 5. Nginx Production Configuration

```nginx
# /etc/nginx/sites-available/sylos
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

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/sylos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sylos.yourdomain.com/privkey.pem;
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' wss: https:;" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/json;

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
    }

    # Health check endpoint
    location /health {
        proxy_pass http://sylos_backend;
        access_log off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/sylos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Production Checklist

#### Pre-Deployment
- [ ] All security patches applied
- [ ] SSL certificates obtained
- [ ] Database configured and secured
- [ ] Environment variables configured
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Load testing completed

#### Deployment
- [ ] Code deployed to production
- [ ] Database migrations run
- [ ] SSL configuration verified
- [ ] Application started
- [ ] Health checks passing
- [ ] Performance baseline established

#### Post-Deployment
- [ ] Functional testing completed
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] Backup verification
- [ ] Security scan completed
- [ ] Documentation updated

## Post-Deployment

### Monitoring Setup

#### 1. Application Monitoring

```bash
# Install monitoring tools
npm install -g @sentry/cli

# Configure Sentry
sentry-cli releases new 1.0.0
sentry-cli releases files 1.0.0 upload-sourcemaps dist/

# Setup PM2 monitoring
pm2 install pm2-server-monit
```

#### 2. Log Management

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/sylos > /dev/null <<EOF
/var/log/sylos/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 deploy adm
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Test log rotation
sudo logrotate -d /etc/logrotate.d/sylos
```

#### 3. Health Checks

```bash
# Create health check script
cat > /usr/local/bin/sylos-health-check.sh << 'EOF'
#!/bin/bash

# Check application
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Application health check failed"
    pm2 restart sylos
fi

# Check database
if ! psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
    echo "Database health check failed"
fi

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Redis health check failed"
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is ${DISK_USAGE}%"
fi

# Check memory
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
if [ $MEMORY_USAGE -gt 85 ]; then
    echo "Memory usage is ${MEMORY_USAGE}%"
fi
EOF

chmod +x /usr/local/bin/sylos-health-check.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/sylos-health-check.sh") | crontab -
```

### Backup Strategy

#### 1. Database Backup

```bash
# Create backup script
cat > /usr/local/bin/sylos-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/sylos"
DATE=$(date +%Y%m%d-%H%M%S)
DB_BACKUP="$BACKUP_DIR/database-$DATE.sql"

mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL > $DB_BACKUP
gzip $DB_BACKUP

# Keep only last 30 days
find $BACKUP_DIR -name "database-*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
if [ -n "$S3_BUCKET" ]; then
    aws s3 cp $DB_BACKUP.gz s3://$S3_BUCKET/backups/
fi

echo "Backup completed: $DB_BACKUP.gz"
EOF

chmod +x /usr/local/bin/sylos-backup.sh

# Schedule daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/sylos-backup.sh") | crontab -
```

#### 2. File Backup

```bash
# Create file backup script
cat > /usr/local/bin/sylos-files-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/sylos"
DATE=$(date +%Y%m%d-%H%M%S)
FILES_BACKUP="$BACKUP_DIR/files-$DATE.tar.gz"

mkdir -p $BACKUP_DIR

# Backup uploads and important files
tar -czf $FILES_BACKUP /var/lib/sylos/uploads 2>/dev/null || true

# Keep only last 7 days
find $BACKUP_DIR -name "files-*.tar.gz" -mtime +7 -delete

echo "Files backup completed: $FILES_BACKUP"
EOF

chmod +x /usr/local/bin/sylos-files-backup.sh

# Schedule daily file backups
(crontab -l 2>/dev/null; echo "0 1 * * * /usr/local/bin/sylos-files-backup.sh") | crontab -
```

## Monitoring & Maintenance

### Daily Maintenance

```bash
#!/bin/bash
# Daily maintenance script

# Update system
sudo apt update && sudo unattended-upgrades -d

# Check service status
systemctl is-active nginx || sudo systemctl restart nginx
systemctl is-active postgresql || sudo systemctl restart postgresql
systemctl is-active redis-server || sudo systemctl restart redis-server

# Check application
pm2 list | grep sylos || pm2 restart all

# Clean temporary files
find /tmp -type f -mtime +1 -delete
find /var/log -name "*.log" -mtime +30 -delete

# Check disk space
df -h | awk '$5 > 80 {print "WARNING: " $1 " is " $5 " full"}'

# Check memory
free -h | awk 'NR==2{printf "Memory: %s/%s (%.1f%%)\n", $3,$2,$3*100/$2}'

echo "Daily maintenance completed"
```

### Weekly Maintenance

```bash
#!/bin/bash
# Weekly maintenance script

# Update dependencies
npm update
npm audit fix

# Database maintenance
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Log rotation
sudo logrotate -f /etc/logrotate.conf

# Security scan
npm audit --audit-level moderate

# SSL certificate check
certbot certificates

# Performance report
./scripts/generate-performance-report.sh

echo "Weekly maintenance completed"
```

### Monthly Maintenance

```bash
#!/bin/bash
# Monthly maintenance script

# Full system update
sudo apt update && sudo apt full-upgrade -y

# SSL certificate renewal
certbot renew

# Security audit
./scripts/comprehensive-security-audit.sh

# Capacity planning
./scripts/capacity-analysis.sh

# Disaster recovery test
./scripts/test-disaster-recovery.sh

# Documentation update
./scripts/update-documentation.sh

echo "Monthly maintenance completed"
```

## Troubleshooting

### Common Issues and Solutions

#### Application Won't Start

```bash
# Check logs
pm2 logs sylos
sudo tail -f /var/log/nginx/error.log

# Check port availability
sudo netstat -tlnp | grep :3000

# Check environment variables
source environments/production.env
echo $NODE_ENV

# Restart services
sudo systemctl restart nginx
pm2 restart all
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Restart database
sudo systemctl restart postgresql
```

#### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Test certificate
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443

# Renew certificate
sudo certbot renew

# Check nginx configuration
sudo nginx -t
```

### Debugging Tools

#### System Diagnostics

```bash
# System information
./scripts/system-check.sh

# Network diagnostics
curl -I http://localhost:3000
nslookup your-domain.com

# Resource usage
top
htop
iostat 1 5

# Database diagnostics
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
redis-cli info
```

#### Log Analysis

```bash
# Application logs
pm2 logs sylos --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
sudo journalctl -u postgresql -f

# Database logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

## Best Practices

### Security

1. **Always use HTTPS** in production
2. **Keep dependencies updated**
3. **Use strong passwords and secrets**
4. **Implement proper backup strategies**
5. **Monitor security logs**
6. **Use firewall rules**
7. **Enable fail2ban**
8. **Regular security audits**

### Performance

1. **Use connection pooling**
2. **Enable compression**
3. **Implement caching strategies**
4. **Optimize database queries**
5. **Use CDN for static assets**
6. **Monitor resource usage**
7. **Load test regularly**
8. **Scale horizontally when needed**

### Maintenance

1. **Automate backups**
2. **Schedule regular updates**
3. **Monitor health checks**
4. **Keep logs rotating**
5. **Document procedures**
6. **Test recovery processes**
7. **Review performance metrics**
8. **Update documentation**

### Development

1. **Use environment-specific configs**
2. **Test changes thoroughly**
3. **Use version control**
4. **Code review process**
5. **Automated testing**
6. **Continuous integration**
7. **Feature flags**
8. **Error tracking**

---

**🎉 Congratulations!** You have successfully deployed SylOS.

For continued operation, remember to:
- Monitor your system regularly
- Keep software updated
- Review security settings
- Test backup and recovery procedures
- Follow the maintenance schedules

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or [SECURITY_MAINTENANCE.md](SECURITY_MAINTENANCE.md)