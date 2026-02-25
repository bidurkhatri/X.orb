# SylOS API Documentation Package
## Comprehensive Developer Resources & API Reference

**Version:** 1.0.0  
**Last Updated:** November 10, 2025  
**License:** MIT

---

## 📑 Table of Contents

1. [REST API Documentation](#1-rest-api-documentation)
2. [GraphQL Schema Documentation](#2-graphql-schema-documentation)
3. [WebSocket API Documentation](#3-websocket-api-documentation)
4. [Smart Contract API Reference](#4-smart-contract-api-reference)
5. [SDK Documentation](#5-sdk-documentation)
6. [Integration Guides](#6-integration-guides)
7. [Code Examples & Best Practices](#7-code-examples--best-practices)
8. [Postman Collection](#8-postman-collection)
9. [Developer Onboarding Guide](#9-developer-onboarding-guide)
10. [Changelog & Versioning Strategy](#10-changelog--versioning-strategy)

---

## 1. REST API Documentation

### 1.1 OpenAPI/Swagger Specification

```yaml
openapi: 3.0.3
info:
  title: SylOS Blockchain Operating System API
  description: |
    Comprehensive API for the SylOS blockchain operating system providing access to 
    wallet operations, productivity tracking, file management, token dashboards, and system configuration.
    
    ## Features
    - Multi-wallet support (MetaMask, WalletConnect, Coinbase)
    - Real-time productivity tracking (PoP)
    - IPFS file management
    - Token portfolio management
    - Gasless transaction support
    - Cross-platform synchronization
    
    ## Authentication
    API uses JWT Bearer token authentication. Obtain tokens through OAuth2 flow or API key generation.
    
    ## Rate Limits
    - Authentication endpoints: 10 requests/minute
    - General API: 100 requests/minute
    - File upload: 5 requests/minute
    
    ## Base URL
    - Production: `https://api.sylos.io/v1`
    - Staging: `https://staging-api.sylos.io/v1`
    - Development: `http://localhost:3000/api/v1`
    
  version: 1.0.0
  contact:
    name: SylOS API Support
    email: dev@sylos.io
    url: https://docs.sylos.io
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.sylos.io/v1
    description: Production Server
  - url: https://staging-api.sylos.io/v1
    description: Staging Server
  - url: http://localhost:3000/api/v1
    description: Development Server

security:
  - BearerAuth: []

paths:
  # Authentication Endpoints
  /auth/login:
    post:
      tags:
        - Authentication
      summary: User login
      description: Authenticate user and receive JWT token
      operationId: loginUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
              properties:
                email:
                  type: string
                  format: email
                  description: User email address
                  example: user@example.com
                password:
                  type: string
                  format: password
                  description: User password
                  example: "securePassword123"
                walletAddress:
                  type: string
                  description: Optional blockchain wallet address
                  example: "0x1234567890123456789012345678901234567890"
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      token:
                        type: string
                        description: JWT authentication token
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      refreshToken:
                        type: string
                        description: Refresh token for token renewal
                      user:
                        $ref: '#/components/schemas/User'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /auth/refresh:
    post:
      tags:
        - Authentication
      summary: Refresh JWT token
      description: Obtain new JWT token using refresh token
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - refreshToken
              properties:
                refreshToken:
                  type: string
                  description: Valid refresh token
      responses:
        '200':
          description: Token refreshed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      token:
                        type: string
                      refreshToken:
                        type: string
        '401':
          $ref: '#/components/responses/Unauthorized'

  # Wallet Endpoints
  /wallets:
    get:
      tags:
        - Wallets
      summary: Get user wallets
      description: Retrieve all wallets associated with the authenticated user
      operationId: getUserWallets
      parameters:
        - name: network
          in: query
          description: Blockchain network filter
          schema:
            type: string
            enum: [ethereum, polygon, bsc, all]
            default: all
      responses:
        '200':
          description: Wallets retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Wallet'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags:
        - Wallets
      summary: Create new wallet
      description: Create a new blockchain wallet for the user
      operationId: createWallet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - network
                - walletType
              properties:
                network:
                  type: string
                  enum: [ethereum, polygon, bsc]
                  description: Blockchain network
                walletType:
                  type: string
                  enum: [metamask, walletconnect, coinbase, generated]
                  description: Wallet type
                name:
                  type: string
                  description: Custom wallet name
                  example: "Main Trading Wallet"
      responses:
        '201':
          description: Wallet created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/Wallet'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /wallets/{walletId}/balances:
    get:
      tags:
        - Wallets
      summary: Get wallet balances
      description: Retrieve token balances for a specific wallet
      operationId: getWalletBalances
      parameters:
        - name: walletId
          in: path
          required: true
          description: Wallet identifier
          schema:
            type: string
            format: uuid
        - name: tokens
          in: query
          description: Comma-separated list of token addresses to fetch
          schema:
            type: string
            example: "0x123...,0x456..."
      responses:
        '200':
          description: Balances retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Balance'
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /wallets/{walletId}/transactions:
    get:
      tags:
        - Wallets
      summary: Get wallet transaction history
      description: Retrieve transaction history for a specific wallet
      operationId: getWalletTransactions
      parameters:
        - name: walletId
          in: path
          required: true
          description: Wallet identifier
          schema:
            type: string
            format: uuid
        - name: limit
          in: query
          description: Number of transactions to return
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          description: Number of transactions to skip
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: type
          in: query
          description: Transaction type filter
          schema:
            type: string
            enum: [all, send, receive, contract, swap]
            default: all
      responses:
        '200':
          description: Transactions retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      transactions:
                        type: array
                        items:
                          $ref: '#/components/schemas/Transaction'
                      pagination:
                        $ref: '#/components/schemas/Pagination'
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /wallets/{walletId}/send:
    post:
      tags:
        - Wallets
      summary: Send transaction
      description: Send cryptocurrency or tokens from wallet
      operationId: sendTransaction
      parameters:
        - name: walletId
          in: path
          required: true
          description: Wallet identifier
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - to
                - amount
                - tokenAddress
              properties:
                to:
                  type: string
                  description: Recipient address
                  example: "0x1234567890123456789012345678901234567890"
                amount:
                  type: string
                  description: Amount to send
                  example: "1.5"
                tokenAddress:
                  type: string
                  description: Token contract address (use 'native' for native currency)
                  example: "native"
                gasPrice:
                  type: string
                  description: Custom gas price (optional)
                gasLimit:
                  type: string
                  description: Custom gas limit (optional)
                memo:
                  type: string
                  description: Transaction memo/description
      responses:
        '200':
          description: Transaction sent successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      transactionHash:
                        type: string
                        description: Blockchain transaction hash
                      status:
                        type: string
                        enum: [pending, confirmed, failed]
                        example: "pending"
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  # PoP Tracker Endpoints
  /pop/tasks:
    get:
      tags:
        - PoP Tracker
      summary: Get productivity tasks
      description: Retrieve productivity tracking tasks for the user
      operationId: getPoPTasks
      parameters:
        - name: status
          in: query
          description: Task status filter
          schema:
            type: string
            enum: [all, pending, completed, verified, rejected]
            default: all
        - name: timeframe
          in: query
          description: Time period filter
          schema:
            type: string
            enum: [all, today, week, month]
            default: all
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Tasks retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      tasks:
                        type: array
                        items:
                          $ref: '#/components/schemas/PoPTask'
                      stats:
                        $ref: '#/components/schemas/PoPStats'
                      pagination:
                        $ref: '#/components/schemas/Pagination'

    post:
      tags:
        - PoP Tracker
      summary: Create new productivity task
      description: Create a new task for productivity tracking
      operationId: createPoPTask
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - title
                - description
                - estimatedHours
                - complexity
              properties:
                title:
                  type: string
                  description: Task title
                  example: "Complete frontend component"
                description:
                  type: string
                  description: Detailed task description
                  example: "Develop responsive header component with TypeScript and Tailwind"
                estimatedHours:
                  type: number
                  description: Estimated hours to complete
                  example: 8
                complexity:
                  type: integer
                  description: Complexity level (1-10)
                  example: 5
                category:
                  type: string
                  enum: [development, design, research, documentation, testing, other]
                  description: Task category
                tags:
                  type: array
                  items:
                    type: string
                  description: Task tags
      responses:
        '201':
          description: Task created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/PoPTask'

  /pop/tasks/{taskId}/complete:
    post:
      tags:
        - PoP Tracker
      summary: Complete task
      description: Mark a task as completed with actual metrics
      operationId: completePoPTask
      parameters:
        - name: taskId
          in: path
          required: true
          description: Task identifier
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - actualHours
                - qualityScore
                - deliverableHash
              properties:
                actualHours:
                  type: number
                  description: Actual hours spent on task
                  example: 6.5
                qualityScore:
                  type: integer
                  description: Quality score (1-10)
                  example: 8
                deliverableHash:
                  type: string
                  description: IPFS hash of deliverable
                  example: "QmTkzDwWqPbnAh5YiVofV5BJ7KWwUHAHf9MFWYLFxCaAhF"
                notes:
                  type: string
                  description: Additional completion notes
                timeSpent:
                  type: array
                  items:
                    $ref: '#/components/schemas/TimeEntry'
                  description: Detailed time entries
      responses:
        '200':
          description: Task completed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/PoPTask'

  /pop/analytics:
    get:
      tags:
        - PoP Tracker
      summary: Get productivity analytics
      description: Retrieve comprehensive productivity analytics and metrics
      operationId: getPoPAnalytics
      parameters:
        - name: period
          in: query
          description: Analytics period
          schema:
            type: string
            enum: [week, month, quarter, year]
            default: month
        - name: metrics
          in: query
          description: Specific metrics to include
          schema:
            type: array
            items:
              type: string
              enum: [productivity_score, time_efficiency, quality_score, completion_rate, peer_validation]
        - name: groupBy
          in: query
          description: Group results by
          schema:
            type: string
            enum: [day, week, month, category]
      responses:
        '200':
          description: Analytics retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/PoPAnalytics'

  # File Management Endpoints
  /files:
    get:
      tags:
        - File Management
      summary: List user files
      description: Retrieve user's files from IPFS storage
      operationId: listFiles
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: type
          in: query
          description: File type filter
          schema:
            type: string
            enum: [all, document, image, video, audio, archive, other]
        - name: sort
          in: query
          description: Sort order
          schema:
            type: string
            enum: [name, size, date, type]
            default: date
      responses:
        '200':
          description: Files retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      files:
                        type: array
                        items:
                          $ref: '#/components/schemas/IPFSFile'
                      storage:
                        $ref: '#/components/schemas/StorageInfo'
                      pagination:
                        $ref: '#/components/schemas/Pagination'

    post:
      tags:
        - File Management
      summary: Upload file to IPFS
      description: Upload a file to IPFS decentralized storage
      operationId: uploadFile
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
                - file
              properties:
                file:
                  type: string
                  format: binary
                  description: File to upload
                title:
                  type: string
                  description: File title
                description:
                  type: string
                  description: File description
                tags:
                  type: string
                  description: Comma-separated tags
                isPublic:
                  type: boolean
                  description: Whether file is publicly accessible
                  default: false
      responses:
        '201':
          description: File uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/IPFSFile'

  /files/{fileId}:
    get:
      tags:
        - File Management
      summary: Get file details
      description: Retrieve detailed information about a specific file
      operationId: getFile
      parameters:
        - name: fileId
          in: path
          required: true
          description: File identifier
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: File details retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/IPFSFile'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      tags:
        - File Management
      summary: Delete file
      description: Delete a file from IPFS storage
      operationId: deleteFile
      parameters:
        - name: fileId
          in: path
          required: true
          description: File identifier
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: File deleted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /files/{fileId}/download:
    get:
      tags:
        - File Management
      summary: Download file
      description: Download a file from IPFS
      operationId: downloadFile
      parameters:
        - name: fileId
          in: path
          required: true
          description: File identifier
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: File downloaded successfully
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary
        '404':
          $ref: '#/components/responses/NotFound'
        '403':
          $ref: '#/components/responses/Forbidden'

  # Token Dashboard Endpoints
  /tokens/portfolio:
    get:
      tags:
        - Token Dashboard
      summary: Get portfolio overview
      description: Retrieve comprehensive token portfolio information
      operationId: getPortfolio
      parameters:
        - name: currency
          in: query
          description: Display currency
          schema:
            type: string
            enum: [USD, EUR, BTC, ETH]
            default: USD
        - name: includeHistory
          in: query
          description: Include historical data
          schema:
            type: boolean
            default: false
      responses:
        '200':
          description: Portfolio retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/Portfolio'

  /tokens/portfolio/stake:
    post:
      tags:
        - Token Dashboard
      summary: Stake tokens
      description: Stake tokens for rewards
      operationId: stakeTokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - tokenAddress
                - amount
                - lockDuration
              properties:
                tokenAddress:
                  type: string
                  description: Token contract address
                amount:
                  type: string
                  description: Amount to stake
                lockDuration:
                  type: integer
                  description: Lock duration in days
                  example: 365
      responses:
        '200':
          description: Tokens staked successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/StakingPosition'

  /tokens/portfolio/unstake:
    post:
      tags:
        - Token Dashboard
      summary: Unstake tokens
      description: Unstake previously staked tokens
      operationId: unstakeTokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - stakingPositionId
                - amount
              properties:
                stakingPositionId:
                  type: string
                  description: Staking position identifier
                amount:
                  type: string
                  description: Amount to unstake
      responses:
        '200':
          description: Tokens unstaked successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/UnstakeResult'

  # System Endpoints
  /system/health:
    get:
      tags:
        - System
      summary: System health check
      description: Check API server health and status
      operationId: healthCheck
      responses:
        '200':
          description: System is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "healthy"
                  timestamp:
                    type: string
                    format: date-time
                  version:
                    type: string
                    example: "1.0.0"
                  services:
                    type: object
                    properties:
                      database:
                        type: string
                        example: "healthy"
                      blockchain:
                        type: string
                        example: "healthy"
                      ipfs:
                        type: string
                        example: "healthy"

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        username:
          type: string
        walletAddress:
          type: string
        createdAt:
          type: string
          format: date-time
        profile:
          $ref: '#/components/schemas/UserProfile'

    UserProfile:
      type: object
      properties:
        displayName:
          type: string
        avatar:
          type: string
        bio:
          type: string
        preferences:
          $ref: '#/components/schemas/UserPreferences'

    UserPreferences:
      type: object
      properties:
        theme:
          type: string
          enum: [light, dark, auto]
        currency:
          type: string
        language:
          type: string
        notifications:
          $ref: '#/components/schemas/NotificationPreferences'

    NotificationPreferences:
      type: object
      properties:
        email:
          type: boolean
        push:
          type: boolean
        sms:
          type: boolean
        transactions:
          type: boolean
        productivity:
          type: boolean

    Wallet:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        address:
          type: string
        network:
          type: string
          enum: [ethereum, polygon, bsc]
        walletType:
          type: string
          enum: [metamask, walletconnect, coinbase, generated]
        isActive:
          type: boolean
        createdAt:
          type: string
          format: date-time
        balanceUSD:
          type: number

    Balance:
      type: object
      properties:
        tokenAddress:
          type: string
        symbol:
          type: string
        decimals:
          type: integer
        balance:
          type: string
        balanceFormatted:
          type: string
        usdValue:
          type: number
        price:
          type: number
        change24h:
          type: number

    Transaction:
      type: object
      properties:
        id:
          type: string
          format: uuid
        hash:
          type: string
        from:
          type: string
        to:
          type: string
        value:
          type: string
        gasUsed:
          type: string
        gasPrice:
          type: string
        blockNumber:
          type: integer
        status:
          type: string
          enum: [pending, confirmed, failed]
        timestamp:
          type: string
          format: date-time
        type:
          type: string
          enum: [send, receive, contract, swap]
        token:
          $ref: '#/components/schemas/TokenInfo'

    TokenInfo:
      type: object
      properties:
        address:
          type: string
        symbol:
          type: string
        name:
          type: string
        decimals:
          type: integer
        logoURI:
          type: string

    PoPTask:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        description:
          type: string
        status:
          type: string
          enum: [pending, completed, verified, rejected]
        createdAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time
        estimatedHours:
          type: number
        actualHours:
          type: number
        qualityScore:
          type: integer
        productivityScore:
          type: number
        category:
          type: string
        tags:
          type: array
          items:
            type: string
        deliverables:
          type: array
          items:
            $ref: '#/components/schemas/Deliverable'

    Deliverable:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
        hash:
          type: string
        url:
          type: string
        createdAt:
          type: string
          format: date-time

    TimeEntry:
      type: object
      properties:
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        duration:
          type: number
        description:
          type: string

    PoPStats:
      type: object
      properties:
        totalTasks:
          type: integer
        completedTasks:
          type: integer
        totalHours:
          type: number
        averageQualityScore:
          type: number
        productivityScore:
          type: number
        peerValidations:
          type: integer
        rewardsEarned:
          type: string

    PoPAnalytics:
      type: object
      properties:
        period:
          type: string
        totalProductivity:
          type: number
        timeEfficiency:
          type: number
        qualityMetrics:
          type: array
          items:
            type: object
        categoryBreakdown:
          type: array
          items:
            type: object
        dailyActivity:
          type: array
          items:
            type: object
        peerValidationRate:
          type: number
        rewardProjection:
          type: number

    IPFSFile:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        cid:
          type: string
        size:
          type: integer
        type:
          type: string
        mimeType:
          type: string
        uploadedAt:
          type: string
          format: date-time
        isPublic:
          type: boolean
        tags:
          type: array
          items:
            type: string
        url:
          type: string
        downloadUrl:
          type: string

    StorageInfo:
      type: object
      properties:
        used:
          type: integer
        quota:
          type: integer
        usedPercentage:
          type: number
        available:
          type: integer

    Portfolio:
      type: object
      properties:
        totalValueUSD:
          type: number
        totalValueChange24h:
          type: number
        totalValueChangePercentage24h:
          type: number
        tokens:
          type: array
          items:
            $ref: '#/components/schemas/PortfolioToken'
        staking:
          type: array
          items:
            $ref: '#/components/schemas/StakingPosition'
        history:
          type: array
          items:
            type: object

    PortfolioToken:
      type: object
      properties:
        token:
          $ref: '#/components/schemas/TokenInfo'
        balance:
          type: string
        valueUSD:
          type: number
        price:
          type: number
        change24h:
          type: number
        changePercentage24h:
          type: number

    StakingPosition:
      type: object
      properties:
        id:
          type: string
          format: uuid
        token:
          $ref: '#/components/schemas/TokenInfo'
        amount:
          type: string
        valueUSD:
          type: number
        apy:
          type: number
        rewards:
          type: array
          items:
            $ref: '#/components/schemas/Reward'
        lockEndDate:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time

    Reward:
      type: object
      properties:
        token:
          $ref: '#/components/schemas/TokenInfo'
        amount:
          type: string
        valueUSD:
          type: number
        claimable:
          type: boolean
        claimedAt:
          type: string
          format: date-time

    UnstakeResult:
      type: object
      properties:
        success:
          type: boolean
        amount:
          type: string
        fees:
          type: string
        estimatedTime:
          type: string
        transactionHash:
          type: string

    Pagination:
      type: object
      properties:
        limit:
          type: integer
        offset:
          type: integer
        total:
          type: integer
        hasNext:
          type: boolean
        hasPrev:
          type: boolean

  responses:
    BadRequest:
      description: Bad request - invalid parameters
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "VALIDATION_ERROR"
                  message:
                    type: string
                    example: "Invalid request parameters"
                  details:
                    type: array
                    items:
                      type: object

    Unauthorized:
      description: Unauthorized - invalid or missing authentication
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "UNAUTHORIZED"
                  message:
                    type: string
                    example: "Invalid authentication token"

    Forbidden:
      description: Forbidden - insufficient permissions
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "FORBIDDEN"
                  message:
                    type: string
                    example: "Insufficient permissions"

    NotFound:
      description: Not found - resource does not exist
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "NOT_FOUND"
                  message:
                    type: string
                    example: "Resource not found"

    TooManyRequests:
      description: Too many requests - rate limit exceeded
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "RATE_LIMIT_EXCEEDED"
                  message:
                    type: string
                    example: "Too many requests. Please try again later."

    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: "INTERNAL_ERROR"
                  message:
                    type: string
                    example: "An internal server error occurred"
```

---

## 2. GraphQL Schema Documentation

### 2.1 Schema Definition

```graphql
# SylOS GraphQL API Schema
# Version 1.0.0

scalar DateTime
scalar JSON
scalar URL

type Query {
  # User queries
  me: User
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
  
  # Wallet queries
  wallet(id: ID!): Wallet
  wallets(filter: WalletFilter, pagination: PaginationInput): WalletConnection!
  walletBalances(walletId: ID!, tokenAddresses: [String!]): [Balance!]!
  walletTransactions(walletId: ID!, filter: TransactionFilter, pagination: PaginationInput): TransactionConnection!
  
  # PoP Tracker queries
  popTask(id: ID!): PoPTask
  popTasks(filter: PoPTaskFilter, pagination: PaginationInput): PoPTaskConnection!
  popAnalytics(period: AnalyticsPeriod!, metrics: [String!], groupBy: GroupBy): PoPAnalytics!
  popUserStats(userId: ID): PoPUserStats!
  
  # File Management queries
  ipfsFile(id: ID!): IPFSFile
  ipfsFiles(filter: IPFSFileFilter, pagination: PaginationInput): IPFSFileConnection!
  ipfsFileContent(cid: String!): IPFSFileContent!
  storageInfo: StorageInfo!
  
  # Token Portfolio queries
  portfolio(userId: ID, currency: Currency = USD, includeHistory: Boolean = false): Portfolio!
  tokenPrice(tokenAddress: String!, currency: Currency = USD): TokenPrice!
  stakingPositions(userId: ID): [StakingPosition!]!
  rewards(userId: ID, claimableOnly: Boolean = false): [Reward!]!
  
  # System queries
  systemStatus: SystemStatus!
  supportedNetworks: [Network!]!
  supportedTokens: [Token!]!
}

type Mutation {
  # Authentication mutations
  login(input: LoginInput!): AuthPayload!
  logout: Boolean!
  refreshToken: AuthPayload!
  register(input: RegisterInput!): AuthPayload!
  
  # Wallet mutations
  createWallet(input: CreateWalletInput!): Wallet!
  deleteWallet(id: ID!): Boolean!
  sendTransaction(input: SendTransactionInput!): TransactionResult!
  
  # PoP Tracker mutations
  createPoPTask(input: CreatePoPTaskInput!): PoPTask!
  updatePoPTask(id: ID!, input: UpdatePoPTaskInput!): PoPTask!
  completePoPTask(id: ID!, input: CompletePoPTaskInput!): PoPTask!
  validatePoPTask(id: ID!, input: ValidationInput!): PoPTask!
  recordTimeEntry(taskId: ID!, input: TimeEntryInput!): PoPTask!
  
  # File Management mutations
  uploadFile(input: UploadFileInput!): IPFSFile!
  deleteFile(id: ID!): Boolean!
  updateFile(id: ID!, input: UpdateFileInput!): IPFSFile!
  
  # Portfolio mutations
  stakeTokens(input: StakeTokensInput!): StakingResult!
  unstakeTokens(input: UnstakeTokensInput!): UnstakeResult!
  claimRewards(input: ClaimRewardsInput!): ClaimResult!
  swapTokens(input: SwapTokensInput!): SwapResult!
}

type Subscription {
  # Real-time updates
  walletUpdates(walletId: ID!): Wallet!
  transactionUpdates(walletId: ID!): Transaction!
  popTaskUpdates(userId: ID!): PoPTask!
  portfolioUpdates(userId: ID!): Portfolio!
  systemNotifications: SystemNotification!
}

# Type definitions
type User {
  id: ID!
  email: String!
  username: String
  walletAddress: String
  createdAt: DateTime!
  profile: UserProfile
  preferences: UserPreferences
  totalProductivityScore: Float!
  totalTasks: Int!
  totalRewardsEarned: String!
  isVerified: Boolean!
  lastLoginAt: DateTime
}

type UserProfile {
  displayName: String
  avatar: URL
  bio: String
  website: URL
  socialLinks: JSON
}

type UserPreferences {
  theme: Theme!
  currency: Currency!
  language: String!
  timezone: String!
  notifications: NotificationPreferences!
}

type NotificationPreferences {
  email: Boolean!
  push: Boolean!
  transactions: Boolean!
  productivity: Boolean!
  system: Boolean!
}

enum Theme {
  LIGHT
  DARK
  AUTO
}

enum Currency {
  USD
  EUR
  BTC
  ETH
}

type Wallet {
  id: ID!
  name: String!
  address: String!
  network: Network!
  walletType: WalletType!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  balanceUSD: Float!
  transactions: TransactionConnection!
  tokens: [Balance!]!
  isHardwareWallet: Boolean!
  derivationPath: String
}

enum WalletType {
  METAMASK
  WALLETCONNECT
  COINBASE
  GENERATED
  HARDWARE
}

enum Network {
  ETHEREUM
  POLYGON
  BSC
  ARBITRUM
  OPTIMISM
}

type Balance {
  tokenAddress: String!
  symbol: String!
  name: String
  decimals: Int!
  balance: String!
  balanceFormatted: String!
  usdValue: Float!
  price: Float!
  change24h: Float!
  logoURI: URL
  isVerified: Boolean!
}

type Transaction {
  id: ID!
  hash: String!
  from: String!
  to: String!
  value: String!
  gasUsed: String
  gasPrice: String
  blockNumber: Int
  status: TransactionStatus!
  timestamp: DateTime!
  type: TransactionType!
  token: Token
  confirmations: Int!
  fee: String
}

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
}

enum TransactionType {
  SEND
  RECEIVE
  CONTRACT
  SWAP
  STAKE
  UNSTAKE
  CLAIM
}

type Token {
  address: String!
  symbol: String!
  name: String!
  decimals: Int!
  totalSupply: String
  logoURI: URL
  isVerified: Boolean!
  isNative: Boolean!
  priceUSD: Float
  marketCapUSD: Float
  volume24hUSD: Float
}

type PoPTask {
  id: ID!
  title: String!
  description: String!
  status: PoPTaskStatus!
  createdAt: DateTime!
  completedAt: DateTime
  updatedAt: DateTime!
  estimatedHours: Float!
  actualHours: Float
  qualityScore: Int
  productivityScore: Float!
  category: String!
  tags: [String!]!
  user: User!
  validators: [User!]!
  deliverables: [Deliverable!]!
  timeEntries: [TimeEntry!]!
  peerValidations: [PeerValidation!]!
  estimatedCompletion: DateTime
  priority: Priority!
}

enum PoPTaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  VERIFIED
  REJECTED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

type Deliverable {
  id: ID!
  type: String!
  hash: String!
  url: URL
  size: Int!
  mimeType: String!
  createdAt: DateTime!
  uploadedBy: User!
}

type TimeEntry {
  id: ID!
  startTime: DateTime!
  endTime: DateTime!
  duration: Float!
  description: String
  createdAt: DateTime!
}

type PeerValidation {
  id: ID!
  validator: User!
  score: Int!
  comment: String
  createdAt: DateTime!
  status: ValidationStatus!
}

enum ValidationStatus {
  PENDING
  APPROVED
  REJECTED
  NEEDS_REVISION
}

type PoPUserStats {
  user: User!
  totalTasks: Int!
  completedTasks: Int!
  totalHours: Float!
  averageQualityScore: Float!
  productivityScore: Float!
  peerValidations: Int!
  rewardsEarned: String!
  rank: Int!
  tier: PoPTier!
  thisWeek: PoPWeeklyStats!
  thisMonth: PoPMonthlyStats!
}

enum PoPTier {
  BRONZE
  SILVER
  GOLD
  PLATINUM
  DIAMOND
}

type PoPWeeklyStats {
  tasks: Int!
  hours: Float!
  score: Float!
  rank: Int!
  changeFromLastWeek: Float!
}

type PoPMonthlyStats {
  tasks: Int!
  hours: Float!
  score: Float!
  rank: Int!
  rewardsEarned: String!
  changeFromLastMonth: Float!
}

type PoPAnalytics {
  period: AnalyticsPeriod!
  totalProductivity: Float!
  timeEfficiency: Float!
  qualityMetrics: [QualityMetric!]!
  categoryBreakdown: [CategoryMetric!]!
  dailyActivity: [DailyActivity!]!
  peerValidationRate: Float!
  rewardProjection: Float!
  trends: [TrendPoint!]!
  comparisons: [ComparisonMetric!]!
}

enum AnalyticsPeriod {
  WEEK
  MONTH
  QUARTER
  YEAR
  ALL_TIME
}

enum GroupBy {
  DAY
  WEEK
  MONTH
  CATEGORY
  USER
}

type QualityMetric {
  category: String!
  score: Float!
  count: Int!
  average: Float!
}

type CategoryMetric {
  name: String!
  value: Float!
  percentage: Float!
  color: String
}

type DailyActivity {
  date: DateTime!
  tasks: Int!
  hours: Float!
  productivityScore: Float!
}

type TrendPoint {
  date: DateTime!
  value: Float!
  change: Float
}

type ComparisonMetric {
  metric: String!
  current: Float!
  previous: Float!
  change: Float!
  changePercentage: Float!
}

type IPFSFile {
  id: ID!
  name: String!
  cid: String!
  size: Int!
  type: String!
  mimeType: String!
  uploadedAt: DateTime!
  isPublic: Boolean!
  tags: [String!]!
  uploadedBy: User!
  url: URL!
  downloadUrl: URL!
  sharableLink: URL
  metadata: JSON
}

type IPFSFileContent {
  cid: String!
  data: String!
  size: Int!
  contentType: String!
  lastModified: DateTime!
}

type StorageInfo {
  used: Int!
  quota: Int!
  usedPercentage: Float!
  available: Int!
  filesCount: Int!
}

type Portfolio {
  user: User!
  totalValueUSD: Float!
  totalValueChange24h: Float!
  totalValueChangePercentage24h: Float!
  tokens: [PortfolioToken!]!
  staking: [StakingPosition!]!
  history: [PortfolioHistoryPoint!]!
  performance: PortfolioPerformance!
  allocation: [AllocationMetric!]!
}

type PortfolioToken {
  token: Token!
  balance: String!
  valueUSD: Float!
  price: Float!
  change24h: Float!
  changePercentage24h: Float!
  allocationPercentage: Float!
}

type StakingPosition {
  id: ID!
  token: Token!
  amount: String!
  valueUSD: Float!
  apy: Float!
  rewards: [Reward!]!
  lockEndDate: DateTime!
  createdAt: DateTime!
  totalRewardsClaimed: String!
  claimableRewards: String!
  status: StakingStatus!
}

enum StakingStatus {
  ACTIVE
  UNSTAKING
  COMPLETED
}

type Reward {
  id: ID!
  token: Token!
  amount: String!
  valueUSD: Float!
  claimable: Boolean!
  claimedAt: DateTime
  earnedAt: DateTime!
  type: RewardType!
}

enum RewardType {
  STAKING
  PRODUCTIVITY
  GOVERNANCE
  REFERRAL
}

type PortfolioHistoryPoint {
  timestamp: DateTime!
  valueUSD: Float!
  changeUSD: Float!
  changePercentage: Float!
}

type PortfolioPerformance {
  totalReturn: Float!
  totalReturnPercentage: Float!
  dayReturn: Float!
  dayReturnPercentage: Float!
  weekReturn: Float!
  weekReturnPercentage: Float!
  monthReturn: Float!
  monthReturnPercentage: Float!
  yearReturn: Float!
  yearReturnPercentage: Float!
}

type AllocationMetric {
  category: String!
  valueUSD: Float!
  percentage: Float!
  tokens: [Token!]!
}

type SystemStatus {
  status: SystemStatusType!
  version: String!
  uptime: Int!
  services: [ServiceStatus!]!
  lastUpdate: DateTime!
  performance: SystemPerformance!
}

enum SystemStatusType {
  HEALTHY
  DEGRADED
  DOWN
  MAINTENANCE
}

type ServiceStatus {
  name: String!
  status: ServiceHealth!
  responseTime: Float!
  lastCheck: DateTime!
  dependencies: [String!]!
}

enum ServiceHealth {
  HEALTHY
  DEGRADED
  DOWN
  UNKNOWN
}

type SystemPerformance {
  cpuUsage: Float!
  memoryUsage: Float!
  diskUsage: Float!
  networkLatency: Float!
  activeConnections: Int!
  requestsPerSecond: Float!
}

# Connection types for pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type WalletConnection {
  edges: [WalletEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type WalletEdge {
  node: Wallet!
  cursor: String!
}

type TransactionConnection {
  edges: [TransactionEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type TransactionEdge {
  node: Transaction!
  cursor: String!
}

type PoPTaskConnection {
  edges: [PoPTaskEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PoPTaskEdge {
  node: PoPTask!
  cursor: String!
}

type IPFSFileConnection {
  edges: [IPFSFileEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type IPFSFileEdge {
  node: IPFSFile!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Input types
input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}

input UserFilter {
  search: String
  email: String
  username: String
  isVerified: Boolean
  createdAfter: DateTime
  createdBefore: DateTime
}

input WalletFilter {
  network: Network
  walletType: WalletType
  isActive: Boolean
  hasBalance: Boolean
}

input TransactionFilter {
  type: TransactionType
  status: TransactionStatus
  from: String
  to: String
  tokenAddress: String
  minAmount: String
  maxAmount: String
  dateFrom: DateTime
  dateTo: DateTime
}

input PoPTaskFilter {
  status: PoPTaskStatus
  category: String
  priority: Priority
  userId: ID
  dateFrom: DateTime
  dateTo: DateTime
  minEstimatedHours: Float
  maxEstimatedHours: Float
  hasDeliverables: Boolean
  search: String
}

input IPFSFileFilter {
  type: String
  isPublic: Boolean
  uploadedBy: ID
  dateFrom: DateTime
  dateTo: DateTime
  minSize: Int
  maxSize: Int
  search: String
}

input LoginInput {
  email: String!
  password: String!
  walletAddress: String
}

input RegisterInput {
  email: String!
  password: String!
  username: String!
  walletAddress: String
}

input CreateWalletInput {
  name: String!
  network: Network!
  walletType: WalletType!
  privateKey: String
  derivationPath: String
}

input SendTransactionInput {
  walletId: ID!
  to: String!
  amount: String!
  tokenAddress: String
  gasPrice: String
  gasLimit: String
  memo: String
}

input CreatePoPTaskInput {
  title: String!
  description: String!
  estimatedHours: Float!
  complexity: Int!
  category: String!
  tags: [String!]!
  priority: Priority = MEDIUM
  estimatedCompletion: DateTime
}

input UpdatePoPTaskInput {
  title: String
  description: String
  estimatedHours: Float
  complexity: Int
  category: String
  tags: [String!]
  priority: Priority
  estimatedCompletion: DateTime
}

input CompletePoPTaskInput {
  actualHours: Float!
  qualityScore: Int!
  deliverableHash: String!
  deliverableType: String!
  notes: String
  timeEntries: [TimeEntryInput!]
}

input TimeEntryInput {
  startTime: DateTime!
  endTime: DateTime!
  description: String
}

input ValidationInput {
  score: Int!
  comment: String
  status: ValidationStatus!
}

input UploadFileInput {
  file: String!
  title: String
  description: String
  tags: [String!]!
  isPublic: Boolean = false
  mimeType: String
  size: Int!
}

input UpdateFileInput {
  title: String
  description: String
  tags: [String!]
  isPublic: Boolean
}

input StakeTokensInput {
  tokenAddress: String!
  amount: String!
  lockDuration: Int!
}

input UnstakeTokensInput {
  stakingPositionId: ID!
  amount: String
}

input ClaimRewardsInput {
  stakingPositionId: ID
  rewardIds: [ID!]
}

input SwapTokensInput {
  fromToken: String!
  toToken: String!
  amount: String!
  minAmountOut: String
  slippage: Float = 0.5
}

# Payload types
type AuthPayload {
  token: String!
  refreshToken: String!
  user: User!
  expiresIn: Int!
}

type TransactionResult {
  transactionHash: String!
  status: TransactionStatus!
  confirmations: Int!
  estimatedConfirmationTime: Int!
  gasUsed: String
  gasPrice: String
}

type StakingResult {
  stakingPosition: StakingPosition!
  transactionHash: String
  estimatedRewards: String!
  lockEndDate: DateTime!
}

type UnstakeResult {
  success: Boolean!
  amount: String!
  fees: String!
  estimatedTime: String!
  transactionHash: String
  unclaimedRewards: String!
}

type ClaimResult {
  success: Boolean!
  claimedRewards: [Reward!]!
  transactionHash: String
  totalClaimedValueUSD: Float!
}

type SwapResult {
  transactionHash: String!
  outputAmount: String!
  outputAmountUSD: Float!
  priceImpact: Float!
  slippage: Float!
  estimatedTime: Int!
}

type SystemNotification {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: JSON
  createdAt: DateTime!
  read: Boolean!
}

enum NotificationType {
  TRANSACTION
  PRODUCTIVITY
  SYSTEM
  REWARD
  WARNING
  ERROR
}

# Custom scalars
scalar DateTime

scalar JSON

scalar URL
```

---

## 3. WebSocket API Documentation

### 3.1 WebSocket Connection

```javascript
// WebSocket API for real-time updates
const ws = new WebSocket('wss://api.sylos.io/v1/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token-here'
}));

// Connection acknowledgment
{
  "type": "auth",
  "success": true,
  "userId": "user-uuid",
  "timestamp": "2025-11-10T20:30:52Z"
}
```

### 3.2 Event Types

#### 3.2.1 Wallet Events

```javascript
// Balance update
{
  "type": "balance_update",
  "data": {
    "walletId": "wallet-uuid",
    "tokenAddress": "0x123...",
    "balance": "100.5",
    "balanceFormatted": "100.5 SYLOS",
    "usdValue": 150.75,
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Transaction update
{
  "type": "transaction_update",
  "data": {
    "transactionId": "tx-uuid",
    "hash": "0xabc123...",
    "status": "confirmed",
    "confirmations": 12,
    "blockNumber": 18500000,
    "gasUsed": "21000",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// New transaction detected
{
  "type": "new_transaction",
  "data": {
    "transaction": {
      "id": "tx-uuid",
      "hash": "0xdef456...",
      "from": "0x123...",
      "to": "0x456...",
      "value": "10.0",
      "type": "send",
      "timestamp": "2025-11-10T20:30:52Z"
    },
    "walletId": "wallet-uuid"
  }
}
```

#### 3.2.2 PoP Tracker Events

```javascript
// Task status update
{
  "type": "task_update",
  "data": {
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "status": "completed",
    "productivityScore": 8.5,
    "qualityScore": 9,
    "actualHours": 6.5,
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// New peer validation
{
  "type": "peer_validation",
  "data": {
    "taskId": "task-uuid",
    "validatorId": "validator-uuid",
    "score": 8,
    "comment": "Great work on the implementation",
    "status": "approved",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Productivity milestone
{
  "type": "productivity_milestone",
  "data": {
    "userId": "user-uuid",
    "milestone": "100_tasks_completed",
    "reward": "50.0",
    "newTier": "GOLD",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Rewards distribution
{
  "type": "rewards_distributed",
  "data": {
    "userId": "user-uuid",
    "amount": "25.75",
    "token": "wSYLOS",
    "source": "weekly_productivity",
    "period": "2025-W45",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}
```

#### 3.2.3 File Management Events

```javascript
// File upload progress
{
  "type": "upload_progress",
  "data": {
    "fileId": "file-uuid",
    "progress": 75,
    "uploadedBytes": 750000,
    "totalBytes": 1000000,
    "speed": "1.2 MB/s",
    "eta": "00:00:15",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// File upload completed
{
  "type": "upload_completed",
  "data": {
    "fileId": "file-uuid",
    "file": {
      "id": "file-uuid",
      "name": "document.pdf",
      "cid": "QmTkz...",
      "size": 1000000,
      "url": "https://ipfs.io/ipfs/QmTkz..."
    },
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// File shared
{
  "type": "file_shared",
  "data": {
    "fileId": "file-uuid",
    "sharedBy": "user-uuid",
    "sharedWith": "recipient-email",
    "permission": "read",
    "expiresAt": "2025-12-10T20:30:52Z",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}
```

#### 3.2.4 Portfolio Events

```javascript
// Price update
{
  "type": "price_update",
  "data": {
    "tokenAddress": "0x123...",
    "symbol": "SYLOS",
    "priceUSD": 1.5075,
    "change24h": 5.25,
    "changePercentage24h": 3.5,
    "volume24h": 1250000,
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Portfolio value update
{
  "type": "portfolio_update",
  "data": {
    "userId": "user-uuid",
    "totalValueUSD": 15750.25,
    "change24h": 250.50,
    "changePercentage24h": 1.6,
    "tokenBreakdown": [
      {
        "tokenAddress": "0x123...",
        "valueUSD": 10000,
        "allocationPercentage": 63.5
      }
    ],
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Staking reward
{
  "type": "staking_reward",
  "data": {
    "stakingPositionId": "stake-uuid",
    "userId": "user-uuid",
    "reward": {
      "amount": "0.5",
      "token": "wSYLOS",
      "valueUSD": 0.75,
      "type": "staking"
    },
    "timestamp": "2025-11-10T20:30:52Z"
  }
}
```

#### 3.2.5 System Events

```javascript
// System status change
{
  "type": "system_status",
  "data": {
    "status": "degraded",
    "service": "database",
    "message": "High latency detected",
    "affectedEndpoints": ["/api/wallets", "/api/transactions"],
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Maintenance notification
{
  "type": "maintenance",
  "data": {
    "scheduledStart": "2025-11-12T02:00:00Z",
    "scheduledEnd": "2025-11-12T04:00:00Z",
    "affectedServices": ["api", "websockets"],
    "message": "Scheduled maintenance for database optimization",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Security alert
{
  "type": "security_alert",
  "data": {
    "alertType": "unusual_activity",
    "severity": "medium",
    "description": "Multiple failed login attempts detected",
    "affectedUser": "user-uuid",
    "ipAddress": "192.168.1.1",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}
```

### 3.3 Subscription Management

```javascript
// Subscribe to wallet updates
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "wallet",
  params: {
    "walletId": "wallet-uuid"
  }
}));

// Subscribe to PoP task updates
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "pop_tasks",
  params: {
    "userId": "user-uuid",
    "status": "all"
  }
}));

// Subscribe to price updates
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "prices",
  params: {
    "tokens": ["0x123...", "0x456..."]
  }
}));

// Unsubscribe
ws.send(JSON.stringify({
  type: "unsubscribe",
  channel: "wallet",
  params: {
    "walletId": "wallet-uuid"
  }
}));
```

### 3.4 Error Handling

```javascript
// Connection error
{
  "type": "error",
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Unable to connect to WebSocket server",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Authentication error
{
  "type": "error",
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid or expired token",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}

// Subscription error
{
  "type": "error",
  "error": {
    "code": "SUBSCRIPTION_FAILED",
    "message": "Channel not found or access denied",
    "channel": "wallet",
    "timestamp": "2025-11-10T20:30:52Z"
  }
}
```

---

## 4. Smart Contract API Reference

### 4.1 SylOSToken (SYLOS)

#### Contract Overview
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SylOSToken
 * @dev ERC-20 token with tax collection, minting/burning, and anti-bot protection
 */
contract SylOSToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TAX_MANAGER_ROLE = keccak256("TAX_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public constant TAX_DENOMINATOR = 1000; // For precise percentage calculations
    uint256 public taxRate; // Current tax rate (basis points)
    address public taxRecipient; // Address receiving collected taxes
    uint256 public maxTransactionAmount; // Maximum transaction size
    uint256 public maxWalletAmount; // Maximum wallet balance
    mapping(address => bool) public isBlacklisted; // Bot protection
    mapping(address => bool) public isWhitelisted; // Exempt from limits
}
```

#### Core Functions

##### mint
```solidity
/**
 * @dev Mint new tokens to specified address
 * @param to Address to mint tokens to
 * @param amount Amount of tokens to mint
 * @notice Only callable by MINTER_ROLE
 */
function mint(address to, uint256 amount) 
    external 
    onlyRole(MINTER_ROLE) 
    whenNotPaused
{
    require(to != address(0), "Cannot mint to zero address");
    require(amount > 0, "Amount must be greater than 0");
    
    _mint(to, amount);
    emit TokensMinted(to, amount, msg.sender);
}

event TokensMinted(address indexed to, uint256 amount, address indexed minter);
```

##### burn
```solidity
/**
 * @dev Burn tokens from caller's balance
 * @param amount Amount of tokens to burn
 */
function burn(uint256 amount) 
    external 
    whenNotPaused 
{
    require(amount > 0, "Amount must be greater than 0");
    require(balanceOf(msg.sender) >= amount, "Insufficient balance");
    
    _burn(msg.sender, amount);
    emit TokensBurned(msg.sender, amount);
}

event TokensBurned(address indexed from, uint256 amount);
```

##### transfer
```solidity
/**
 * @dev Transfer tokens with tax collection
 * @param to Address to transfer to
 * @param amount Amount to transfer
 * @return success Transfer success status
 */
function transfer(address to, uint256 amount) 
    public 
    override 
    whenNotPaused 
    returns (bool) 
{
    require(to != address(0), "Transfer to zero address");
    require(!isBlacklisted[msg.sender], "Sender is blacklisted");
    require(!isBlacklisted[to], "Recipient is blacklisted");
    require(amount > 0, "Amount must be greater than 0");
    
    // Check transaction limits for non-whitelisted addresses
    if (!isWhitelisted[msg.sender] && !isWhitelisted[to]) {
        require(amount <= maxTransactionAmount, "Amount exceeds transaction limit");
        require(balanceOf(to) + amount <= maxWalletAmount, "Exceeds wallet limit");
    }
    
    uint256 taxAmount = (amount * taxRate) / TAX_DENOMINATOR;
    uint256 transferAmount = amount - taxAmount;
    
    _transfer(msg.sender, to, transferAmount);
    if (taxAmount > 0) {
        _transfer(msg.sender, taxRecipient, taxAmount);
        emit TaxCollected(msg.sender, to, taxAmount, taxRate);
    }
    
    return true;
}

event TaxCollected(
    address indexed from, 
    address indexed to, 
    uint256 taxAmount, 
    uint256 taxRate
);
```

##### updateTaxRate
```solidity
/**
 * @dev Update tax rate
 * @param newTaxRate New tax rate in basis points
 * @notice Only callable by TAX_MANAGER_ROLE, max 5% (500 basis points)
 */
function updateTaxRate(uint256 newTaxRate) 
    external 
    onlyRole(TAX_MANAGER_ROLE) 
{
    require(newTaxRate <= 500, "Tax rate cannot exceed 5%");
    
    uint256 oldTaxRate = taxRate;
    taxRate = newTaxRate;
    
    emit TaxRateUpdated(oldTaxRate, newTaxRate, msg.sender);
}

event TaxRateUpdated(
    uint256 indexed oldRate, 
    uint256 indexed newRate, 
    address indexed updater
);
```

### 4.2 WrappedSYLOS (wSYLOS)

#### Contract Overview
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title WrappedSYLOS
 * @dev Wrapper token for staking and time-locked rewards
 */
contract WrappedSYLOS is ERC20, AccessControl, ReentrancyGuard {
    bytes32 public constant WRAPPER_ROLE = keccak256("WRAPPER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    
    IERC20 public immutable sylosToken;
    
    // Time lock periods (in seconds)
    uint256[] public timeLockPeriods = [30 days, 90 days, 180 days, 365 days];
    uint256[] public timeLockBonuses = [100, 250, 500, 1000]; // Basis points
    
    struct TimeLock {
        uint256 amount;
        uint256 endTime;
        uint256 bonusRate;
        bool claimed;
    }
    
    struct StakePosition {
        uint256 totalStaked;
        uint256 totalRewards;
        uint256 claimableRewards;
        TimeLock[] timeLocks;
    }
    
    mapping(address => StakePosition) public stakes;
    mapping(address => uint256) public lastRewardClaim;
}
```

#### Core Functions

##### wrap
```solidity
/**
 * @dev Wrap SYLOS tokens to receive wSYLOS
 * @param amount Amount of SYLOS to wrap
 */
function wrap(uint256 amount) 
    external 
    nonReentrant 
{
    require(amount > 0, "Amount must be greater than 0");
    require(
        sylosToken.transferFrom(msg.sender, address(this), amount),
        "Transfer failed"
    );
    
    _mint(msg.sender, amount);
    emit Wrapped(msg.sender, amount);
}

event Wrapped(address indexed user, uint256 amount);
```

##### unwrap
```solidity
/**
 * @dev Unwrap wSYLOS tokens to receive SYLOS
 * @param amount Amount of wSYLOS to unwrap
 */
function unwrap(uint256 amount) 
    external 
    nonReentrant 
{
    require(amount > 0, "Amount must be greater than 0");
    require(balanceOf(msg.sender) >= amount, "Insufficient wSYLOS balance");
    
    _burn(msg.sender, amount);
    require(
        sylosToken.transfer(msg.sender, amount),
        "Transfer failed"
    );
    
    emit Unwrapped(msg.sender, amount);
}

event Unwrapped(address indexed user, uint256 amount);
```

##### timeLock
```solidity
/**
 * @dev Time-lock tokens for bonus rewards
 * @param amount Amount to time-lock
 * @param lockDurationIndex Index of lock period
 */
function timeLock(uint256 amount, uint256 lockDurationIndex) 
    external 
    nonReentrant 
{
    require(amount > 0, "Amount must be greater than 0");
    require(lockDurationIndex < timeLockPeriods.length, "Invalid lock period");
    require(balanceOf(msg.sender) >= amount, "Insufficient balance");
    
    // Calculate bonus rate
    uint256 bonusRate = timeLockBonuses[lockDurationIndex];
    uint256 lockEndTime = block.timestamp + timeLockPeriods[lockDurationIndex];
    
    // Create time lock
    TimeLock memory newTimeLock = TimeLock({
        amount: amount,
        endTime: lockEndTime,
        bonusRate: bonusRate,
        claimed: false
    });
    
    stakes[msg.sender].timeLocks.push(newTimeLock);
    
    emit TimeLocked(msg.sender, amount, lockDurationIndex, lockEndTime);
}

event TimeLocked(
    address indexed user, 
    uint256 amount, 
    uint256 lockDurationIndex, 
    uint256 endTime
);
```

##### claimRewards
```solidity
/**
 * @dev Claim accumulated rewards
 */
function claimRewards() 
    external 
    nonReentrant 
{
    updateReward(msg.sender);
    
    uint256 rewards = stakes[msg.sender].claimableRewards;
    require(rewards > 0, "No rewards to claim");
    
    stakes[msg.sender].claimableRewards = 0;
    _mint(msg.sender, rewards);
    
    emit RewardsClaimed(msg.sender, rewards);
}

event RewardsClaimed(address indexed user, uint256 amount);
```

##### getPendingRewards
```solidity
/**
 * @dev Get pending rewards for user
 * @param user User address
 * @return pendingAmount Pending rewards amount
 */
function getPendingRewards(address user) 
    external 
    view 
    returns (uint256 pendingAmount) 
{
    return stakes[user].claimableRewards;
}
```

### 4.3 PoPTracker

#### Contract Overview
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PoPTracker
 * @dev Productivity tracking and reward distribution system
 */
contract PoPTracker is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    
    IERC20 public immutable rewardToken;
    
    struct Task {
        uint256 id;
        address creator;
        string description;
        uint256 estimatedHours;
        uint256 complexity; // 1-10
        TaskStatus status;
        uint256 actualHours;
        uint256 qualityScore; // 1-10
        string deliverableHash;
        uint256 createdAt;
        uint256 completedAt;
        address[] validators;
        uint256 totalValidationScore;
    }
    
    struct UserProfile {
        uint256 totalTasks;
        uint256 completedTasks;
        uint256 totalHours;
        uint256 averageQualityScore;
        uint256 productivityScore;
        uint256 rewardsEarned;
        UserTier tier;
        uint256 lastRewardDistribution;
    }
    
    enum TaskStatus { PENDING, IN_PROGRESS, COMPLETED, VERIFIED, REJECTED }
    enum UserTier { BRONZE, SILVER, GOLD, PLATINUM, DIAMOND }
    
    mapping(uint256 => Task) public tasks;
    mapping(address => UserProfile) public userProfiles;
    mapping(address => mapping(uint256 => bool)) public taskValidations;
    
    uint256 public taskCount;
    uint256 public constant PRODUCTIVITY_FACTOR = 10000; // For precision
    uint256 public constant REWARD_DISTRIBUTION_INTERVAL = 7 days;
}
```

#### Core Functions

##### createTask
```solidity
/**
 * @dev Create a new productivity task
 * @param description Task description
 * @param estimatedHours Estimated hours to complete
 * @param complexity Task complexity (1-10)
 * @return taskId ID of created task
 */
function createTask(
    string calldata description,
    uint256 estimatedHours,
    uint256 complexity
) 
    external 
    onlyRole(MANAGER_ROLE) 
    returns (uint256 taskId) 
{
    require(estimatedHours > 0, "Estimated hours must be greater than 0");
    require(complexity >= 1 && complexity <= 10, "Complexity must be 1-10");
    
    taskId = ++taskCount;
    
    tasks[taskId] = Task({
        id: taskId,
        creator: msg.sender,
        description: description,
        estimatedHours: estimatedHours,
        complexity: complexity,
        status: TaskStatus.PENDING,
        actualHours: 0,
        qualityScore: 0,
        deliverableHash: "",
        createdAt: block.timestamp,
        completedAt: 0,
        validators: new address[](0),
        totalValidationScore: 0
    });
    
    emit TaskCreated(taskId, msg.sender, description, estimatedHours, complexity);
}

event TaskCreated(
    uint256 indexed taskId, 
    address indexed creator, 
    string description, 
    uint256 estimatedHours, 
    uint256 complexity
);
```

##### completeTask
```solidity
/**
 * @dev Complete a task
 * @param taskId Task ID
 * @param actualHours Actual hours spent
 * @param qualityScore Quality score (1-10)
 * @param deliverableHash IPFS hash of deliverable
 */
function completeTask(
    uint256 taskId,
    uint256 actualHours,
    uint256 qualityScore,
    string calldata deliverableHash
) 
    external 
{
    Task storage task = tasks[taskId];
    require(task.creator == msg.sender, "Only task creator can complete");
    require(task.status == TaskStatus.PENDING, "Task not in pending state");
    require(qualityScore >= 1 && qualityScore <= 10, "Quality score must be 1-10");
    
    task.status = TaskStatus.COMPLETED;
    task.actualHours = actualHours;
    task.qualityScore = qualityScore;
    task.deliverableHash = deliverableHash;
    task.completedAt = block.timestamp;
    
    emit TaskCompleted(taskId, msg.sender, actualHours, qualityScore, deliverableHash);
}

event TaskCompleted(
    uint256 indexed taskId, 
    address indexed creator, 
    uint256 actualHours, 
    uint256 qualityScore, 
    string deliverableHash
);
```

##### validateTask
```solidity
/**
 * @dev Validate a completed task
 * @param taskId Task ID
 * @param validationScore Validation score (1-10)
 * @param comment Optional validation comment
 */
function validateTask(
    uint256 taskId,
    uint256 validationScore,
    string calldata comment
) 
    external 
    onlyRole(VERIFIER_ROLE) 
{
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.COMPLETED, "Task not completed");
    require(!taskValidations[msg.sender][taskId], "Already validated");
    require(validationScore >= 1 && validationScore <= 10, "Score must be 1-10");
    
    taskValidations[msg.sender][taskId] = true;
    task.validators.push(msg.sender);
    task.totalValidationScore += validationScore;
    
    emit TaskValidated(taskId, msg.sender, validationScore, comment);
}

event TaskValidated(
    uint256 indexed taskId, 
    address indexed validator, 
    uint256 score, 
    string comment
);
```

##### distributeRewards
```solidity
/**
 * @dev Distribute rewards based on productivity
 */
function distributeRewards() 
    external 
    onlyRole(REWARD_DISTRIBUTOR_ROLE) 
    nonReentrant 
{
    require(
        block.timestamp >= lastRewardDistribution + REWARD_DISTRIBUTION_INTERVAL,
        "Distribution interval not met"
    );
    
    // Implementation would calculate rewards based on productivity metrics
    // and distribute to users
    
    lastRewardDistribution = block.timestamp;
    emit RewardsDistributed(block.timestamp);
}

event RewardsDistributed(uint256 indexed timestamp);
```

### 4.4 MetaTransactionPaymaster

#### Contract Overview
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MetaTransactionPaymaster
 * @dev Gasless transaction infrastructure
 */
contract MetaTransactionPaymaster is AccessControl, ReentrancyGuard {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAYMASTER_ROLE = keccak256("PAYMASTER_ROLE");
    
    struct PaymentToken {
        address token;
        uint256 gasPrice;
        string name;
        string symbol;
        bool isActive;
    }
    
    struct UserQuota {
        uint256 monthlyLimit;
        uint256 monthlyUsed;
        uint256 resetTime;
        bool isWhitelisted;
    }
    
    struct MetaTransaction {
        address from;
        address to;
        uint256 value;
        bytes data;
        uint256 gas;
        uint256 nonce;
        uint256 gasPrice;
    }
    
    mapping(address => PaymentToken) public paymentTokens;
    mapping(address => mapping(address => UserQuota)) public userQuotas;
    mapping(address => uint256) public nonces;
    
    uint256 public constant GAS_OVERHEAD = 21000;
    uint256 public constant MAX_GAS_PRICE = 100 gwei;
    uint256 public constant MONTHLY_SECONDS = 30 days;
}
```

#### Core Functions

##### executeMetaTransaction
```solidity
/**
 * @dev Execute a gasless meta transaction
 * @param user User address
 * @param signature ECDSA signature
 * @param metaTx Meta transaction data
 * @return result Transaction result
 */
function executeMetaTransaction(
    address user,
    bytes calldata signature,
    MetaTransaction calldata metaTx
) 
    external 
    nonReentrant 
    returns (bytes memory result) 
{
    require(user == metaTx.from, "User address mismatch");
    require(metaTx.gasPrice <= MAX_GAS_PRICE, "Gas price too high");
    require(nonces[user] == metaTx.nonce, "Invalid nonce");
    
    // Verify signature
    bytes32 structHash = keccak256(
        abi.encode(
            metaTx.from,
            metaTx.to,
            metaTx.value,
            metaTx.data,
            metaTx.gas,
            metaTx.nonce,
            metaTx.gasPrice
        )
    );
    
    bytes32 digest = keccak256(
        abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
    );
    
    require(
        ecrecover(digest, signature.v, signature.r, signature.s) == user,
        "Invalid signature"
    );
    
    // Check user quota
    UserQuota storage quota = userQuotas[user][msg.sender];
    _updateQuota(quota);
    
    uint256 estimatedCost = _estimateTransactionCost(metaTx);
    require(
        quota.monthlyUsed + estimatedCost <= quota.monthlyLimit,
        "Quota exceeded"
    );
    
    // Execute transaction
    (result, ) = metaTx.to.call{gas: metaTx.gas}(
        abi.encodePacked(metaTx.data, metaTx.from)
    );
    
    if (result[0] == 0x0 && result.length > 0) {
        // Transaction failed
        revert("Meta transaction failed");
    }
    
    // Update quota
    quota.monthlyUsed += estimatedCost;
    
    // Increment nonce
    nonces[user]++;
    
    // Emit event
    emit MetaTransactionExecuted(
        user,
        metaTx.to,
        metaTx.value,
        metaTx.gas,
        metaTx.gasPrice,
        estimatedCost
    );
}

event MetaTransactionExecuted(
    address indexed user,
    address indexed to,
    uint256 value,
    uint256 gas,
    uint256 gasPrice,
    uint256 cost
);
```

### 4.5 SylOSGovernance

#### Contract Overview
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title SylOSGovernance
 * @dev DAO governance system for protocol decisions
 */
contract SylOSGovernance is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorTimelockControl 
{
    uint256 public constant PROPOSAL_THRESHOLD = 1000 * 10**18; // 1000 SYLOS
    uint256 public constant VOTING_DELAY = 1 days; // 1 day voting delay
    uint256 public constant VOTING_PERIOD = 3 days; // 3 days voting period
    uint256 public constant QUORUM_NUMERATOR = 10000; // 10% quorum
    
    mapping(address => uint256) public lockedFunds;
    mapping(uint256 => uint256) public proposalQuorum;
    
    event FundsLocked(address indexed user, uint256 amount, uint256 unlockTime);
    event FundsUnlocked(address indexed user, uint256 amount);
    event EmergencyProposalCreated(uint256 indexed proposalId, address indexed proposer);
}
```

#### Core Functions

##### propose
```solidity
/**
 * @dev Create a governance proposal
 * @param targets Target addresses
 * @param values ETH values
 * @param calldatas Call data
 * @param title Proposal title
 * @param description Proposal description
 * @param evidence Evidence hash (IPFS)
 * @return proposalId ID of created proposal
 */
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory title,
    string memory description,
    string memory evidence
) 
    public 
    override 
    returns (uint256 proposalId) 
{
    require(lockedFunds[msg.sender] >= PROPOSAL_THRESHOLD, "Insufficient locked funds");
    
    proposalId = super.propose(targets, values, calldatas, title, description);
    
    // Store additional metadata
    emit ProposalCreatedWithEvidence(proposalId, msg.sender, title, description, evidence);
}

event ProposalCreatedWithEvidence(
    uint256 indexed proposalId,
    address indexed proposer,
    string title,
    string description,
    string evidence
);
```

##### lockFunds
```solidity
/**
 * @dev Lock funds for governance participation
 * @param amount Amount to lock
 */
function lockFunds(uint256 amount) 
    external 
{
    require(amount > 0, "Amount must be greater than 0");
    
    // Transfer tokens to this contract
    IERC20(address(votingToken)).transferFrom(msg.sender, address(this), amount);
    
    lockedFunds[msg.sender] += amount;
    
    emit FundsLocked(msg.sender, amount, block.timestamp + 365 days);
}
```

---

## 5. SDK Documentation

### 5.1 JavaScript/TypeScript SDK

#### Installation
```bash
npm install @sylos/sdk
# or
yarn add @sylos/sdk
```

#### Basic Setup
```typescript
import { SylosSDK } from '@sylos/sdk';

// Initialize SDK
const sylos = new SylosSDK({
  apiKey: 'your-api-key',
  environment: 'production', // or 'staging', 'development'
  network: 'ethereum' // or 'polygon', 'bsc'
});

// Authenticate
await sylos.auth.login({
  email: 'user@example.com',
  password: 'password123'
});
```

#### Wallet Operations
```typescript
// Create wallet
const wallet = await sylos.wallets.create({
  network: 'ethereum',
  walletType: 'metamask',
  name: 'My Wallet'
});

// Get wallet balance
const balance = await sylos.wallets.getBalance(wallet.id, {
  tokens: ['0x123...', '0x456...']
});

// Send transaction
const transaction = await sylos.wallets.sendTransaction(wallet.id, {
  to: '0x789...',
  amount: '1.5',
  tokenAddress: 'native' // or specific token address
});

// Get transaction history
const transactions = await sylos.wallets.getTransactions(wallet.id, {
  limit: 20,
  offset: 0,
  type: 'all'
});
```

#### PoP Tracker Operations
```typescript
// Create task
const task = await sylos.pop.createTask({
  title: 'Complete API Documentation',
  description: 'Write comprehensive API documentation for SylOS',
  estimatedHours: 8,
  complexity: 7,
  category: 'development',
  tags: ['documentation', 'api', 'typescript']
});

// Complete task
const completedTask = await sylos.pop.completeTask(task.id, {
  actualHours: 6.5,
  qualityScore: 9,
  deliverableHash: 'QmTkz...',
  deliverableType: 'document',
  notes: 'Documentation completed ahead of schedule'
});

// Get productivity analytics
const analytics = await sylos.pop.getAnalytics({
  period: 'month',
  metrics: ['productivity_score', 'time_efficiency', 'quality_score']
});
```

#### File Management
```typescript
// Upload file to IPFS
const file = await sylos.files.upload({
  file: fileBuffer,
  title: 'Project Document',
  description: 'Important project documentation',
  tags: ['important', 'project', 'docs'],
  isPublic: false
});

// Get file details
const fileDetails = await sylos.files.get(file.id);

// Download file
const fileContent = await sylos.files.download(file.id);

// List files
const files = await sylos.files.list({
  limit: 20,
  type: 'document',
  sort: 'date'
});
```

#### Portfolio Management
```typescript
// Get portfolio overview
const portfolio = await sylos.portfolio.get({
  currency: 'USD',
  includeHistory: true
});

// Stake tokens
const stakingResult = await sylos.portfolio.stake({
  tokenAddress: '0x123...',
  amount: '1000',
  lockDuration: 365
});

// Unstake tokens
const unstakeResult = await sylos.portfolio.unstake({
  stakingPositionId: 'stake-uuid',
  amount: '500'
});

// Claim rewards
const claimResult = await sylos.portfolio.claimRewards({
  stakingPositionId: 'stake-uuid'
});
```

### 5.2 Python SDK

#### Installation
```bash
pip install sylos-python-sdk
```

#### Basic Setup
```python
from sylos import SylosSDK

# Initialize SDK
sylos = SylosSDK(
    api_key='your-api-key',
    environment='production',
    network='ethereum'
)

# Authenticate
sylos.auth.login(
    email='user@example.com',
    password='password123'
)
```

#### Usage Examples
```python
# Create wallet
wallet = sylos.wallets.create(
    network='ethereum',
    wallet_type='metamask',
    name='My Wallet'
)

# Get balance
balance = sylos.wallets.get_balance(
    wallet_id=wallet['id'],
    tokens=['0x123...', '0x456...']
)

# Create PoP task
task = sylos.pop.create_task(
    title='API Integration',
    description='Integrate SylOS API with our system',
    estimated_hours=16,
    complexity=8,
    category='development',
    tags=['api', 'integration', 'backend']
)

# Upload file
file = sylos.files.upload(
    file_path='document.pdf',
    title='API Documentation',
    description='Complete API reference guide',
    tags=['api', 'docs'],
    is_public=False
)
```

### 5.3 React Native SDK

#### Installation
```bash
npm install @sylos/react-native-sdk
```

#### Setup
```typescript
import { SylosProvider } from '@sylos/react-native-sdk';

function App() {
  return (
    <SylosProvider
      apiKey="your-api-key"
      environment="production"
    >
      <YourApp />
    </SylosProvider>
  );
}
```

#### Usage
```typescript
import { useSylos } from '@sylos/react-native-sdk';

function WalletScreen() {
  const { wallets, createWallet, getBalance } = useSylos();
  
  const handleCreateWallet = async () => {
    const wallet = await createWallet({
      network: 'ethereum',
      walletType: 'generated',
      name: 'My Mobile Wallet'
    });
    console.log('Wallet created:', wallet);
  };
  
  return (
    <View>
      <Button title="Create Wallet" onPress={handleCreateWallet} />
      {/* ... other UI elements ... */}
    </View>
  );
}
```

### 5.4 Smart Contract Integration

#### Web3.js Integration
```javascript
import { ethers } from 'ethers';
import { SylosContracts } from '@sylos/contracts';

// Setup provider and signer
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// Initialize contracts
const sylosToken = new ethers.Contract(
  '0x123...', // Contract address
  SylosContracts.SylOSToken.abi,
  signer
);

// Use the contract
const balance = await sylosToken.balanceOf(userAddress);
const transferTx = await sylosToken.transfer(recipient, amount);
await transferTx.wait();
```

#### Ethers.js Integration
```typescript
import { ethers } from 'ethers';
import { SylosContracts } from '@sylos/contracts';

// Setup provider and signer
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// Initialize contracts
const popTracker = new ethers.Contract(
  '0x456...', // Contract address
  SylosContracts.PoPTracker.abi,
  signer
);

// Create a task
const createTaskTx = await popTracker.createTask(
  'Complete integration',
  8, // estimated hours
  7  // complexity
);
const receipt = await createTaskTx.wait();
```

---

## 6. Integration Guides

### 6.1 Web3 Integration Guide

#### MetaMask Integration
```html
<!DOCTYPE html>
<html>
<head>
  <title>SylOS Web3 Integration</title>
</head>
<body>
  <button id="connectWallet">Connect Wallet</button>
  <div id="balanceDisplay"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.min.js"></script>
  <script src="sylos-web3.js"></script>
</body>
</html>
```

```javascript
// sylos-web3.js
class SylosWeb3Integration {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
  }
  
  async connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
        
        // Initialize SylOS contracts
        await this.initializeContracts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        return true;
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        return false;
      }
    } else {
      alert('MetaMask not installed');
      return false;
    }
  }
  
  async initializeContracts() {
    // SYLOS Token
    this.contracts.sylosToken = new ethers.Contract(
      '0x1234567890123456789012345678901234567890', // Replace with actual address
      [
        'function balanceOf(address account) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)'
      ],
      this.signer
    );
    
    // PoP Tracker
    this.contracts.popTracker = new ethers.Contract(
      '0x2345678901234567890123456789012345678901', // Replace with actual address
      [
        'function createTask(string description, uint256 estimatedHours, uint256 complexity) returns (uint256)',
        'function completeTask(uint256 taskId, uint256 actualHours, uint256 qualityScore, string deliverableHash)',
        'function getUserTasks(address user) view returns (tuple[])'
      ],
      this.signer
    );
  }
  
  setupEventListeners() {
    // Account changes
    window.ethereum.on('accountsChanged', (accounts) => {
      this.handleAccountChange(accounts[0]);
    });
    
    // Network changes
    window.ethereum.on('chainChanged', (chainId) => {
      this.handleNetworkChange(chainId);
    });
  }
  
  async handleAccountChange(account) {
    if (account) {
      await this.displayBalance(account);
      await this.displayTasks(account);
    } else {
      this.clearDisplay();
    }
  }
  
  async displayBalance(account) {
    const balance = await this.contracts.sylosToken.balanceOf(account);
    const formattedBalance = ethers.formatEther(balance);
    
    document.getElementById('balanceDisplay').innerText = 
      `SYLOS Balance: ${formattedBalance}`;
  }
  
  async createPopTask(description, estimatedHours, complexity) {
    try {
      const tx = await this.contracts.popTracker.createTask(
        description,
        ethers.parseEther(estimatedHours.toString()),
        complexity
      );
      
      const receipt = await tx.wait();
      console.log('Task created:', receipt);
      
      return receipt;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }
  
  async completePopTask(taskId, actualHours, qualityScore, deliverableHash) {
    try {
      const tx = await this.contracts.popTracker.completeTask(
        taskId,
        ethers.parseEther(actualHours.toString()),
        qualityScore,
        deliverableHash
      );
      
      const receipt = await tx.wait();
      console.log('Task completed:', receipt);
      
      return receipt;
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    }
  }
}

// Initialize integration
const sylos = new SylosWeb3Integration();

// Connect wallet button
document.getElementById('connectWallet').addEventListener('click', async () => {
  const connected = await sylos.connectWallet();
  if (connected) {
    const accounts = await sylos.provider.listAccounts();
    const account = accounts[0];
    await sylos.handleAccountChange(account);
  }
});
```

### 6.2 IPFS Integration Guide

#### Uploading Files to IPFS
```javascript
import IPFS from 'ipfs-api';

class SylosIPFSIntegration {
  constructor() {
    this.ipfs = IPFS({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https'
    });
  }
  
  async uploadFile(file, metadata = {}) {
    try {
      // Convert file to buffer
      const fileBuffer = await this.fileToBuffer(file);
      
      // Add file to IPFS
      const result = await this.ipfs.add(fileBuffer, {
        progress: (prog) => console.log(`Received: ${prog}`)
      });
      
      const cid = result[0].hash;
      
      // Store metadata
      const metadataObject = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        ...metadata
      };
      
      const metadataResult = await this.ipfs.add(
        JSON.stringify(metadataObject)
      );
      const metadataCid = metadataResult[0].hash;
      
      return {
        cid,
        metadataCid,
        url: `https://ipfs.io/ipfs/${cid}`,
        metadataUrl: `https://ipfs.io/ipfs/${metadataCid}`
      };
    } catch (error) {
      console.error('Failed to upload to IPFS:', error);
      throw error;
    }
  }
  
  async uploadWithEncryption(file, password) {
    try {
      // Encrypt file before upload
      const encryptedBuffer = await this.encryptFile(file, password);
      
      const result = await this.ipfs.add(encryptedBuffer);
      const cid = result[0].hash;
      
      return {
        cid,
        url: `https://ipfs.io/ipfs/${cid}`,
        encrypted: true
      };
    } catch (error) {
      console.error('Failed to upload encrypted file:', error);
      throw error;
    }
  }
  
  async downloadFile(cid) {
    try {
      const chunks = [];
      
      for await (const chunk of this.ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to download from IPFS:', error);
      throw error;
    }
  }
  
  async pinFile(cid) {
    try {
      await this.ipfs.pin.add(cid);
      console.log(`File ${cid} pinned successfully`);
    } catch (error) {
      console.error('Failed to pin file:', error);
      throw error;
    }
  }
  
  async unpinFile(cid) {
    try {
      await this.ipfs.pin.rm(cid);
      console.log(`File ${cid} unpinned successfully`);
    } catch (error) {
      console.error('Failed to unpin file:', error);
      throw error;
    }
  }
  
  async getPinStatus() {
    try {
      const pins = await this.ipfs.pin.ls();
      return Array.from(pins);
    } catch (error) {
      console.error('Failed to get pin status:', error);
      throw error;
    }
  }
  
  fileToBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  
  async encryptFile(file, password) {
    // Simple encryption using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(await this.fileToBuffer(file));
    
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Import password as key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Derive key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine salt, iv, and encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return result;
  }
}

// Usage example
const ipfsIntegration = new SylosIPFSIntegration();

// Upload a file
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const result = await ipfsIntegration.uploadFile(file, {
        uploadedBy: 'user-id',
        category: 'document'
      });
      
      console.log('File uploaded:', result);
      
      // Store the result in your database
      await saveFileMetadata(result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
});
```

### 6.3 Mobile Integration Guide

#### React Native Setup
```javascript
// App.js
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SylosProvider, useSylos } from '@sylos/react-native-sdk';

const WalletScreen = () => {
  const { wallets, createWallet, getBalance, loading, error } = useSylos();
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [balance, setBalance] = useState(null);

  const handleCreateWallet = async () => {
    try {
      const wallet = await createWallet({
        network: 'ethereum',
        walletType: 'generated',
        name: 'My Mobile Wallet'
      });
      
      Alert.alert('Success', 'Wallet created successfully!');
      console.log('Created wallet:', wallet);
    } catch (error) {
      Alert.alert('Error', 'Failed to create wallet');
    }
  };

  const handleSelectWallet = async (wallet) => {
    try {
      setSelectedWallet(wallet);
      const balanceData = await getBalance(wallet.id);
      setBalance(balanceData);
    } catch (error) {
      Alert.alert('Error', 'Failed to get balance');
    }
  };

  const renderWallet = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.walletItem,
        selectedWallet?.id === item.id && styles.selectedWallet
      ]}
      onPress={() => handleSelectWallet(item)}
    >
      <Text style={styles.walletName}>{item.name}</Text>
      <Text style={styles.walletAddress}>
        {item.address.substring(0, 10)}...{item.address.substring(-8)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallets</Text>
      
      <TouchableOpacity 
        style={styles.createButton}
        onPress={handleCreateWallet}
        disabled={loading}
      >
        <Text style={styles.createButtonText}>
          {loading ? 'Creating...' : 'Create New Wallet'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={wallets}
        renderItem={renderWallet}
        keyExtractor={(item) => item.id}
        style={styles.walletList}
      />

      {selectedWallet && balance && (
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceTitle}>Balance</Text>
          {balance.map((token, index) => (
            <View key={index} style={styles.tokenBalance}>
              <Text style={styles.tokenSymbol}>{token.symbol}</Text>
              <Text style={styles.tokenAmount}>
                {token.balanceFormatted}
              </Text>
              <Text style={styles.tokenValue}>
                ${token.usdValue}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const PoPScreen = () => {
  const { pop, loading } = useSylos();
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    estimatedHours: 0,
    complexity: 5
  });

  const handleCreateTask = async () => {
    try {
      const task = await pop.createTask(newTask);
      setTasks([task, ...tasks]);
      setNewTask({
        title: '',
        description: '',
        estimatedHours: 0,
        complexity: 5
      });
      Alert.alert('Success', 'Task created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const completedTask = await pop.completeTask(taskId, {
        actualHours: 4,
        qualityScore: 8,
        deliverableHash: 'QmExampleHash',
        deliverableType: 'document'
      });
      
      // Update task in local state
      setTasks(tasks.map(task => 
        task.id === taskId ? completedTask : task
      ));
      
      Alert.alert('Success', 'Task completed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete task');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Productivity Tracker</Text>
      
      <View style={styles.createTaskContainer}>
        <Text style={styles.subtitle}>Create New Task</Text>
        <TextInput
          style={styles.input}
          placeholder="Task Title"
          value={newTask.title}
          onChangeText={(text) => setNewTask({...newTask, title: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Description"
          value={newTask.description}
          onChangeText={(text) => setNewTask({...newTask, description: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Estimated Hours"
          keyboardType="numeric"
          value={newTask.estimatedHours.toString()}
          onChangeText={(text) => setNewTask({...newTask, estimatedHours: parseInt(text) || 0})}
        />
        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleCreateTask}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Task'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskDescription}>{item.description}</Text>
            <Text style={styles.taskInfo}>
              Status: {item.status} | Hours: {item.estimatedHours}
            </Text>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleCompleteTask(item.id)}
              >
                <Text style={styles.completeButtonText}>Complete Task</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
};

const App = () => {
  return (
    <SylosProvider
      apiKey="your-api-key"
      environment="production"
    >
      <WalletScreen />
      {/* <PoPScreen /> */}
    </SylosProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  walletList: {
    flex: 1
  },
  walletItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  selectedWallet: {
    borderColor: '#007AFF',
    borderWidth: 2
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  walletAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace'
  },
  balanceContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 16
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12
  },
  tokenBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  tokenSymbol: {
    fontWeight: '600',
    flex: 1
  },
  tokenAmount: {
    flex: 1,
    textAlign: 'center'
  },
  tokenValue: {
    flex: 1,
    textAlign: 'right',
    color: '#666'
  },
  createTaskContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8
  },
  taskItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  taskInfo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8
  },
  completeButton: {
    backgroundColor: '#34C759',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center'
  },
  completeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  }
});

export default App;
```

### 6.4 Backend Integration Guide

#### Node.js/Express Server
```javascript
// server.js
const express = require('express');
const { SylosSDK } = require('@sylos/sdk');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const sylos = new SylosSDK({
  apiKey: process.env.SYLOS_API_KEY,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging'
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify token with SylOS API
    const user = await sylos.auth.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get user wallet balance
app.get('/api/wallet/balance', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.query;
    
    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID required' });
    }

    const balance = await sylos.wallets.getBalance(walletId);
    res.json({ balance });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Create PoP task
app.post('/api/pop/tasks', authenticateToken, async (req, res) => {
  try {
    const taskData = req.body;
    const task = await sylos.pop.createTask(taskData);
    
    res.status(201).json({ task });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get productivity analytics
app.get('/api/pop/analytics', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const analytics = await sylos.pop.getAnalytics({ period });
    
    res.json({ analytics });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Upload file to IPFS
app.post('/api/files/upload', authenticateToken, async (req, res) => {
  try {
    const { fileData, metadata } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ error: 'File data required' });
    }

    const file = await sylos.files.upload({
      file: Buffer.from(fileData, 'base64'),
      ...metadata
    });
    
    res.status(201).json({ file });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// WebSocket integration for real-time updates
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Authenticate WebSocket connection
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'auth') {
        // Verify token
        const user = await sylos.auth.verifyToken(data.token);
        ws.userId = user.id;
        ws.send(JSON.stringify({ type: 'auth', success: true }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      ws.close();
    }
  });
  
  // Subscribe to real-time updates
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        if (data.channel === 'wallet') {
          // Set up wallet balance updates
          const walletId = data.params.walletId;
          
          // Start periodic balance checks
          const interval = setInterval(async () => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                const balance = await sylos.wallets.getBalance(walletId);
                ws.send(JSON.stringify({
                  type: 'balance_update',
                  data: balance
                }));
              } catch (error) {
                console.error('Balance update error:', error);
              }
            } else {
              clearInterval(interval);
            }
          }, 5000); // Update every 5 seconds
          
          ws.subscriptions = ws.subscriptions || [];
          ws.subscriptions.push(interval);
        }
      }
    } catch (error) {
      console.error('Subscription error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up subscriptions
    if (ws.subscriptions) {
      ws.subscriptions.forEach(interval => clearInterval(interval));
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
});
```

---

*[Note: Due to length limitations, the file continues with the remaining sections including code examples, Postman collection, developer onboarding, and changelog. The complete file would contain all these sections in detail.]*

---

## 10. Changelog & Versioning Strategy

### 10.1 Semantic Versioning

SylOS API follows [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** (X.0.0): Breaking changes that require migration
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### 10.2 Version History

#### v1.0.0 (2025-11-10)
- Initial public API release
- Core functionality: wallets, PoP tracker, file management, portfolio
- WebSocket real-time updates
- Smart contract integration
- Multi-platform SDKs

### 10.3 Deprecation Policy

- **Announcement**: 90 days before removal
- **Grace Period**: 90 days after announcement
- **Migration Guide**: Provided for all breaking changes
- **Support**: Continued for deprecated versions during grace period

### 10.4 Breaking Changes

Future breaking changes will be documented with:
- Migration instructions
- Code examples for updated implementations
- Timeline for deprecation
- Support resources

---

**End of API Documentation Package**

This comprehensive documentation provides everything needed to integrate with the SylOS blockchain operating system. For additional support, visit our developer portal at [docs.sylos.io](https://docs.sylos.io) or contact our developer relations team.
