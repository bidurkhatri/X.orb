# Security and Maintenance Guide

> Comprehensive security practices and maintenance procedures for SylOS

## Table of Contents

1. [Security Overview](#security-overview)
2. [Security Hardening](#security-hardening)
3. [Authentication & Authorization](#authentication--authorization)
4. [Data Protection](#data-protection)
5. [Network Security](#network-security)
6. [Blockchain Security](#blockchain-security)
7. [Mobile App Security](#mobile-app-security)
8. [Infrastructure Security](#infrastructure-security)
9. [Monitoring & Detection](#monitoring--detection)
10. [Incident Response](#incident-response)
11. [Maintenance Procedures](#maintenance-procedures)
12. [Backup & Recovery](#backup--recovery)
13. [Performance Optimization](#performance-optimization)
14. [Compliance & Auditing](#compliance--auditing)

## Security Overview

### Security Principles

SylOS follows these core security principles:

1. **Defense in Depth:** Multiple layers of security
2. **Zero Trust:** Verify everything, trust nothing by default
3. **Least Privilege:** Minimal access rights
4. **Security by Design:** Security from the ground up
5. **Continuous Monitoring:** Always watching for threats

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   WAF/CDN   │  │   DDoS      │  │   Rate Limiting    │  │
│  │   Firewall  │  │   Protection│  │   & Throttling     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  SSL/TLS    │  │   Input     │  │   Authentication    │  │
│  │  1.3/TLS    │  │  Validation │  │   & Authorization   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Database   │  │   File      │  │   Encryption at     │  │
│  │   Security  │  │  Storage    │  │      Rest           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Blockchain Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Smart      │  │   Wallet    │  │   Transaction       │  │
│  │  Contract   │  │  Security   │  │   Validation        │  │
│  │  Audit      │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Hardening

### Server Hardening

#### Operating System Security

```bash
#!/bin/bash
# server-hardening.sh

echo "🔒 Starting server hardening..."

# 1. System updates
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y

# 2. Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 3. Install security tools
sudo apt install -y fail2ban logwatch rkhunter chkrootkit

# 4. Configure fail2ban
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

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 5. SSH hardening
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# 6. Set up automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

echo "✅ Server hardening completed!"
```

#### Application Security

```javascript
// src/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
});

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  securityHeaders,
  rateLimiter,
  corsOptions
};
```

### SSL/TLS Configuration

#### Nginx SSL Configuration

```nginx
# /etc/nginx/sites-available/sylos-ssl
server {
    listen 80;
    server_name sylos.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sylos.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/sylos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sylos.yourdomain.com/privkey.pem;
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' wss: https:; media-src 'self';" always;
    
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
        
        # Security headers for proxied requests
        proxy_hide_header X-Powered-By;
        add_header X-Frame-Options "SAMEORIGIN" always;
    }
}
```

## Authentication & Authorization

### JWT Security

```javascript
// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate secure JWT secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

class JWTManager {
  static generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      issuer: 'sylos-app',
      audience: 'sylos-users',
      algorithm: 'HS512'
    });

    const refreshToken = jwt.sign(
      { userId: user.id, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRY,
        issuer: 'sylos-app',
        audience: 'sylos-users',
        algorithm: 'HS512'
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS512'],
        issuer: 'sylos-app',
        audience: 'sylos-users'
      });
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  static isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  }
}

module.exports = JWTManager;
```

### Role-Based Access Control (RBAC)

```javascript
// src/middleware/rbac.js
const permissions = {
  USER: ['read:own', 'write:own'],
  MODERATOR: ['read:own', 'write:own', 'read:all', 'moderate:content'],
  ADMIN: ['read:own', 'write:own', 'read:all', 'write:all', 'moderate:content', 'manage:users', 'system:config'],
  SUPER_ADMIN: ['*'] // All permissions
};

function requirePermission(requiredPermission) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userPermissions = permissions[userRole] || [];

    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!userPermissions.includes('*') && !userPermissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermission,
        userRole 
      });
    }

    next();
  };
}

function requireAnyPermission(permissionList) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userPermissions = permissions[userRole] || [];

    const hasPermission = permissionList.some(permission => 
      userPermissions.includes('*') || userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissionList,
        userRole 
      });
    }

    next();
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  permissions
};
```

### Multi-Factor Authentication (MFA)

```javascript
// src/services/mfa.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

class MFAService {
  static generateSecret(email) {
    const secret = speakeasy.generateSecret({
      name: `SylOS (${email})`,
      issuer: 'SylOS',
      length: 32
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      qr_code: null // Will be generated later
    };
  }

  static async generateQRCode(otpauth_url) {
    try {
      return await qrcode.toDataURL(otpauth_url);
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  static verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 step tolerance
    });
  }

  static generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
}

module.exports = MFAService;
```

## Data Protection

### Encryption at Rest

```javascript
// src/utils/encryption.js
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';

class EncryptionService {
  static encrypt(text) {
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('sylos-data'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  static decrypt(encryptedData) {
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('sylos-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  static hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(32).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { salt, hash };
  }

  static verifyPassword(password, salt, hash) {
    const { hash: verifyHash } = this.hashPassword(password, salt);
    return hash === verifyHash;
  }
}

module.exports = EncryptionService;
```

### Database Security

```sql
-- Database security setup
-- PostgreSQL

-- Create application user with minimal privileges
CREATE USER sylos_app WITH PASSWORD 'secure_password';
CREATE USER sylos_migrator WITH PASSWORD 'migration_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE sylos_production TO sylos_app;
GRANT USAGE ON SCHEMA public TO sylos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sylos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sylos_app;

-- Migrator permissions
GRANT CREATE, CONNECT ON DATABASE sylos_production TO sylos_migrator;
GRANT ALL ON SCHEMA public TO sylos_migrator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO sylos_migrator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO sylos_migrator;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- RLS policies for files table
CREATE POLICY "Users can access own files" ON files
    FOR ALL USING (auth.uid() = user_id);

-- Enable audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Create audit log table
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log(table_name, operation, old_values, user_id)
        VALUES(TG_TABLE_NAME, TG_OP, to_jsonb(OLD), current_setting('app.user_id', true));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log(table_name, operation, old_values, new_values, user_id)
        VALUES(TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.user_id', true));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log(table_name, operation, new_values, user_id)
        VALUES(TG_TABLE_NAME, TG_OP, to_jsonb(NEW), current_setting('app.user_id', true));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_files_trigger
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_transactions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## Network Security

### Firewall Configuration

```bash
#!/bin/bash
# configure-firewall.sh

echo "🔥 Configuring firewall..."

# Reset UFW
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw default deny forward

# Allow essential services
sudo ufw allow 2222/tcp comment 'SSH'  # Non-standard SSH port
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow database access (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 5432 comment 'PostgreSQL'
sudo ufw allow from 10.0.0.0/8 to any port 6379 comment 'Redis'

# Rate limiting for SSH
sudo ufw limit 2222/tcp

# Deny brute force attempts
sudo ufw deny from 192.168.1.0/24 to any port 2222

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status verbose
```

### API Security

```javascript
// src/middleware/api-security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// Security configuration
const apiSecurity = {
  // Rate limiting - more restrictive for API
  apiLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // 60 requests per 15 minutes
    message: 'Too many API requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Slow down repeated requests
  speedLimiter: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 40, // Allow 40 requests per 15 minutes at full speed
    delayMs: 500, // Add 500ms delay per request after delayAfter
  }),

  // Input sanitization
  sanitizeInput: (req, res, next) => {
    // Remove mongoDB operators from query
    mongoSanitize(req.body);
    mongoSanitize(req.query);
    mongoSanitize(req.params);

    // Prevent XSS in user input
    ['body', 'query', 'params'].forEach(key => {
      if (req[key]) {
        Object.keys(req[key]).forEach(k => {
          if (typeof req[key][k] === 'string') {
            req[key][k] = xss(req[key][k]);
          }
        });
      }
    });

    next();
  },

  // API key validation
  requireApiKey: (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    next();
  }
};

module.exports = apiSecurity;
```

## Blockchain Security

### Smart Contract Security

```solidity
// contracts/security/Security.sol
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SecurityBase
 * @dev Base contract with security features
 */
abstract contract SecurityBase is ReentrancyGuard, Pausable, Ownable {
    
    // Emergency pause functionality
    bool public emergencyPaused = false;
    
    // Maximum transaction amount
    uint256 public maxTransactionAmount = 1000 ether;
    
    // Whitelisted addresses
    mapping(address => bool) public whitelisted;
    
    // Blacklisted addresses
    mapping(address => bool) public blacklisted;
    
    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender] || owner() == msg.sender, "Not whitelisted");
        _;
    }
    
    modifier notBlacklisted() {
        require(!blacklisted[msg.sender], "Address blacklisted");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be positive");
        require(amount <= maxTransactionAmount, "Amount exceeds limit");
        _;
    }
    
    modifier whenNotEmergencyPaused() {
        require(!emergencyPaused, "Contract emergency paused");
        _;
    }
    
    // Emergency functions
    function setEmergencyPause(bool _paused) external onlyOwner {
        emergencyPaused = _paused;
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }
    
    function addToWhitelist(address _address) external onlyOwner {
        whitelisted[_address] = true;
    }
    
    function removeFromWhitelist(address _address) external onlyOwner {
        whitelisted[_address] = false;
    }
    
    function addToBlacklist(address _address) external onlyOwner {
        blacklisted[_address] = true;
    }
    
    function removeFromBlacklist(address _address) external onlyOwner {
        blacklisted[_address] = false;
    }
    
    function setMaxTransactionAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be positive");
        maxTransactionAmount = _amount;
    }
}
```

### Web3 Security

```javascript
// src/services/web3-security.js
const Web3 = require('web3');
const { ethers } = require('ethers');

class Web3SecurityService {
  constructor() {
    this.providers = new Map();
    this.rateLimits = new Map();
  }

  // Secure provider creation
  createSecureProvider(rpcUrl, chainId) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Verify chain ID
    return provider.detectNetwork().then(network => {
      if (network.chainId !== chainId) {
        throw new Error(`Invalid chain ID. Expected: ${chainId}, Got: ${network.chainId}`);
      }
      return provider;
    });
  }

  // Validate transaction parameters
  validateTransaction(tx) {
    const requiredFields = ['to', 'value', 'gasLimit', 'gasPrice'];
    
    for (const field of requiredFields) {
      if (!tx[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate address
    if (!ethers.utils.isAddress(tx.to)) {
      throw new Error('Invalid address format');
    }

    // Validate value (non-negative)
    if (ethers.BigNumber.from(tx.value).isNegative()) {
      throw new Error('Value cannot be negative');
    }

    // Check gas limits
    if (ethers.BigNumber.from(tx.gasLimit).gt(ethers.BigNumber.from(500000))) {
      throw new Error('Gas limit too high');
    }

    return true;
  }

  // Rate limiting for blockchain calls
  checkRateLimit(address, maxCalls = 100, windowMs = 60000) {
    const now = Date.now();
    const key = `${address}-${Math.floor(now / windowMs)}`;
    
    const current = this.rateLimits.get(key) || 0;
    
    if (current >= maxCalls) {
      throw new Error('Rate limit exceeded');
    }
    
    this.rateLimits.set(key, current + 1);
    
    // Clean up old entries
    setTimeout(() => {
      this.rateLimits.delete(key);
    }, windowMs);
  }

  // Secure contract interaction
  async callContractMethod(contract, method, args = [], options = {}) {
    try {
      // Validate transaction
      const txParams = {
        to: contract.address,
        ...options
      };
      
      this.validateTransaction(txParams);
      
      // Check rate limit
      this.checkRateLimit(options.from || '0x0');
      
      // Make the call
      if (options.value) {
        return await contract[method](...args, { value: options.value });
      } else {
        return await contract[method](...args);
      }
    } catch (error) {
      // Log security events
      console.error('Contract call failed:', {
        method,
        args: args.length,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // Monitor for suspicious activities
  async monitorTransaction(txHash) {
    const provider = this.getProvider('mainnet');
    const receipt = await provider.getTransactionReceipt(txHash);
    
    // Check for failed transactions (potential attacks)
    if (receipt.status === 0) {
      this.logSecurityEvent('FAILED_TRANSACTION', {
        txHash,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString()
      });
    }
    
    // Monitor gas price (potential MEV attacks)
    const tx = await provider.getTransaction(txHash);
    if (tx.gasPrice.gt(ethers.utils.parseUnits('100', 'gwei'))) {
      this.logSecurityEvent('HIGH_GAS_PRICE', {
        txHash,
        gasPrice: tx.gasPrice.toString(),
        timestamp: new Date().toISOString()
      });
    }
    
    return receipt;
  }

  logSecurityEvent(event, data) {
    console.log('SECURITY_EVENT', JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString()
    }));
  }
}

module.exports = Web3SecurityService;
```

## Mobile App Security

### Secure Storage

```javascript
// src/services/secureStorage.js
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

class SecureStorageService {
  // Store encrypted data
  static async setSecureItem(key, value, useBiometric = false) {
    try {
      let storedValue = value;
      
      if (useBiometric) {
        // Verify biometric authentication
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (!hasHardware || !isEnrolled) {
          throw new Error('Biometric authentication not available');
        }
        
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access secure data',
          fallbackLabel: 'Use passcode',
        });
        
        if (!result.success) {
          throw new Error('Biometric authentication failed');
        }
      }
      
      await SecureStore.setItemAsync(key, storedValue, {
        keychainService: 'SylOS',
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
      
      return true;
    } catch (error) {
      console.error('Secure storage error:', error);
      throw error;
    }
  }

  // Retrieve encrypted data
  static async getSecureItem(key, useBiometric = false) {
    try {
      if (useBiometric) {
        // Verify biometric authentication
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access secure data',
        });
        
        if (!result.success) {
          throw new Error('Biometric authentication failed');
        }
      }
      
      const value = await SecureStore.getItemAsync(key, {
        keychainService: 'SylOS'
      });
      
      return value;
    } catch (error) {
      console.error('Secure storage retrieval error:', error);
      throw error;
    }
  }

  // Delete secure data
  static async deleteSecureItem(key) {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainService: 'SylOS'
      });
      return true;
    } catch (error) {
      console.error('Secure storage deletion error:', error);
      throw error;
    }
  }

  // Check if biometric authentication is available
  static async isBiometricAvailable() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      return {
        hasHardware,
        isEnrolled,
        isAvailable: hasHardware && isEnrolled
      };
    } catch (error) {
      return { hasHardware: false, isEnrolled: false, isAvailable: false };
    }
  }
}

export default SecureStorageService;
```

### Code Obfuscation and Anti-Tampering

```bash
# Add to android/app/build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            
            // Enable obfuscation
            obfuscate = true
            
            // Keep sensitive classes
            keepattributes *Annotation*
            keepattributes Signature
            keepattributes *Annotation*,Signature,InnerClasses,Deprecated,SourceFile,LineNumberTable
            
            // Exclude security-sensitive classes from obfuscation
            -keep class com.sylos.mobile.security.** { *; }
            -keep class com.sylos.mobile.blockchain.** { *; }
        }
    }
}
```

## Monitoring & Detection

### Security Monitoring

```javascript
// src/middleware/security-monitoring.js
const winston = require('winston');
const rateLimit = require('express-rate-limit');

// Configure security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' }),
    new winston.transports.Console()
  ],
});

