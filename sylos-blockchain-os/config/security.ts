// Security configuration for Xorb Blockchain OS
export interface SecurityConfig {
  // Content Security Policy
  csp: {
    enabled: boolean
    reportOnly: boolean
    reportUri: string
    directives: Record<string, string[]>
  }
  
  // Headers configuration
  headers: {
    xFrameOptions: string
    xContentTypeOptions: string
    xXSSProtection: string
    strictTransportSecurity: string
    referrerPolicy: string
    permissionsPolicy: string
  }
  
  // Rate limiting
  rateLimit: {
    windowMs: number
    max: number
    message: string
    standardHeaders: boolean
    legacyHeaders: boolean
  }
  
  // CORS configuration
  cors: {
    origin: string | string[] | boolean
    methods: string[]
    allowedHeaders: string[]
    exposedHeaders: string[]
    credentials: boolean
    maxAge: number
  }
  
  // Authentication
  auth: {
    jwtSecret: string
    jwtExpiresIn: string
    refreshTokenExpiresIn: string
    bcryptRounds: number
  }
  
  // Encryption
  encryption: {
    algorithm: string
    keyLength: number
    ivLength: number
  }
}

export const securityConfig: SecurityConfig = {
  // Content Security Policy
  csp: {
    enabled: process.env.NODE_ENV === 'production',
    reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    reportUri: process.env.CSP_REPORT_URI || '/api/csp-report',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'wasm-unsafe-eval'",
        ...(process.env.NODE_ENV === 'development' 
          ? ["'unsafe-inline'", "'unsafe-eval'"] 
          : []
        ),
        process.env.CDN_URL || 'https://cdn.xorb.io'
      ].filter(Boolean),
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https:'
      ],
      connectSrc: [
        "'self'",
        process.env.VITE_RPC_URL || 'https://polygon-rpc.com',
        process.env.VITE_API_URL || 'https://api.xorb.io',
        ...(process.env.NODE_ENV === 'development' 
          ? ['ws://localhost:*', 'http://localhost:*'] 
          : []
        )
      ].filter(Boolean),
      frameSrc: process.env.NODE_ENV === 'development' ? ["'self'"] : ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(process.env.NODE_ENV === 'production' ? {
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      } : {})
    }
  },
  
  // Security Headers
  headers: {
    xFrameOptions: process.env.NODE_ENV === 'production' 
      ? 'DENY' 
      : 'SAMEORIGIN',
    xContentTypeOptions: 'nosniff',
    xXSSProtection: '1; mode=block',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'xr-spatial-tracking=()'
    ].join(', ')
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // disable the `X-RateLimit-*` headers
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [
          'https://xorb.io',
          'https://app.xorb.io',
          'https://www.xorb.io'
        ]
      : true, // allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Limit', 'X-Rate-Limit-Remaining'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: '7d',
    refreshTokenExpiresIn: '30d',
    bcryptRounds: 12
  },
  
  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  }
}

// Security middleware configuration
export const securityMiddleware = {
  // Helmet.js configuration
  helmet: {
    contentSecurityPolicy: securityConfig.csp.enabled ? {
      directives: securityConfig.csp.directives,
      reportOnly: securityConfig.csp.reportOnly
    } : false,
    frameguard: {
      action: securityConfig.headers.xFrameOptions.toLowerCase() === 'deny' ? 'deny' : 'sameorigin'
    },
    xssFilter: true,
    noSniff: true,
    hsts: securityConfig.headers.strictTransportSecurity ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    referrerPolicy: {
      policy: securityConfig.headers.referrerPolicy
    },
    noSniff: {
      nosniff: true
    }
  }
}

export default securityConfig