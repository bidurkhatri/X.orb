# Security Hardening Implementation Guide

## Table of Contents
1. [HTTPS Enforcement](#https-enforcement)
2. [Certificate Pinning](#certificate-pinning)
3. [Content Security Policy](#content-security-policy)
4. [Subresource Integrity](#subresource-integrity)
5. [Security Headers](#security-headers)
6. [Rate Limiting](#rate-limiting)
7. [Input Sanitization](#input-sanitization)
8. [XSS Protection](#xss-protection)
9. [CSRF Protection](#csrf-protection)
10. [SQL Injection Prevention](#sql-injection-prevention)
11. [Cryptographic Best Practices](#cryptographic-best-practices)
12. [Security Monitoring](#security-monitoring)
13. [Vulnerability Scanning](#vulnerability-scanning)
14. [Penetration Testing Framework](#penetration-testing-framework)

---

## 1. HTTPS Enforcement

### Web Server Configuration

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Verify certificate chain
    ssl_trusted_certificate /path/to/root_CA_cert_plus_intermediates;
}
```

#### Apache Configuration
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key
    SSLCertificateChainFile /path/to/intermediate.crt
    
    # SSL Protocols
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    
    # HSTS Header
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    
    # OCSP Stapling
    SSLUseStapling on
    SSLStaplingCache "shmcb:logs/stapling-cache"
</VirtualHost>
```

### Application-Level HTTPS Enforcement

#### Node.js (Express.js)
```javascript
const express = require('express');
const helmet = require('helmet');
const app = express();

// Force HTTPS in production
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));
```

#### Python (Django)
```python
# settings.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
```

---

## 2. Certificate Pinning

### Android Implementation
```kotlin
// Certificate Pinning Implementation
class CertificatePinner {
    private val certificatePinner = CertificatePinner.Builder()
        .add("api.yourdomain.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
        .add("yourdomain.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
        .build()
    
    val client = OkHttpClient.Builder()
        .certificatePinner(certificatePinner)
        .build()
}
```

### iOS Implementation
```swift
// Certificate Pinning Implementation
class CertificatePinner {
    private func createPinnedCertificates() -> [SecCertificate] {
        // Certificate data (SPKI hash)
        let certData = Data(base64Encoded: "Your pinned certificate data")!
        return [SecCertificateCreateWithData(nil, certData as CFData)!]
    }
    
    func createPinnedSSLPinningPolicy() -> [String: SecCertificate] {
        let certs = createPinnedCertificates()
        return [
            "api.yourdomain.com": certs[0]
        ]
    }
}
```

### Web Implementation (CSP)
```javascript
// Web Certificate Pinning via Service Worker
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.hostname === 'api.yourdomain.com') {
        event.respondWith(
            fetch(event.request, { 
                cache: 'no-cache',
                mode: 'same-origin'
            })
        );
    }
});
```

---

## 3. Content Security Policy

### Basic CSP Configuration
```http
Content-Security-Policy: default-src 'self'; 
                        script-src 'self' 'unsafe-inline' https://trusted-cdn.com; 
                        style-src 'self' 'unsafe-inline' https://trusted-cdn.com; 
                        img-src 'self' data: https:; 
                        font-src 'self' https://fonts.gstatic.com; 
                        connect-src 'self' https://api.yourdomain.com; 
                        frame-ancestors 'none'; 
                        form-action 'self'; 
                        base-uri 'self';
```

### Strict CSP Configuration
```http
Content-Security-Policy: default-src 'none'; 
                        script-src 'self' 'nonce-{random-nonce}'; 
                        style-src 'self' 'nonce-{random-nonce}'; 
                        img-src 'self' data:; 
                        font-src 'self'; 
                        connect-src 'self' https://api.yourdomain.com; 
                        frame-ancestors 'none'; 
                        base-uri 'none';
```

### React CSP Implementation
```javascript
// Dynamic CSP with Nonce
import { Helmet } from 'react-helmet';

const nonce = base64(randomBytes(16));

const App = () => {
    return (
        <Helmet>
            <meta 
                httpEquiv="Content-Security-Policy" 
                content={`default-src 'self'; script-src 'self' 'nonce-${nonce}';`}
            />
        </Helmet>
    );
};
```

### Express.js CSP Implementation
```javascript
const csp = require('express-csp-header');

app.use(csp({
    directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https:'],
        'connect-src': ['self'],
        'frame-ancestors': ['none'],
        'object-src': ['none']
    }
}));
```

---

## 4. Subresource Integrity

### HTML Implementation
```html
<script src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"
        integrity="sha384-c1UDjmpEnws61Rhc7Ojw5VCex8ENq0bFwsLhKCYKn/4cDgq4qE5zc+1Vwwh+0EYI"
        crossorigin="anonymous"></script>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
      integrity="sha384-9ndCyUa+J4w5YTZlZi3X2gylfMtEL0D9PA4J9ZGEW9Qk8Gq7Qj6lq8XEu5dJVlSO"
      crossorigin="anonymous">
```

### Generating SRI Hashes
```bash
# Using OpenSSL
openssl dgst -sha384 -binary example.js | openssl base64 -A

# Using Node.js
const crypto = require('crypto');
const fs = require('fs');

function generateSRI(filePath) {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha384').update(buffer).digest('base64');
    return `sha384-${hash}`;
}
```

### Automated SRI Generation
```javascript
// Package.json script
{
    "scripts": {
        "generate-sri": "node scripts/generate-sri.js"
    }
}

// generate-sri.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function updateSRI() {
    const htmlFiles = fs.readdirSync('public').filter(f => f.endsWith('.html'));
    
    htmlFiles.forEach(file => {
        let content = fs.readFileSync(path.join('public', file), 'utf8');
        
        // Add SRI attributes to external resources
        content = content.replace(
            /<script src="([^"]+)"[^>]*><\/script>/g,
            (match, src) => {
                if (src.startsWith('https://') || src.startsWith('//')) {
                    return match.replace('><\/script>', ` integrity="" crossorigin="anonymous"><\/script>`);
                }
                return match;
            }
        );
        
        fs.writeFileSync(path.join('public', file), content);
    });
}
```

---

## 5. Security Headers

### Complete Security Headers Middleware
```javascript
const helmet = require('helmet');

app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            reportTo: "csp-endpoint",
            reportUri: "/csp-report"
        }
    },
    
    // X-Frame-Options
    frameguard: { action: 'deny' },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // HSTS
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    
    // X-XSS-Protection
    xssFilter: true,
    
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    
    // Permissions Policy
    permissions: {
        geolocation: "none",
        microphone: "none",
        camera: "none"
    }
}));
```

### Django Security Headers
```python
# settings.py
MIDDLEWARE += [
    'django.middleware.security.SecurityMiddleware',
]

# Custom security headers
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
REFERRER_POLICY = 'strict-origin-when-cross-origin'

# Custom middleware for additional headers
class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        response['Cross-Origin-Opener-Policy'] = 'same-origin'
        response['Cross-Origin-Embedder-Policy'] = 'require-corp'
        return response
```

### Nginx Security Headers
```nginx
# Security Headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline';" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
add_header Cross-Origin-Resource-Policy "same-site" always;
add_header X-Permitted-Cross-Domain-Policies "none" always;
add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
add_header Pragma "no-cache" always;
add_header Expires "0" always;
```

---

## 6. Rate Limiting

### Express.js Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Basic rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // limit each IP to 5 auth requests per windowMs
    skipSuccessfulRequests: true,
});

// Different rate limits for different routes
app.use('/api/login', authLimiter);
app.use('/api/', limiter);
app.use('/api/admin', adminLimiter);

// Dynamic rate limiting based on user type
const createDynamicLimiter = (maxRequests, windowMs) => {
    return rateLimit({
        windowMs,
        max: (req) => {
            // Different limits for authenticated users
            return req.user ? maxRequests * 10 : maxRequests;
        },
        keyGenerator: (req) => {
            return req.user ? req.user.id : req.ip;
        }
    });
};
```

### Django Rate Limiting
```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'auth': '5/15min'
    }
}

# Custom throttling
class BurstRateThrottle(throttling.BaseThrottle):
    def allow_request(self, request, view):
        # Implement burst rate limiting logic
        return True

# View with custom throttle
class LoginView(APIView):
    throttle_classes = [BurstRateThrottle]
```

### Redis-based Distributed Rate Limiting
```javascript
const redis = require('redis');
const client = redis.createClient();

class RedisRateLimiter {
    constructor(options) {
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;
    }

    async isAllowed(key) {
        const now = Date.now();
        const window = Math.floor(now / this.windowMs);
        const redisKey = `rate_limit:${key}:${window}`;
        
        const current = await client.incr(redisKey);
        
        if (current === 1) {
            await client.expire(redisKey, this.windowMs / 1000);
        }
        
        return current <= this.maxRequests;
    }
}

// Usage
const apiLimiter = new RedisRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 100
});

app.use(async (req, res, next) => {
    const allowed = await apiLimiter.isAllowed(req.ip);
    if (!allowed) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
});
```

### API Gateway Rate Limiting
```yaml
# AWS API Gateway Rate Limiting
resources:
  - path: /api/users
    throttling:
      rateLimit: 100
      burstLimit: 200
    methods:
      - get
      - post

# Azure API Management Rate Limiting
<policies>
  <rate-limit calls="100" renewal-period="60">
    <headers>
      <header name="X-Rate-Limit-Limit" />
      <header name="X-Rate-Limit-Remaining" />
      <header name="X-Rate-Limit-Reset" />
    </headers>
  </rate-limit>
</policies>
```

---

## 7. Input Sanitization

### Node.js Input Sanitization
```javascript
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');
const xss = require('xss');

class InputSanitizer {
    static sanitizeHTML(input) {
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            ALLOWED_ATTR: ['href'],
            ALLOW_DATA_ATTR: false
        });
    }

    static sanitizeString(input) {
        return validator.escape(String(input).trim());
    }

    static sanitizeEmail(input) {
        return validator.normalizeEmail(String(input).trim());
    }

    static sanitizeURL(input) {
        const url = String(input).trim();
        if (validator.isURL(url, { protocols: ['https', 'http'] })) {
            return url;
        }
        throw new Error('Invalid URL');
    }

    static sanitizeSQL(input) {
        // Remove SQL injection patterns
        return String(input)
            .replace(/[';\\]/g, '')
            .replace(/(union|select|insert|delete|update|drop|create|alter|exec|execute)/gi, '');
    }
}

// Middleware for input sanitization
const sanitizeInput = (req, res, next) => {
    const cleanObject = (obj) => {
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                obj[key] = InputSanitizer.sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                cleanObject(obj[key]);
            }
        });
    };

    if (req.body) cleanObject(req.body);
    if (req.query) cleanObject(req.query);
    if (req.params) cleanObject(req.params);
    
    next();
};
```

### Python Input Sanitization
```python
import bleach
import validators
import re
import html

def sanitize_html(content):
    """Sanitize HTML content"""
    allowed_tags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br']
    allowed_attrs = {'a': ['href']}
    
    return bleach.clean(content, tags=allowed_tags, attributes=allowed_attrs)

def sanitize_input(input_string):
    """General input sanitization"""
    if not input_string:
        return ""
    
    # HTML entity encoding
    sanitized = html.escape(str(input_string).strip())
    
    # Remove potential XSS patterns
    sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    
    return sanitized

def sanitize_email(email):
    """Email sanitization"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if re.match(pattern, email):
        return email.lower()
    raise ValueError("Invalid email format")

def sanitize_url(url):
    """URL sanitization"""
    if validators.url(url, public=True):
        if url.startswith(('http://', 'https://')):
            return url
    raise ValueError("Invalid URL")

# Django form validation
from django import forms
from django.core.exceptions import ValidationError

class SecureForm(forms.Form):
    name = forms.CharField(max_length=100, widget=forms.TextInput(attrs={'class': 'form-control'}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={'class': 'form-control'}))
    message = forms.CharField(widget=forms.Textarea(attrs={'class': 'form-control'}))
    
    def clean_name(self):
        return sanitize_input(self.cleaned_data['name'])
    
    def clean_email(self):
        return sanitize_email(self.cleaned_data['email'])
    
    def clean_message(self):
        return sanitize_html(self.cleaned_data['message'])
```

### SQL Parameter Sanitization
```python
# Secure SQL parameter handling
def safe_query_execute(query, params):
    """Execute SQL query with proper parameter binding"""
    import sqlite3
    
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Use parameter binding - NEVER use string formatting
    cursor.execute(query, params)
    
    return cursor.fetchall()

# Usage - WRONG way
# cursor.execute(f"SELECT * FROM users WHERE name = '{user_input}'")  # VULNERABLE!

# Usage - CORRECT way
safe_query_execute("SELECT * FROM users WHERE name = ?", (user_input,))
```

---

## 8. XSS Protection

### Content Security Policy for XSS Prevention
```javascript
// Strict CSP for XSS protection
const strictCSP = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // No inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles only if necessary
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
    }
};
```

### Output Encoding
```javascript
const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

function escapeHTML(string) {
    return String(string).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
}

// Usage
const userInput = "<script>alert('XSS')</script>";
const safeOutput = escapeHTML(userInput);
console.log(safeOutput); // &lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;
```

### React XSS Protection
```javascript
import React from 'react';
import DOMPurify from 'dompurify';

const SafeHTML = ({ html }) => {
    const cleanHTML = DOMPurify.sanitize(html);
    return <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />;
};

// Automatic escaping in JSX
const UserInput = ({ input }) => {
    // React automatically escapes JSX content
    return <div>{input}</div>; // Safe by default
};

// JSON.stringify XSS prevention
const safeJSONStringify = (obj) => {
    return JSON.stringify(obj)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
};
```

### Server-side XSS Prevention
```python
from django.utils.html import escape
from django.utils.safestring import mark_safe

def safe_render(request, template_name, context):
    """Safely render template with XSS protection"""
    # Escape all user input in context
    safe_context = {}
    for key, value in context.items():
        if isinstance(value, str):
            safe_context[key] = escape(value)
        else:
            safe_context[key] = value
    
    return render(request, template_name, safe_context)

# Template tags for additional safety
from django import template

register = template.Library()

@register.filter
def escape_filter(value):
    return escape(value)

@register.filter
def safe_truncate(value, length):
    """Safely truncate with HTML escaping"""
    truncated = value[:length] + '...' if len(value) > length else value
    return escape(truncated)
```

### JavaScript XSS Prevention
```javascript
class XSSProtection {
    static sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    static sanitizeURL(url) {
        const allowedProtocols = ['http:', 'https:'];
        const urlObj = new URL(url, window.location.origin);
        
        if (!allowedProtocols.includes(urlObj.protocol)) {
            throw new Error('Invalid protocol');
        }
        return urlObj.href;
    }
    
    static escapeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }
    
    static createSafeLink(url, text) {
        try {
            const safeURL = this.sanitizeURL(url);
            const safeText = this.sanitizeString(text);
            
            return `<a href="${safeURL}">${safeText}</a>`;
        } catch (error) {
            return '';
        }
    }
}
```

---

## 9. CSRF Protection

### Express.js CSRF Protection
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());

// CSRF protection
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

// Apply CSRF protection to all state-changing routes
app.use(csrfProtection);

// Get CSRF token for forms
app.get('/form', (req, res) => {
    res.render('form', { csrfToken: req.csrfToken() });
});

// Post route with CSRF protection
app.post('/form', (req, res) => {
    // CSRF token is automatically validated
    res.send('Form submitted successfully');
});

// CSRF error handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({ error: 'Invalid CSRF token' });
    } else {
        next(err);
    }
});
```

### React CSRF Protection
```javascript
import axios from 'axios';

// Set up Axios with CSRF token
axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

// Custom hook for CSRF-protected API calls
const useCSRF = () => {
    const [csrfToken, setCsrfToken] = useState('');
    
    useEffect(() => {
        // Get CSRF token on component mount
        axios.get('/api/csrf-token')
            .then(response => {
                setCsrfToken(response.data.csrfToken);
                axios.defaults.headers.common['X-CSRF-Token'] = response.data.csrfToken;
            });
    }, []);
    
    return { csrfToken };
};

// Form component with CSRF protection
const SecureForm = () => {
    const { csrfToken } = useCSRF();
    
    const handleSubmit = (e) => {
        e.preventDefault();
        
        axios.post('/api/secure-endpoint', {
            data: formData
        }, {
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            {/* Form fields */}
        </form>
    );
};
```

### Django CSRF Protection
```python
# settings.py
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_HEADER_NAME = 'HTTP_X_CSRF_TOKEN'
CSRF_TRUSTED_ORIGINS = ['https://yourdomain.com']

# Custom CSRF middleware
class AdvancedCSRFMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Add CSRF token to response
        response = self.get_response(request)
        response['Access-Control-Allow-Origin'] = 'https://yourdomain.com'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRFToken'
        return response

# Template tag for CSRF token
{% load csrf_token %}
<form method="post">
    {% csrf_token %}
    <input type="hidden" name="csrfmiddlewaretoken" value="{% csrf_token %}">
    <!-- Form fields -->
</form>

# JavaScript for AJAX requests
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
        }
    }
});
```

### Token-based CSRF Protection
```javascript
// Custom token-based CSRF protection
class CSRFTokenManager {
    constructor() {
        this.tokens = new Map();
    }
    
    generateToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        this.tokens.set(sessionId, {
            token,
            expires: Date.now() + (60 * 60 * 1000) // 1 hour
        });
        return token;
    }
    
    validateToken(sessionId, token) {
        const tokenData = this.tokens.get(sessionId);
        if (!tokenData) return false;
        
        if (Date.now() > tokenData.expires) {
            this.tokens.delete(sessionId);
            return false;
        }
        
        return tokenData.token === token;
    }
    
    cleanup() {
        // Remove expired tokens
        const now = Date.now();
        for (const [sessionId, data] of this.tokens) {
            if (now > data.expires) {
                this.tokens.delete(sessionId);
            }
        }
    }
}

// Usage
const csrfManager = new CSRFTokenManager();

// Generate token
app.get('/api/csrf-token', (req, res) => {
    const token = csrfManager.generateToken(req.sessionID);
    res.json({ csrfToken: token });
});

// Validate token
app.post('/api/protected', (req, res) => {
    const token = req.body.csrfToken;
    if (!csrfManager.validateToken(req.sessionID, token)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    // Process request
    res.json({ success: true });
});
```

---

## 10. SQL Injection Prevention

### Parameterized Queries
```javascript
// PostgreSQL with node-postgres
const { Pool } = require('pg');
const pool = new Pool();

async function getUser(id) {
    // Using parameterized queries - SAFE
    const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND status = $2',
        [id, 'active']
    );
    return result.rows;
}

async function createUser(userData) {
    // Using parameterized queries - SAFE
    const { username, email, password } = userData;
    const result = await pool.query(
        'INSERT INTO users (username, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [username, email, password] // NEVER interpolate directly into query
    );
    return result.rows[0];
}

// Dynamic query builder with sanitization
class SafeQueryBuilder {
    constructor(table) {
        this.table = table;
        this.conditions = [];
        this.params = [];
        this.paramIndex = 1;
    }
    
    where(column, operator, value) {
        // Validate column names to prevent injection
        const validColumns = ['id', 'username', 'email', 'created_at', 'status'];
        if (!validColumns.includes(column)) {
            throw new Error(`Invalid column: ${column}`);
        }
        
        this.conditions.push(`${column} ${operator} $${this.paramIndex++}`);
        this.params.push(value);
        return this;
    }
    
    build() {
        let query = `SELECT * FROM ${this.table}`;
        if (this.conditions.length > 0) {
            query += ' WHERE ' + this.conditions.join(' AND ');
        }
        return { query, params: this.params };
    }
}

// Usage
const qb = new SafeQueryBuilder('users')
    .where('status', '=', 'active')
    .where('created_at', '>', '2023-01-01');
    
const { query, params } = qb.build();
const results = await pool.query(query, params);
```

### Python SQLAlchemy ORM
```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
engine = create_engine('postgresql://user:pass@localhost/dbname')
Session = sessionmaker(bind=engine)
session = Session()

# Safe ORM queries
def get_user_by_id(user_id):
    # ORM queries are safe by default
    return session.query(User).filter(User.id == user_id).first()

def get_users_by_status(status):
    return session.query(User).filter(User.status == status).all()

# Raw SQL with proper parameter binding
def search_users(search_term):
    query = text("""
        SELECT * FROM users 
        WHERE username ILIKE :search_term 
        OR email ILIKE :search_term
    """)
    
    # Safe parameter binding
    result = session.execute(query, {'search_term': f'%{search_term}%'})
    return result.fetchall()

# Django ORM (automatically safe)
from django.db import models

class User(models.Model):
    username = models.CharField(max_length=100)
    email = models.EmailField()
    
    @classmethod
    def get_by_id(cls, user_id):
        return cls.objects.filter(id=user_id).first()
    
    @classmethod
    def search(cls, query):
        return cls.objects.filter(
            models.Q(username__icontains=query) |
            models.Q(email__icontains=query)
        )
```

### MongoDB Injection Prevention
```javascript
const mongoose = require('mongoose');

// Define schema to enforce structure
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin', 'moderator'] }
});

const User = mongoose.model('User', userSchema);

// Safe queries
async function findUserById(id) {
    // Mongoose automatically validates and sanitizes
    return await User.findById(id);
}

async function findUsers(filter) {
    // Mongoose prevents injection through schema validation
    return await User.find(filter);
}

// Avoid raw MongoDB queries that can be vulnerable
async function unsafeFind(search) {
    const collection = mongoose.connection.collection('users');
    
    // VULNERABLE - Don't do this
    // return await collection.find({ $where: `this.username.includes('${search}')` });
    
    // SAFE - Use proper queries
    return await collection.find({ username: new RegExp(search, 'i') });
}
```

### Input Validation for SQL
```javascript
const validator = require('validator');

class SQLInputValidator {
    static validateIdentifier(identifier) {
        // Only allow alphanumeric and underscores
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
            throw new Error('Invalid identifier');
        }
        return identifier;
    }
    
    static validateNumber(value) {
        if (!validator.isInt(String(value))) {
            throw new Error('Invalid number');
        }
        return parseInt(value, 10);
    }
    
    static validateEmail(email) {
        if (!validator.isEmail(email)) {
            throw new Error('Invalid email');
        }
        return email.toLowerCase();
    }
    
    static sanitizeForLike(s) {
        return String(s).replace(/[\\%_]/g, '\\$&');
    }
}

// Safe query with validation
async function searchUsers(searchTerm, limit) {
    const sanitizedTerm = SQLInputValidator.sanitizeForLike(searchTerm);
    const validatedLimit = SQLInputValidator.validateNumber(limit);
    
    const query = `
        SELECT * FROM users 
        WHERE username LIKE $1 
        ORDER BY username 
        LIMIT $2
    `;
    
    return await pool.query(query, [`%${sanitizedTerm}%`, validatedLimit]);
}
```

---

## 11. Cryptographic Best Practices

### Secure Password Hashing
```javascript
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class SecurePasswordManager {
    static async hashPassword(password) {
        // Use bcrypt with high cost factor
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }
    
    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }
    
    static generateRandomPassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }
}

// Usage
async function createUser(username, password) {
    const passwordHash = await SecurePasswordManager.hashPassword(password);
    
    await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        [username, passwordHash]
    );
}
```

### Secure Token Generation
```javascript
const crypto = require('crypto');

class TokenManager {
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('base64url');
    }
    
    static generateJWT(payload, secret, expiresIn = '1h') {
        const jwt = require('jsonwebtoken');
        
        return jwt.sign(payload, secret, {
            algorithm: 'HS256',
            expiresIn: expiresIn,
            issuer: 'yourapp.com',
            audience: 'yourapp.com'
        });
    }
    
    static verifyJWT(token, secret) {
        const jwt = require('jsonwebtoken');
        
        try {
            return jwt.verify(token, secret, {
                algorithms: ['HS256'],
                issuer: 'yourapp.com',
                audience: 'yourapp.com'
            });
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
    
    static generateAPIKey() {
        return 'sk_' + this.generateToken(32);
    }
    
    static hashToken(token) {
        return crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
    }
}
```

### Encryption/Decryption
```javascript
const crypto = require('crypto');

class EncryptionManager {
    static getEncryptionKey() {
        // Get key from environment variable
        const key = process.env.ENCRYPTION_KEY;
        if (!key || Buffer.from(key, 'hex').length !== 32) {
            throw new Error('Invalid encryption key');
        }
        return Buffer.from(key, 'hex');
    }
    
    static encrypt(text) {
        const iv = crypto.randomBytes(16);
        const key = this.getEncryptionKey();
        const cipher = crypto.createCipher('aes-256-gcm', key);
        
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
        const { encrypted, iv, authTag } = encryptedData;
        const key = this.getEncryptionKey();
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}

// Usage
const sensitiveData = 'Secret information';
const encrypted = EncryptionManager.encrypt(sensitiveData);
const decrypted = EncryptionManager.decrypt(encrypted);
```

### Secure Session Management
```javascript
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

class SecureSessionManager {
    constructor() {
        this.redisClient = redis.createClient({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD
        });
    }
    
    configure(app) {
        app.use(session({
            store: new RedisStore({ client: this.redisClient }),
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            name: 'sessionId',
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
                path: '/'
            },
            rolling: true,
            genid: () => {
                return crypto.randomBytes(32).toString('hex');
            }
        }));
    }
    
    rotateSession(req) {
        return new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
```

### Secure File Operations
```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecureFileManager {
    static generateSecureFilename(originalName) {
        const ext = path.extname(originalName);
        const randomName = crypto.randomBytes(32).toString('hex');
        return randomName + ext;
    }
    
    static hashFile(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    
    static encryptFile(inputPath, outputPath) {
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);
        
        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);
        
        // Save key and IV securely (in production, use a proper key management system)
        fs.writeFileSync(outputPath + '.key', key.toString('hex'));
        fs.writeFileSync(outputPath + '.iv', iv.toString('hex'));
        
        input.pipe(cipher).pipe(output);
    }
    
    static async validateFileSignature(filePath, allowedTypes) {
        const buffer = fs.readFileSync(filePath);
        const signatures = {
            'image/png': '89504e47',
            'image/jpeg': 'ffd8ff',
            'image/gif': '47494638',
            'application/pdf': '25504446'
        };
        
        const signature = buffer.slice(0, 4).toString('hex');
        
        for (const [mimeType, magicNumber] of Object.entries(signatures)) {
            if (signature.startsWith(magicNumber) && allowedTypes.includes(mimeType)) {
                return true;
            }
        }
        
        return false;
    }
}
```

### Key Management
```javascript
const crypto = require('crypto');

class KeyManager {
    static generateMasterKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    static deriveKey(masterKey, salt, info) {
        // Use HKDF to derive keys
        return crypto.hkdfSync('sha256', 
            Buffer.from(masterKey, 'hex'), 
            salt, 
            Buffer.from(info), 
            32
        );
    }
    
    static generateKeyPair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        
        return { publicKey, privateKey };
    }
    
    static signData(data, privateKey) {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        sign.end();
        return sign.sign(privateKey);
    }
    
    static verifySignature(data, signature, publicKey) {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(data);
        verify.end();
        return verify.verify(publicKey, signature);
    }
}
```

---

## 12. Security Monitoring

### Real-time Security Monitoring
```javascript
const winston = require('winston');
const rateLimit = require('express-rate-limit');

class SecurityMonitor {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'security.log' }),
                new winston.transports.Console()
            ]
        });
        
        this.failedLogins = new Map();
        this.suspiciousIPs = new Set();
    }
    
    logSecurityEvent(eventType, details) {
        this.logger.warn('Security Event', {
            type: eventType,
            timestamp: new Date().toISOString(),
            ...details
        });
    }
    
    trackFailedLogin(ip, username) {
        const key = `${ip}:${username}`;
        const count = this.failedLogins.get(key) || 0;
        this.failedLogins.set(key, count + 1);
        
        if (count >= 5) {
            this.blockIP(ip, 'Multiple failed login attempts');
            this.logSecurityEvent('BRUTE_FORCE_ATTACK', {
                ip,
                username,
                attempts: count
            });
        }
    }
    
    blockIP(ip, reason) {
        this.suspiciousIPs.add(ip);
        this.logger.error('IP Blocked', {
            ip,
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    isBlockedIP(ip) {
        return this.suspiciousIPs.has(ip);
    }
    
    createMiddleware() {
        return (req, res, next) => {
            // Check if IP is blocked
            if (this.isBlockedIP(req.ip)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Log request
            this.logSecurityEvent('REQUEST', {
                ip: req.ip,
                method: req.method,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            
            next();
        };
    }
}

// Usage
const securityMonitor = new SecurityMonitor();
app.use(securityMonitor.createMiddleware());
```

### Log Analysis and Alerting
```javascript
const fs = require('fs');
const readline = require('readline');

class LogAnalyzer {
    constructor(logFilePath) {
        this.logFilePath = logFilePath;
        this.alertThresholds = {
            failedLogins: 10,
            requestsPerMinute: 100,
            errorRate: 0.1
        };
    }
    
    async analyzeLogs() {
        const fileStream = fs.createReadStream(this.logFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        const stats = {
            totalRequests: 0,
            failedLogins: 0,
            errors: 0,
            ipCounts: new Map()
        };
        
        for await (const line of rl) {
            try {
                const logEntry = JSON.parse(line);
                await this.processLogEntry(logEntry, stats);
            } catch (error) {
                console.error('Error parsing log line:', error);
            }
        }
        
        return this.generateAlerts(stats);
    }
    
    async processLogEntry(logEntry, stats) {
        stats.totalRequests++;
        
        if (logEntry.type === 'REQUEST') {
            const ip = logEntry.ip;
            stats.ipCounts.set(ip, (stats.ipCounts.get(ip) || 0) + 1);
        } else if (logEntry.type === 'SECURITY_EVENT') {
            if (logEntry.error === 'Failed login') {
                stats.failedLogins++;
            } else if (logEntry.type === 'BRUTE_FORCE_ATTACK') {
                await this.sendAlert('Brute Force Attack', logEntry);
            }
        } else if (logEntry.level === 'error') {
            stats.errors++;
        }
    }
    
    generateAlerts(stats) {
        const alerts = [];
        
        const errorRate = stats.errors / stats.totalRequests;
        if (errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'HIGH_ERROR_RATE',
                message: `Error rate is ${(errorRate * 100).toFixed(2)}%`,
                severity: 'HIGH'
            });
        }
        
        return alerts;
    }
    
    async sendAlert(alertType, details) {
        // Send to monitoring system, email, Slack, etc.
        console.log('SECURITY ALERT:', alertType, details);
        
        // Example: Send to external monitoring service
        await fetch('https://api.monitoring-service.com/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.MONITORING_API_KEY
            },
            body: JSON.stringify({
                type: alertType,
                details,
                timestamp: new Date().toISOString()
            })
        });
    }
}
```

### Security Metrics Dashboard
```javascript
class SecurityMetrics {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                blocked: 0,
                errors: 0
            },
            authentication: {
                successfulLogins: 0,
                failedLogins: 0,
                blockedAttempts: 0
            },
            threats: {
                xssAttempts: 0,
                sqlInjectionAttempts: 0,
                csrfViolations: 0,
                bruteForceAttacks: 0
            }
        };
    }
    
    increment(metric, submetric = null) {
        if (submetric) {
            this.metrics[metric][submetric]++;
        } else {
            this.metrics[metric]++;
        }
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            generatedAt: new Date().toISOString(),
            uptime: process.uptime()
        };
    }
    
    async sendToMonitoring(metrics) {
        // Send to monitoring service (e.g., Datadog, New Relic)
        console.log('Sending metrics to monitoring service:', metrics);
    }
}

// Express middleware for metrics collection
const securityMetrics = new SecurityMetrics();

const metricsMiddleware = (req, res, next) => {
    // Count all requests
    securityMetrics.increment('requests', 'total');
    
    // Track response
    res.on('finish', () => {
        if (res.statusCode >= 400) {
            securityMetrics.increment('requests', 'errors');
        }
    });
    
    next();
};

app.use(metricsMiddleware);
```

### Anomaly Detection
```javascript
class AnomalyDetector {
    constructor() {
        this.baselines = new Map();
        this.detectionRules = [
            {
                name: 'unusual_request_volume',
                threshold: 2.0, // 2x baseline
                check: (metrics) => {
                    const current = metrics.requestsPerMinute || 0;
                    const baseline = this.baselines.get('requestsPerMinute') || 0;
                    return current > baseline * 2;
                }
            },
            {
                name: 'high_error_rate',
                threshold: 0.15, // 15% error rate
                check: (metrics) => {
                    return metrics.errorRate > 0.15;
                }
            }
        ];
    }
    
    updateBaseline(metric, value) {
        const current = this.baselines.get(metric) || 0;
        const updated = current * 0.9 + value * 0.1; // Exponential moving average
        this.baselines.set(metric, updated);
    }
    
    detectAnomalies(metrics) {
        const anomalies = [];
        
        for (const rule of this.detectionRules) {
            if (rule.check(metrics)) {
                anomalies.push({
                    type: rule.name,
                    severity: this.getSeverity(rule.name),
                    timestamp: new Date().toISOString(),
                    details: metrics
                });
            }
        }
        
        return anomalies;
    }
    
    getSeverity(ruleName) {
        const severityMap = {
            'unusual_request_volume': 'MEDIUM',
            'high_error_rate': 'HIGH',
            'brute_force_attack': 'CRITICAL'
        };
        return severityMap[ruleName] || 'LOW';
    }
}
```

---

## 13. Vulnerability Scanning

### Automated Security Scanning
```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class VulnerabilityScanner {
    constructor() {
        this.scanners = {
            npm: 'npm audit --json',
            docker: 'docker run --rm -v $(pwd):/app aquasec/trivy fs /app',
            sast: 'semgrep --config=auto --json .',
            dependencies: 'safety check --json'
        };
    }
    
    async runScan(type) {
        try {
            const command = this.scanners[type];
            if (!command) {
                throw new Error(`Unknown scan type: ${type}`);
            }
            
            console.log(`Running ${type} scan...`);
            const result = await execPromise(command);
            
            return {
                type,
                status: 'success',
                findings: this.parseResults(type, result.stdout)
            };
        } catch (error) {
            return {
                type,
                status: 'error',
                error: error.message
            };
        }
    }
    
    parseResults(type, output) {
        try {
            const data = JSON.parse(output);
            
            switch (type) {
                case 'npm':
                    return data.vulnerabilities || [];
                case 'docker':
                    return data.Results || [];
                case 'sast':
                    return data.results || [];
                case 'dependencies':
                    return data || [];
                default:
                    return [];
            }
        } catch (error) {
            console.error(`Error parsing ${type} results:`, error);
            return [];
        }
    }
    
    async runAllScans() {
        const scanTypes = Object.keys(this.scanners);
        const results = [];
        
        for (const type of scanTypes) {
            const result = await this.runScan(type);
            results.push(result);
        }
        
        return results;
    }
    
    generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalScans: results.length,
                successful: results.filter(r => r.status === 'success').length,
                withFindings: results.filter(r => r.findings && r.findings.length > 0).length
            },
            details: results
        };
        
        return report;
    }
}

// Usage
const scanner = new VulnerabilityScanner();

app.get('/api/security/scan', async (req, res) => {
    const { type = 'all' } = req.query;
    
    let results;
    if (type === 'all') {
        results = await scanner.runAllScans();
    } else {
        results = [await scanner.runScan(type)];
    }
    
    const report = scanner.generateReport(results);
    
    // Store report for later review
    fs.writeFileSync(`scan-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
    
    res.json(report);
});
```

### OWASP ZAP Integration
```javascript
const axios = require('axios');

class OWASPZAPScanner {
    constructor(baseUrl = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
        this.apiKey = process.env.ZAP_API_KEY;
    }
    
    async startScan(targetUrl) {
        try {
            // Start spider scan
            await axios.get(`${this.baseUrl}/JSON/spider/action/scan/`, {
                params: {
                    url: targetUrl,
                    recurse: 'true',
                    apikey: this.apiKey
                }
            });
            
            // Wait for spider to complete
            await this.waitForSpiderToComplete();
            
            // Start active scan
            const scanResponse = await axios.get(`${this.baseUrl}/JSON/ascan/action/scan/`, {
                params: {
                    url: targetUrl,
                    recurse: 'true',
                    apikey: this.apiKey
                }
            });
            
            const scanId = scanResponse.data.scan;
            await this.waitForScanToComplete(scanId);
            
            return this.getScanResults(scanId);
        } catch (error) {
            console.error('ZAP scan error:', error);
            throw error;
        }
    }
    
    async waitForSpiderToComplete() {
        while (true) {
            const status = await this.getSpiderStatus();
            if (status >= 100) break;
            await this.sleep(5000);
        }
    }
    
    async waitForScanToComplete(scanId) {
        while (true) {
            const status = await this.getActiveScanStatus(scanId);
            if (status >= 100) break;
            await this.sleep(10000);
        }
    }
    
    async getSpiderStatus() {
        const response = await axios.get(`${this.baseUrl}/JSON/spider/view/status/`, {
            params: { apikey: this.apiKey }
        });
        return parseInt(response.data.status);
    }
    
    async getActiveScanStatus(scanId) {
        const response = await axios.get(`${this.baseUrl}/JSON/ascan/view/status/`, {
            params: { scanId, apikey: this.apiKey }
        });
        return parseInt(response.data.status);
    }
    
    async getScanResults(scanId) {
        const response = await axios.get(`${this.baseUrl}/JSON/ascan/view/results/`, {
            params: { scanId, apikey: this.apiKey }
        });
        return response.data.results;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Custom Vulnerability Checks
```javascript
class CustomVulnerabilityChecker {
    constructor() {
        this.checks = [
            {
                name: 'SQL Injection',
                check: this.checkSQLInjection,
                severity: 'HIGH'
            },
            {
                name: 'XSS Vulnerability',
                check: this.checkXSSVulnerability,
                severity: 'MEDIUM'
            },
            {
                name: 'CSRF Protection',
                check: this.checkCSRFProtection,
                severity: 'MEDIUM'
            },
            {
                name: 'HTTPS Enforcement',
                check: this.checkHTTPSEnforcement,
                severity: 'HIGH'
            }
        ];
    }
    
    async checkSSLConfiguration(domain) {
        const https = require('https');
        const { SslChecker } = require('ssl-checker');
        
        try {
            const result = await SslChecker.getServerSSLInfo(domain);
            
            return {
                name: 'SSL Configuration',
                status: result.valid,
                details: {
                    valid: result.valid,
                    validFrom: result.validFrom,
                    validTo: result.validTo,
                    issuer: result.issuer
                }
            };
        } catch (error) {
            return {
                name: 'SSL Configuration',
                status: false,
                error: error.message
            };
        }
    }
    
    async checkHTTPSEnforcement(domain) {
        try {
            const http = require('http');
            const https = require('https');
            
            // Test HTTP redirect to HTTPS
            return new Promise((resolve) => {
                const options = {
                    hostname: domain,
                    port: 80,
                    path: '/',
                    method: 'HEAD'
                };
                
                const req = http.request(options, (res) => {
                    resolve({
                        name: 'HTTPS Enforcement',
                        status: res.statusCode >= 300 && res.statusCode < 400,
                        details: `HTTP status: ${res.statusCode}, Location: ${res.headers.location}`
                    });
                });
                
                req.on('error', () => {
                    resolve({
                        name: 'HTTPS Enforcement',
                        status: false,
                        error: 'HTTP request failed'
                    });
                });
                
                req.end();
            });
        } catch (error) {
            return {
                name: 'HTTPS Enforcement',
                status: false,
                error: error.message
            };
        }
    }
    
    async checkSQLInjection(url, forms) {
        const findings = [];
        
        for (const form of forms) {
            // Test various SQL injection payloads
            const payloads = [
                "' OR '1'='1",
                "'; DROP TABLE users; --",
                "1' UNION SELECT null,username,password FROM users--"
            ];
            
            for (const payload of payloads) {
                try {
                    const formData = new URLSearchParams();
                    for (const [name, value] of Object.entries(form.fields)) {
                        formData.append(name, payload);
                    }
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        body: formData,
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    });
                    
                    const content = await response.text();
                    
                    if (this.detectSQLInjection(content)) {
                        findings.push({
                            url,
                            form: form.name || 'unnamed',
                            payload,
                            type: 'SQL Injection'
                        });
                    }
                } catch (error) {
                    // Ignore network errors
                }
            }
        }
        
        return {
            name: 'SQL Injection Check',
            status: findings.length === 0,
            findings
        };
    }
    
    detectSQLInjection(content) {
        const errorPatterns = [
            /SQL syntax.*MySQL/i,
            /ORA-\d{5}/i,
            /PostgreSQL.*ERROR/i,
            /Warning.*\Wmysqli?_\w+\(/i,
            /valid MySQL result/i,
            /MySqlClient\./i
        ];
        
        return errorPatterns.some(pattern => pattern.test(content));
    }
    
    async runAllChecks(target) {
        const results = [];
        
        for (const check of this.checks) {
            const result = await check.check(target);
            results.push(result);
        }
        
        return results;
    }
}
```

---

## 14. Penetration Testing Framework

### Test Suite Organization
```javascript
class PenetrationTestSuite {
    constructor() {
        this.testModules = {
            authentication: this.runAuthenticationTests,
            authorization: this.runAuthorizationTests,
            session: this.runSessionTests,
            inputValidation: this.runInputValidationTests,
            dataExposure: this.runDataExposureTests,
            businessLogic: this.runBusinessLogicTests
        };
    }
    
    async runAllTests(target) {
        const results = {
            timestamp: new Date().toISOString(),
            target,
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            tests: []
        };
        
        for (const [moduleName, testFunction] of Object.entries(this.testModules)) {
            const moduleResult = await testFunction.call(this, target);
            results.tests.push(moduleResult);
            results.summary.total += moduleResult.tests.length;
            results.summary.passed += moduleResult.tests.filter(t => t.status === 'PASS').length;
            results.summary.failed += moduleResult.tests.filter(t => t.status === 'FAIL').length;
            results.summary.warnings += moduleResult.tests.filter(t => t.status === 'WARN').length;
        }
        
        return results;
    }
    
    async runAuthenticationTests(target) {
        const tests = [];
        
        // Test 1: Default credentials
        tests.push(await this.testDefaultCredentials(target));
        
        // Test 2: Brute force protection
        tests.push(await this.testBruteForceProtection(target));
        
        // Test 3: Password complexity
        tests.push(await this.testPasswordComplexity(target));
        
        // Test 4: Account lockout
        tests.push(await this.testAccountLockout(target));
        
        // Test 5: Session timeout
        tests.push(await this.testSessionTimeout(target));
        
        return {
            module: 'Authentication',
            description: 'Testing authentication security',
            tests
        };
    }
    
    async testDefaultCredentials(target) {
        const commonCreds = [
            { username: 'admin', password: 'admin' },
            { username: 'admin', password: 'password' },
            { username: 'root', password: 'root' },
            { username: 'guest', password: 'guest' }
        ];
        
        for (const creds of commonCreds) {
            try {
                const response = await fetch(`${target}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(creds)
                });
                
                if (response.status === 200) {
                    return {
                        name: 'Default Credentials Check',
                        status: 'FAIL',
                        severity: 'HIGH',
                        details: `Default credentials work: ${creds.username}/${creds.password}`
                    };
                }
            } catch (error) {
                // Connection failed, test not applicable
            }
        }
        
        return {
            name: 'Default Credentials Check',
            status: 'PASS',
            severity: 'LOW',
            details: 'No default credentials found'
        };
    }
    
    async testBruteForceProtection(target) {
        const attempts = [];
        const maxAttempts = 10;
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`${target}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'testuser',
                        password: `invalid${i}`
                    })
                });
                
                attempts.push({
                    attempt: i + 1,
                    status: response.status,
                    headers: response.headers
                });
                
                // Check if rate limiting is in effect
                if (response.status === 429) {
                    return {
                        name: 'Brute Force Protection',
                        status: 'PASS',
                        severity: 'LOW',
                        details: 'Rate limiting detected after 10 attempts'
                    };
                }
                
                await this.delay(100); // Small delay between attempts
            } catch (error) {
                // Network error
            }
        }
        
        return {
            name: 'Brute Force Protection',
            status: 'FAIL',
            severity: 'HIGH',
            details: `No rate limiting detected after ${maxAttempts} attempts`
        };
    }
    
    async runAuthorizationTests(target) {
        const tests = [];
        
        tests.push(await this.testIDOR(target));
        tests.push(await this.testPrivilegeEscalation(target));
        tests.push(await this.testDirectObjectReference(target));
        
        return {
            module: 'Authorization',
            description: 'Testing authorization controls',
            tests
        };
    }
    
    async testIDOR(target) {
        // Test Insecure Direct Object Reference
        try {
            // Test accessing other users' data
            const response = await fetch(`${target}/api/user/1`, {
                headers: { 'Authorization': 'Bearer user1token' }
            });
            
            if (response.status === 200) {
                const data = await response.json();
                return {
                    name: 'IDOR (Insecure Direct Object Reference)',
                    status: 'FAIL',
                    severity: 'HIGH',
                    details: 'User can access data of other users'
                };
            }
        } catch (error) {
            // Test failed
        }
        
        return {
            name: 'IDOR Check',
            status: 'PASS',
            severity: 'LOW',
            details: 'No IDOR vulnerabilities found'
        };
    }
    
    async runInputValidationTests(target) {
        const tests = [];
        
        tests.push(await this.testXSS(target));
        tests.push(await this.testSQLInjection(target));
        tests.push(await this.testCommandInjection(target));
        tests.push(await this.testPathTraversal(target));
        
        return {
            module: 'Input Validation',
            description: 'Testing input validation and sanitization',
            tests
        };
    }
    
    async testXSS(target) {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src=x onerror=alert("XSS")>',
            '"><script>alert("XSS")</script>'
        ];
        
        for (const payload of xssPayloads) {
            try {
                const response = await fetch(`${target}/api/search?q=${encodeURIComponent(payload)}`);
                const content = await response.text();
                
                if (content.includes(payload) && content.includes('<script>')) {
                    return {
                        name: 'Cross-Site Scripting (XSS)',
                        status: 'FAIL',
                        severity: 'HIGH',
                        details: `XSS payload executed: ${payload}`
                    };
                }
            } catch (error) {
                // Network error
            }
        }
        
        return {
            name: 'XSS Check',
            status: 'PASS',
            severity: 'LOW',
            details: 'No reflected XSS vulnerabilities found'
        };
    }
    
    async testSQLInjection(target) {
        const sqlPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1' UNION SELECT * FROM users--"
        ];
        
        for (const payload of sqlPayloads) {
            try {
                const response = await fetch(`${target}/api/search?q=${encodeURIComponent(payload)}`);
                const content = await response.text();
                
                if (this.detectSQLError(content)) {
                    return {
                        name: 'SQL Injection',
                        status: 'FAIL',
                        severity: 'HIGH',
                        details: `SQL injection vulnerability: ${payload}`
                    };
                }
            } catch (error) {
                // Network error
            }
        }
        
        return {
            name: 'SQL Injection Check',
            status: 'PASS',
            severity: 'LOW',
            details: 'No SQL injection vulnerabilities found'
        };
    }
    
    detectSQLError(content) {
        const patterns = [
            /SQL syntax.*MySQL/i,
            /ORA-\d{5}/i,
            /PostgreSQL.*ERROR/i,
            /Warning.*\Wmysqli/i
        ];
        return patterns.some(pattern => pattern.test(content));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const pentest = new PenetrationTestSuite();

app.get('/api/pentest/:target', async (req, res) => {
    const { target } = req.params;
    
    try {
        const results = await pentest.runAllTests(target);
        
        // Store results
        const filename = `pentest-report-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Penetration test failed', details: error.message });
    }
});
```

### Automated Test Runner
```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Run Security Tests
      run: |
        npm test
        node tests/penetration-tests.js
        npm audit
        
    - name: Dependency Check
      run: |
        docker run --rm -v $(pwd):/app owasp/dependency-check --project "MyApp" --scan /app
        
    - name: SAST Scan
      run: |
        semgrep --config=auto --json --output=semgrep-report.json .
        
    - name: Upload Security Reports
      uses: actions/upload-artifact@v2
      with:
        name: security-reports
        path: |
          pentest-report-*.json
          semgrep-report.json
          dependency-check-report.html
```

### Continuous Security Testing
```javascript
class ContinuousSecurityTesting {
    constructor() {
        this.scheduler = require('node-cron');
    }
    
    scheduleSecurityTests() {
        // Run security tests daily
        this.scheduler.schedule('0 2 * * *', async () => {
            console.log('Running scheduled security tests...');
            await this.runFullSecuritySuite();
        });
        
        // Run quick tests every 6 hours
        this.scheduler.schedule('0 */6 * * *', async () => {
            console.log('Running quick security tests...');
            await this.runQuickSecurityTests();
        });
    }
    
    async runFullSecuritySuite() {
        const pentest = new PenetrationTestSuite();
        const results = await pentest.runAllTests(process.env.TEST_TARGET);
        
        // Send results to reporting system
        await this.sendResults(results);
        
        // Check for critical issues
        const criticalIssues = results.tests
            .filter(test => test.status === 'FAIL' && test.severity === 'HIGH');
        
        if (criticalIssues.length > 0) {
            await this.sendAlert('Critical security issues found', criticalIssues);
        }
    }
    
    async runQuickSecurityTests() {
        // Quick checks only
        const checks = [
            'HTTPS enforcement',
            'Security headers',
            'Rate limiting'
        ];
        
        console.log('Quick security checks completed');
    }
    
    async sendResults(results) {
        // Integrate with your monitoring/alerting system
        console.log('Security test results:', results);
    }
    
    async sendAlert(message, details) {
        // Send alert via email, Slack, etc.
        console.log('SECURITY ALERT:', message, details);
    }
}
```

---

## Security Checklist

### Pre-Production Checklist
- [ ] HTTPS enforced with proper certificates
- [ ] Security headers implemented
- [ ] Input validation and sanitization
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] SQL injection prevention
- [ ] XSS protection implemented
- [ ] Password hashing with bcrypt (cost >= 12)
- [ ] Secure session management
- [ ] Security monitoring enabled
- [ ] Vulnerability scans completed
- [ ] Penetration testing conducted
- [ ] Security logging configured
- [ ] Error handling prevents information disclosure

### Regular Maintenance Tasks
- [ ] Weekly security log review
- [ ] Monthly vulnerability scans
- [ ] Quarterly penetration testing
- [ ] Annual security audit
- [ ] Update dependencies regularly
- [ ] Rotate API keys and secrets
- [ ] Review and update CSP
- [ ] Monitor security metrics
- [ ] Test incident response procedures
- [ ] Review access controls

### Deployment Security
- [ ] Use environment variables for secrets
- [ ] Enable security headers in production
- [ ] Configure proper CORS settings
- [ ] Set up monitoring and alerting
- [ ] Enable audit logging
- [ ] Use secure random number generation
- [ ] Implement proper error handling
- [ ] Set up backup and recovery procedures
- [ ] Enable resource limits
- [ ] Use least privilege principle

---

## Implementation Priority

### High Priority (Implement First)
1. HTTPS enforcement
2. Security headers
3. Input validation and sanitization
4. SQL injection prevention
5. Password hashing
6. Rate limiting

### Medium Priority
7. CSRF protection
8. XSS protection
9. Session security
10. Security monitoring
11. Error handling

### Low Priority (Advanced)
12. Certificate pinning
13. CSP with nonces
14. Advanced monitoring
15. Automated security testing
16. Penetration testing framework

---

## Security Incident Response Plan

### Detection
- Monitor security logs
- Set up alerting for suspicious activity
- Use automated security tools
- Regular security assessments

### Response Steps
1. **Immediate Response**
   - Identify the affected systems
   - Isolate compromised systems
   - Preserve evidence

2. **Investigation**
   - Analyze logs and evidence
   - Determine scope of breach
   - Identify root cause

3. **Containment**
   - Block attack vectors
   - Update security controls
   - Monitor for continued activity

4. **Recovery**
   - Restore from clean backups
   - Update affected systems
   - Verify security controls

5. **Lessons Learned**
   - Document the incident
   - Update security procedures
   - Provide additional training

---

This security hardening guide provides comprehensive protection against common web application vulnerabilities. Implement these measures in order of priority, and regularly review and update your security controls as new threats emerge.