// Security event types
const SECURITY_EVENTS = {
  FAILED_LOGIN: 'failed_login',
  MULTIPLE_FAILED_LOGINS: 'multiple_failed_logins',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_TOKEN: 'invalid_token',
  BLOCKCHAIN_ANOMALY: 'blockchain_anomaly',
  DATA_BREACH: 'data_breach'
};

// Security event logger
function logSecurityEvent(eventType, data, req) {
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    userId: req?.user?.id,
    ...data
  };

  securityLogger.warn('Security Event', event);

  // Alert on critical events
  if (data.severity === 'critical') {
    securityLogger.error('CRITICAL SECURITY EVENT', event);
    // Send alerts (email, Slack, etc.)
  }
}

// Failed login monitoring
const failedLogins = new Map();

function monitorFailedLogins(req, res, next) {
  const email = req.body.email;
  const ip = req.ip;
  
  if (email) {
    const key = `${ip}-${email}`;
    const attempts = failedLogins.get(key) || 0;
    failedLogins.set(key, attempts + 1);
    
    if (attempts >= 5) {
      logSecurityEvent(SECURITY_EVENTS.MULTIPLE_FAILED_LOGINS, {
        email,
        attempts: attempts + 1,
        severity: 'high'
      }, req);
    }
    
    // Cleanup old entries
    setTimeout(() => {
      failedLogins.delete(key);
    }, 15 * 60 * 1000); // 15 minutes
  }
  
  next();
}

// Anomaly detection
function detectAnomalies(req, res, next) {
  const userAgent = req.get('User-Agent');
  const ip = req.ip;
  
  // Detect bot activity
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot && req.path.startsWith('/api/')) {
    logSecurityEvent(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, {
      type: 'potential_bot',
      userAgent,
      path: req.path
    }, req);
  }
  
  // Detect rapid requests
  const now = Date.now();
  const userKey = `${ip}-${userAgent}`;
  const requestCount = rateLimit.get(req, res) || 0;
  
  if (requestCount > 50) {
    logSecurityEvent(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, {
      requestCount,
      userKey
    }, req);
  }
  
  next();
}

module.exports = {
  logSecurityEvent,
  monitorFailedLogins,
  detectAnomalies,
  SECURITY_EVENTS
};
```

### Security Alerts

```javascript
// src/services/alertService.js
const nodemailer = require('nodemailer');
const axios = require('axios');

class AlertService {
  constructor() {
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Send security alert
  async sendSecurityAlert(event, severity = 'high') {
    const alert = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      server: process.env.SERVER_NAME || 'sylos-app'
    };

    try {
      // Email alert
      if (severity === 'critical' || severity === 'high') {
        await this.sendEmailAlert(alert);
      }

      // Slack alert
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(alert);
      }

      // Discord alert
      if (process.env.DISCORD_WEBHOOK_URL) {
        await this.sendDiscordAlert(alert);
      }

      // PagerDuty alert
      if (severity === 'critical' && process.env.PAGERDUTY_KEY) {
        await this.sendPagerDutyAlert(alert);
      }

    } catch (error) {
      console.error('Alert sending failed:', error);
    }
  }

  async sendEmailAlert(alert) {
    const mailOptions = {
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAIL,
      subject: `Security Alert: ${alert.event.type} - ${alert.severity.toUpperCase()}`,
      html: this.generateEmailTemplate(alert)
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  async sendSlackAlert(alert) {
    const color = this.getSeverityColor(alert.severity);
    const payload = {
      attachments: [{
        color,
        title: 'Security Alert',
        fields: [
          { title: 'Event', value: alert.event.type, short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Timestamp', value: alert.timestamp, short: true },
          { title: 'Server', value: alert.server, short: true }
        ],
        text: JSON.stringify(alert.event, null, 2)
      }]
    };

    await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
  }

  getSeverityColor(severity) {
    const colors = {
      low: '#36a64f',
      medium: '#ff9f00',
      high: '#ff6b6b',
      critical: '#ff0000'
    };
    return colors[severity] || '#36a64f';
  }

  generateEmailTemplate(alert) {
    return `
      <h2>Security Alert</h2>
      <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
      <p><strong>Event Type:</strong> ${alert.event.type}</p>
      <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
      <p><strong>Server:</strong> ${alert.server}</p>
      <h3>Event Details:</h3>
      <pre>${JSON.stringify(alert.event, null, 2)}</pre>
    `;
  }
}

module.exports = new AlertService();
```

## Maintenance Procedures

### Daily Maintenance

```bash
#!/bin/bash
# daily-maintenance.sh

echo "🔧 Starting daily maintenance..."

# 1. System updates
echo "📦 Checking for system updates..."
sudo apt update && sudo apt list --upgradable

# 2. Security updates
echo "🔒 Checking security updates..."
sudo unattended-upgrade --dry-run

# 3. Log rotation
echo "📄 Rotating logs..."
sudo logrotate -f /etc/logrotate.conf

# 4. Database maintenance
echo "🗄️  Database maintenance..."
npm run db:vacuum 2>/dev/null || echo "Database maintenance script not found"

# 5. Backup verification
echo "💾 Verifying backups..."
./scripts/verify-backups.sh

# 6. SSL certificate check
echo "🔐 Checking SSL certificates..."
./scripts/check-ssl.sh

# 7. Disk space check
echo "💿 Checking disk space..."
df -h | awk '$5 > 80 {print "WARNING: " $1 " is " $5 " full"}'

# 8. Memory usage check
echo "🧠 Checking memory usage..."
free -h | awk 'NR==2{printf "Memory Usage: %s/%s (%.1f%%)\n", $3,$2,$3*100/$2}'

# 9. Service status check
echo "⚙️  Checking service status..."
systemctl is-active postgresql redis-server nginx || echo "Some services may be down"

# 10. Security scan
echo "🛡️  Running security scan..."
npm audit --audit-level moderate || echo "Security scan completed with warnings"

echo "✅ Daily maintenance completed!"
```

### Weekly Maintenance

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "🔧 Starting weekly maintenance..."

# 1. Full system update
echo "📦 Full system update..."
sudo apt update && sudo apt upgrade -y

# 2. Dependency updates
echo "📦 Updating Node.js dependencies..."
npm update
npm audit fix

# 3. Database optimization
echo "🗄️  Database optimization..."
# Run database optimization queries
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# 4. Log cleanup
echo "🧹 Cleaning old logs..."
find /var/log -name "*.log" -mtime +30 -delete
find /var/log -name "*.gz" -mtime +90 -delete

# 5. Security scan
echo "🛡️  Full security scan..."
npm audit --audit-level low
npx snyk test 2>/dev/null || echo "Snyk scan not available"

# 6. Performance monitoring
echo "📊 Generating performance report..."
./scripts/generate-performance-report.sh

# 7. Backup validation
echo "💾 Full backup validation..."
./scripts/validate-all-backups.sh

# 8. SSL certificate renewal check
echo "🔐 SSL certificate renewal check..."
certbot certificates

# 9. Firewall rule review
echo "🔥 Reviewing firewall rules..."
sudo ufw status verbose

# 10. Security configuration review
echo "🔍 Security configuration review..."
./scripts/security-audit.sh

echo "✅ Weekly maintenance completed!"
```

### Monthly Maintenance

```bash
#!/bin/bash
# monthly-maintenance.sh

echo "🔧 Starting monthly maintenance..."

# 1. Major system update
echo "📦 Major system update..."
sudo apt update && sudo apt full-upgrade -y

# 2. Security patch deployment
echo "🔒 Deploying security patches..."
sudo unattended-upgrade -d

# 3. Certificate renewal
echo "🔐 Renewing SSL certificates..."
certbot renew

# 4. Database maintenance
echo "🗄️  Full database maintenance..."
# Full vacuum, reindex, etc.
psql $DATABASE_URL -c "REINDEX DATABASE sylos_production;"
psql $DATABASE_URL -c "VACUUM FULL ANALYZE;"

# 5. Capacity planning review
echo "📊 Capacity planning review..."
./scripts/capacity-analysis.sh

# 6. Security audit
echo "🛡️  Full security audit..."
./scripts/comprehensive-security-audit.sh

# 7. Performance optimization
echo "⚡ Performance optimization..."
./scripts/optimize-performance.sh

# 8. Disaster recovery test
echo "🚨 Disaster recovery test..."
./scripts/test-disaster-recovery.sh

# 9. Compliance check
echo "📋 Compliance check..."
./scripts/compliance-check.sh

# 10. Documentation update
echo "📚 Updating documentation..."
./scripts/update-documentation.sh

echo "✅ Monthly maintenance completed!"
```

### Emergency Maintenance

```bash
#!/bin/bash
# emergency-maintenance.sh

echo "🚨 Emergency maintenance started..."

# 1. Immediate security patches
echo "🔒 Applying immediate security patches..."
sudo unattended-upgrade -d

# 2. Restart critical services
echo "⚙️  Restarting critical services..."
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart redis-server

# 3. Clear caches
echo "🧹 Clearing caches..."
npm run cache:clear
redis-cli FLUSHALL
sudo systemctl restart sylos-app

# 4. Security lockdown
echo "🔐 Enabling security lockdown..."
./scripts/security-lockdown.sh

# 5. Monitoring activation
echo "📡 Activating enhanced monitoring..."
./scripts/activate-enhanced-monitoring.sh

# 6. Alert stakeholders
echo "📢 Alerting stakeholders..."
./scripts/alert-stakeholders.sh

echo "✅ Emergency maintenance completed!"
```

## Next Steps

After implementing security measures:

1. **Review Security Policies:** [SECURITY_POLICIES.md](./SECURITY_POLICIES.md)
2. **Implement Monitoring:** Set up comprehensive monitoring
3. **Schedule Maintenance:** Automate maintenance tasks
4. **Train Team:** Ensure team is trained on security procedures
5. **Regular Audits:** Schedule regular security audits

For performance optimization, see [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md)