# Production Deployment Automation System

## Table of Contents
1. [System Overview](#system-overview)
2. [Environment Management](#environment-management)
3. [Docker Containerization](#docker-containerization)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Database Migration](#database-migration)
7. [Environment Variables](#environment-variables)
8. [SSL Certificate Automation](#ssl-certificate-automation)
9. [Load Balancer Configuration](#load-balancer-configuration)
10. [Monitoring and Alerting](#monitoring-and-alerting)
11. [Rollback Procedures](#rollback-procedures)
12. [Blue-Green Deployment](#blue-green-deployment)
13. [Disaster Recovery](#disaster-recovery)
14. [Usage Examples](#usage-examples)

---

## System Overview

This production deployment automation system provides a complete end-to-end solution for deploying applications across multiple environments with high availability, security, and reliability.

### Architecture Components
- **Multi-stage Docker builds** for optimized container images
- **Kubernetes** for container orchestration
- **ArgoCD** for GitOps deployment automation
- **Prometheus + Grafana** for monitoring
- **Cert-manager** for SSL certificate automation
- **NGINX Ingress** for load balancing
- **PostgreSQL** with automatic failover
- **Redis** for caching and session management
- **Elasticsearch** for logging and monitoring

### Deployment Environments
- **Development** (`dev`): Local development and testing
- **Staging** (`staging`): Pre-production testing
- **Production** (`prod`): Live customer environment
- **Disaster Recovery** (`dr`): Backup production environment

---

## Environment Management

### Directory Structure
```
deployments/
├── scripts/
│   ├── deploy.sh
│   ├── rollback.sh
│   ├── health-check.sh
│   └── utils/
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── docker-compose.yml
├── kubernetes/
│   ├── base/
│   ├── overlays/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   └── helm/
├── database/
│   ├── migrations/
│   └── seeds/
└── configs/
    ├── nginx/
    ├── prometheus/
    └── cert-manager/
```

### Environment-Specific Configurations

### 1. Development Environment (`dev`)
- Single-node cluster for cost efficiency
- Local database for development
- Hot reload enabled
- Debug logging enabled
- Port forwarding for local access

### 2. Staging Environment (`staging`)
- Multi-node cluster for production parity
- Staging database with production-like data
- Performance monitoring enabled
- Security scanning
- Automated backup testing

### 3. Production Environment (`prod`)
- High-availability multi-zone cluster
- Production database with encryption
- Full monitoring and alerting
- Security hardening
- Automated backup and recovery

---

## Docker Containerization

### Multi-Stage Dockerfile

```dockerfile
# Dockerfile.prod
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy dependencies
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application
COPY --chown=nextjs:nodejs . .

# Build application
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["dumb-init", "node", "server.js"]
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:password@postgres:5432/app_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=app_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./configs/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./configs/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: your-registry/app:${VERSION:-latest}
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:${DB_PASSWORD}@postgres-cluster:5432/app_db
      - REDIS_URL=redis://redis-cluster:6379
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=app_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./configs/postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    networks:
      - app-network
    deploy:
      placement:
        constraints:
          - node.role == manager

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - app-network
    deploy:
      replicas: 3
      placement:
        constraints:
          - node.role == worker

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./configs/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./configs/nginx/ssl:/etc/nginx/ssl
    networks:
      - app-network
    deploy:
      replicas: 2

networks:
  app-network:
    driver: overlay
    attachable: true

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

---

## Kubernetes Deployment

### Base Deployment Manifest

```yaml
# kubernetes/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  labels:
    app: app
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: app
  template:
    metadata:
      labels:
        app: app
        version: v1
    spec:
      containers:
      - name: app
        image: your-registry/app:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: tmp
        emptyDir: {}
      - name: logs
        emptyDir: {}
      securityContext:
        fsGroup: 1001
      imagePullSecrets:
      - name: registry-secret
```

### Service Manifest

```yaml
# kubernetes/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service
  labels:
    app: app
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: app
```

### Ingress with TLS

```yaml
# kubernetes/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    secretName: app-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
  - host: www.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
```

### ConfigMap and Secrets

```yaml
# kubernetes/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  SESSION_SECRET: "change-me"
  FEATURE_FLAGS: |
    {
      "new_feature": true,
      "experimental_ui": false
    }
```

```yaml
# kubernetes/base/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  database-url: cG9zdGdyZXNxbDovL3VzZXI6cGFzc3dvcmRAcG9zdGdyZXMtc2VydmljZTo1NDMyL2FwcF9kYg==
  redis-url: cmVkaXM6Ly9yZWRpczpONjM5L2FwcA==
  jwt-secret: ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5
  api-key: YWJjZGVmZ2hpams=
```

### HorizontalPodAutoscaler

```yaml
# kubernetes/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app
  minReplicas: 3
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
```

### Environment-Specific Overrides

```yaml
# kubernetes/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- target:
    kind: Deployment
    name: app
  patch: |
    - op: replace
      path: /spec/replicas
      value: 1
- target:
    kind: ConfigMap
    name: app-config
  patch: |
    - op: replace
      path: /data/LOG_LEVEL
      value: "debug"
- target:
    kind: Service
    name: app-service
  patch: |
    - op: replace
      path: /spec/type
      value: "NodePort"
```

```yaml
# kubernetes/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- target:
    kind: Deployment
    name: app
  patch: |
    - op: replace
      path: /spec/replicas
      value: 10
- target:
    kind: HorizontalPodAutoscaler
    name: app-hpa
  patch: |
    - op: replace
      path: /spec/minReplicas
      value: 5
    - op: replace
      path: /spec/maxReplicas
      value: 50
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test -- --coverage
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ needs.build.outputs.image-tag }}
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-staging:
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.26.0'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Deploy to staging
      run: |
        kubectl set image deployment/app app=${{ needs.build.outputs.image-tag }} -n staging
        kubectl rollout status deployment/app -n staging --timeout=300s
    
    - name: Run smoke tests
      run: |
        sleep 30
        ./scripts/smoke-tests.sh staging
    
    - name: Notify deployment
      run: |
        curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
          -H 'Content-type: application/json' \
          --data '{"text":"Staging deployment successful: '${{ github.sha }}'"}'

  deploy-production:
    needs: [build, security-scan, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.26.0'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Deploy to production (Blue-Green)
      run: |
        ./scripts/blue-green-deploy.sh production ${{ needs.build.outputs.image-tag }}
    
    - name: Run health checks
      run: |
        ./scripts/health-check.sh production
    
    - name: Run post-deployment tests
      run: |
        ./scripts/post-deployment-tests.sh production
    
    - name: Notify production deployment
      run: |
        curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
          -H 'Content-type: application/json' \
          --data '{"text":"✅ Production deployment successful: '${{ github.sha }}'"}'

  rollback:
    needs: [deploy-production]
    runs-on: ubuntu-latest
    if: failure()
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.26.0'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Rollback deployment
      run: |
        ./scripts/rollback.sh production
    
    - name: Notify rollback
      run: |
        curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
          -H 'Content-type: application/json' \
          --data '{"text":"🔄 Production deployment failed, rolled back to previous version"}'
```

### ArgoCD Application

```yaml
# argocd/app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourorg/app-deployments
    targetRevision: main
    path: kubernetes/overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
  revisionHistoryLimit: 3
```

---

## Database Migration

### Migration Script

```bash
#!/bin/bash
# scripts/migrate.sh

set -e

ENVIRONMENT=${1:-staging}
MIGRATION_DIR="./database/migrations"
MAX_RETRIES=5
RETRY_DELAY=10

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting database migration for environment: $ENVIRONMENT"

# Get database connection details based on environment
case $ENVIRONMENT in
  dev)
    DB_URL="postgres://user:password@localhost:5432/app_dev"
    ;;
  staging)
    DB_URL="postgres://user:$STAGING_DB_PASSWORD@staging-db:5432/app_staging"
    ;;
  prod)
    DB_URL="postgres://user:$PROD_DB_PASSWORD@prod-db-cluster:5432/app_prod"
    ;;
  *)
    log "Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Wait for database to be ready
log "Waiting for database connection..."
for i in $(seq 1 $MAX_RETRIES); do
  if pg_isready -h "${DB_URL#*@}" -d "${DB_URL##*/}"; then
    log "Database connection successful"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    log "Failed to connect to database after $MAX_RETRIES attempts"
    exit 1
  fi
  log "Attempt $i failed, retrying in $RETRY_DELAY seconds..."
  sleep $RETRY_DELAY
done

# Create backup before migration
log "Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" > "backups/$BACKUP_FILE"
log "Backup created: $BACKUP_FILE"

# Run migrations
log "Running database migrations..."
for migration in $(ls -1 "$MIGRATION_DIR"/*.sql | sort); do
  log "Applying migration: $(basename $migration)"
  psql -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" -f "$migration" || {
    log "Migration failed: $(basename $migration)"
    log "Restoring from backup..."
    psql -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" < "backups/$BACKUP_FILE"
    exit 1
  }
done

# Verify migration
log "Verifying database schema..."
if psql -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" -c "SELECT version();" > /dev/null 2>&1; then
  log "Migration completed successfully"
else
  log "Migration verification failed"
  exit 1
fi

# Update schema version
log "Updating schema version..."
psql -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" -c "CREATE TABLE IF NOT EXISTS schema_migrations (id SERIAL PRIMARY KEY, version VARCHAR(255) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
psql -h "${DB_URL#*@}" -d "${DB_URL##*/}" -U "${DB_URL%%:*}" -c "INSERT INTO schema_migrations (version) VALUES ('$(date +%Y%m%d_%H%M%S)');"

log "Database migration completed successfully for $ENVIRONMENT"
```

### Sample Migration File

```sql
-- database/migrations/20231110_120000_create_users_table.sql
BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Kubernetes Migration Job

```yaml
# kubernetes/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: production
spec:
  ttlSecondsAfterFinished: 100
  backoffLimit: 3
  template:
    metadata:
      name: db-migration
    spec:
      restartPolicy: OnFailure
      containers:
      - name: migration
        image: postgres:14-alpine
        command:
        - /bin/bash
        - -c
        - |
          apk add --no-cache postgresql-client
          sleep 30  # Wait for database to be ready
          ./scripts/migrate.sh production
        env:
        - name: PROD_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-password
        volumeMounts:
        - name: scripts
          mountPath: /scripts
        - name: migrations
          mountPath: /migrations
      volumes:
      - name: scripts
        configMap:
          name: migration-scripts
      - name: migrations
        configMap:
          name: migration-files
```

---

## Environment Variables

### Environment Variable Management System

```yaml
# configs/env/env-manager.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-vars
data:
  # Application settings
  APP_ENV: "production"
  APP_NAME: "YourApp"
  APP_VERSION: "1.0.0"
  
  # Database settings
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "app_prod"
  DB_USER: "app_user"
  DB_POOL_MIN: "5"
  DB_POOL_MAX: "20"
  
  # Redis settings
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  REDIS_DB: "0"
  REDIS_TTL: "3600"
  
  # API settings
  API_RATE_LIMIT: "100"
  API_TIMEOUT: "30000"
  
  # Logging
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  LOG_OUTPUT: "stdout"
  
  # Security
  JWT_SECRET_KEY: "change-me-in-production"
  SESSION_SECRET: "change-me-in-production"
  ENCRYPTION_KEY: "change-me-in-production"
  
  # External services
  S3_BUCKET: "app-uploads-prod"
  S3_REGION: "us-west-2"
  SMTP_HOST: "smtp.gmail.com"
  SMTP_PORT: "587"
  SMTP_USER: "notifications@yourdomain.com"
  
  # Monitoring
  ENABLE_METRICS: "true"
  METRICS_PORT: "9090"
  TRACING_ENABLED: "true"
  ERROR_REPORTING_DSN: "https://error-reporting-dsn"
  
  # Feature flags
  FEATURE_NEW_UI: "true"
  FEATURE_API_V2: "false"
  FEATURE_ANALYTICS: "true"
```

### Secret Management

```bash
#!/bin/bash
# scripts/generate-secrets.sh

set -e

# Generate random secrets
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
API_KEY=$(openssl rand -hex 16)

# Create Kubernetes secret
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=session-secret="$SESSION_SECRET" \
  --from-literal=encryption-key="$ENCRYPTION_KEY" \
  --from-literal=api-key="$API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets generated and applied to cluster"
```

### Environment Variable Validation

```bash
#!/bin/bash
# scripts/validate-env.sh

validate_env() {
    local env_var=$1
    local required=$2
    
    if [ "$required" = "true" ] && [ -z "${!env_var}" ]; then
        echo "Error: Required environment variable $env_var is not set"
        return 1
    fi
    return 0
}

# Validate required environment variables
validate_env "DATABASE_URL" "true"
validate_env "REDIS_URL" "true"
validate_env "JWT_SECRET" "true"
validate_env "SESSION_SECRET" "true"

echo "Environment validation passed"
```

---

## SSL Certificate Automation

### Cert-Manager Configuration

```yaml
# cert-manager/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
          podTemplate:
            spec:
              nodeSelector:
                "kubernetes.io/os": linux
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Certificate Management Script

```bash
#!/bin/bash
# scripts/manage-ssl.sh

ENVIRONMENT=${1:-prod}
DOMAIN=${2:-yourdomain.com}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

case $ENVIRONMENT in
  staging)
    ISSUER="letsencrypt-staging"
    ;;
  prod)
    ISSUER="letsencrypt-prod"
    ;;
  *)
    log "Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

log "Managing SSL certificate for $DOMAIN in $ENVIRONMENT"

# Check if certificate exists
if kubectl get certificate app-tls -n production &>/dev/null; then
    log "Certificate exists, checking validity..."
    kubectl describe certificate app-tls -n production
else
    log "Certificate does not exist, creating..."
    kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: app-tls
  namespace: production
spec:
  secretName: app-tls
  issuerRef:
    name: $ISSUER
    kind: ClusterIssuer
  dnsNames:
  - $DOMAIN
  - www.$DOMAIN
EOF
fi

# Monitor certificate status
log "Monitoring certificate status..."
for i in {1..30}; do
    READY=$(kubectl get certificate app-tls -n production -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    if [ "$READY" = "True" ]; then
        log "Certificate is ready!"
        break
    fi
    log "Waiting for certificate... ($i/30)"
    sleep 10
done

if [ "$READY" != "True" ]; then
    log "Certificate provisioning failed"
    kubectl describe certificate app-tls -n production
    exit 1
fi

# Check certificate expiration
EXPIRY=$(kubectl get certificate app-tls -n production -o jsonpath='{.status.notAfter}')
log "Certificate expires at: $EXPIRY"

log "SSL certificate management completed"
```

### Manual Certificate Import

```bash
#!/bin/bash
# scripts/import-cert.sh

CERT_PATH=$1
KEY_PATH=$2
SECRET_NAME=${3:-app-tls}
NAMESPACE=${4:-production}

if [ -z "$CERT_PATH" ] || [ -z "$KEY_PATH" ]; then
    echo "Usage: $0 <cert-path> <key-path> [secret-name] [namespace]"
    exit 1
fi

log "Importing certificate to Kubernetes..."
kubectl create secret tls $SECRET_NAME \
    --cert=$CERT_PATH \
    --key=$KEY_PATH \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

log "Certificate imported successfully"
```

---

## Load Balancer Configuration

### NGINX Load Balancer

```nginx
# configs/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app_backend {
        least_conn;
        server app-service-1:80 max_fails=3 fail_timeout=30s;
        server app-service-2:80 max_fails=3 fail_timeout=30s;
        server app-service-3:80 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Health check endpoint
    server {
        listen 80;
        server_name _;
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }

    # Main application server
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        limit_req zone=login burst=5 nodelay;

        # Main application
        location / {
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
        }

        # API endpoints with stricter rate limiting
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Auth endpoints
        location /auth/ {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location /static/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://app_backend;
        }

        # Health check
        location /health {
            access_log off;
            proxy_pass http://app_backend;
        }
    }
}
```

### Cloud Load Balancer (AWS)

```yaml
# configs/aws/load-balancer.yaml
apiVersion: v1
kind: Service
metadata:
  name: app-load-balancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "http"
    service.beta.kubernetes.io/aws-load-balancer-ssl-cert: "arn:aws:acm:region:account:certificate/cert-id"
    service.beta.kubernetes.io/aws-load-balancer-ssl-ports: "https"
    service.beta.kubernetes.io/aws-load-balancer-connection-draining-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-connection-draining-timeout: "60"
    service.beta.kubernetes.io/aws-load-balancer-additional-resource-tags: "Environment=production,Owner=DevOps"
spec:
  type: LoadBalancer
  loadBalancerSourceRanges:
  - 0.0.0.0/0
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  - port: 443
    targetPort: 3000
    protocol: TCP
    name: https
  selector:
    app: app
```

---

## Monitoring and Alerting

### Prometheus Configuration

```yaml
# configs/prometheus/prometheus.yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    replica: 'prometheus-1'

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  - job_name: 'app'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: app
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
```

### Alert Rules

```yaml
# configs/prometheus/rules/app-alerts.yml
groups:
- name: application
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time"
      description: "95th percentile response time is {{ $value }}s"

  - alert: DatabaseConnectionHigh
    expr: database_connections_active / database_connections_max > 0.8
    for: 3m
    labels:
      severity: warning
    annotations:
      summary: "High database connection usage"
      description: "Database connection usage is at {{ $value | humanizePercentage }}"

  - alert: PodCrashLooping
    expr: rate(kube_pod_container_status_restarts_total[10m]) * 60 * 10 > 3
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Pod is crash looping"
      description: "Pod {{ $labels.pod }} is crash looping"

  - alert: HighMemoryUsage
    expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is above 85%"

  - alert: HighCPUUsage
    expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is above 80% for more than 5 minutes"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "Application Dashboard",
    "tags": ["production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (status)",
            "legendFormat": "{{status}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

### Monitoring Script

```bash
#!/bin/bash
# scripts/monitoring-setup.sh

ENVIRONMENT=${1:-production}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Setting up monitoring for $ENVIRONMENT"

# Deploy Prometheus
log "Deploying Prometheus..."
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
kubectl apply -f configs/prometheus/prometheus.yaml
kubectl apply -f configs/prometheus/rules/

# Deploy Grafana
log "Deploying Grafana..."
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana \
  --set adminPassword=admin \
  --set persistence.enabled=true \
  --set persistence.size=10Gi

# Deploy AlertManager
log "Deploying AlertManager..."
kubectl apply -f configs/alertmanager/alertmanager.yaml

# Deploy node-exporter
log "Deploying node-exporter..."
kubectl apply -f https://github.com/prometheus-operator/prometheus-operator/releases/download/prometheus-operator-v0.65.1/node-exporter.yaml

# Create monitoring namespace
log "Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

log "Monitoring setup completed"
log "Grafana URL: $(kubectl get svc grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
log "Prometheus URL: $(kubectl get svc prometheus -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
```

---

## Rollback Procedures

### Automated Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

ENVIRONMENT=${1:-production}
MAX_ROLLBACK_VERSIONS=${2:-5}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting rollback procedure for $ENVIRONMENT"

# Get current deployment
CURRENT_DEPLOYMENT=$(kubectl get deployment app -n $ENVIRONMENT -o jsonpath='{.metadata.name}')
CURRENT_REPLICA=$(kubectl get deployment app -n $ENVIRONMENT -o jsonpath='{.status.replicas}')
AVAILABLE_REPLICA=$(kubectl get deployment app -n $ENVIRONMENT -o jsonpath='{.status.availableReplicas}')

log "Current deployment: $CURRENT_DEPLOYMENT"
log "Current replicas: $CURRENT_REPLICA, Available: $AVAILABLE_REPLICA"

# Check if deployment is healthy
if [ "$AVAILABLE_REPLICA" -eq 0 ]; then
    log "ERROR: No available replicas. Cannot perform rollback."
    exit 1
fi

# Get deployment history
log "Fetching deployment history..."
HISTORY=$(kubectl rollout history deployment/app -n $ENVIRONMENT)
echo "$HISTORY"

# Get the last successful revision
LAST_REVISION=$(kubectl rollout history deployment/app -n $ENVIRONMENT | grep -E '^[0-9]+' | tail -n 2 | head -n 1 | awk '{print $1}')

if [ -z "$LAST_REVISION" ]; then
    log "ERROR: No previous revision found for rollback"
    exit 1
fi

log "Rolling back to revision: $LAST_REVISION"

# Perform rollback
if kubectl rollout undo deployment/app --to-revision=$LAST_REVISION -n $ENVIRONMENT; then
    log "Rollback initiated successfully"
else
    log "ERROR: Rollback failed"
    exit 1
fi

# Monitor rollback progress
log "Monitoring rollback progress..."
if kubectl rollout status deployment/app -n $ENVIRONMENT --timeout=300s; then
    log "Rollback completed successfully"
    
    # Run health check
    log "Running health check after rollback..."
    if ./scripts/health-check.sh $ENVIRONMENT; then
        log "Health check passed - rollback successful"
        
        # Update deployment annotations
        kubectl annotate deployment/app -n $ENVIRONMENT \
            deployment.kubernetes.io/revision="$(kubectl get deployment app -n $ENVIRONMENT -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')" \
            last-rollback="$(date +%Y-%m-%d_%H-%M-%S)" --overwrite
        
        # Notify rollback
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Rollback completed successfully in $ENVIRONMENT environment\"}"
    else
        log "ERROR: Health check failed after rollback"
        exit 1
    fi
else
    log "ERROR: Rollback status check failed"
    
    # Emergency notification
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 CRITICAL: Rollback failed in $ENVIRONMENT - Manual intervention required\"}"
    exit 1
fi

log "Rollback procedure completed"
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

ENVIRONMENT=${1:-production}
MAX_RETRIES=30
RETRY_DELAY=10

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Get service endpoint
case $ENVIRONMENT in
  dev)
    ENDPOINT="http://localhost:3000"
    ;;
  staging)
    ENDPOINT="https://staging.yourdomain.com"
    ;;
  prod)
    ENDPOINT="https://yourdomain.com"
    ;;
  *)
    log "Invalid environment: $ENVIRONMENT"
    exit 1
    ;;
esac

log "Running health check for $ENVIRONMENT at $ENDPOINT"

# Check if endpoint is accessible
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "$ENDPOINT/health" > /dev/null; then
        log "Health check endpoint accessible"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        log "ERROR: Health check endpoint not accessible after $MAX_RETRIES attempts"
        exit 1
    fi
    
    log "Attempt $i failed, retrying in $RETRY_DELAY seconds..."
    sleep $RETRY_DELAY
done

# Run comprehensive health checks
log "Running comprehensive health checks..."

# Check 1: Health endpoint
log "Checking health endpoint..."
HEALTH_RESPONSE=$(curl -s "$ENDPOINT/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    log "✓ Health endpoint: OK"
else
    log "✗ Health endpoint: FAILED"
    exit 1
fi

# Check 2: API endpoint
log "Checking API endpoint..."
if curl -f -s "$ENDPOINT/api/health" > /dev/null; then
    log "✓ API endpoint: OK"
else
    log "✗ API endpoint: FAILED"
    exit 1
fi

# Check 3: Database connectivity
log "Checking database connectivity..."
if kubectl exec -n $ENVIRONMENT deployment/app -- \
    node -e "require('./health-check').checkDatabase()" > /dev/null 2>&1; then
    log "✓ Database connectivity: OK"
else
    log "✗ Database connectivity: FAILED"
    exit 1
fi

# Check 4: Redis connectivity
log "Checking Redis connectivity..."
if kubectl exec -n $ENVIRONMENT deployment/app -- \
    node -e "require('./health-check').checkRedis()" > /dev/null 2>&1; then
    log "✓ Redis connectivity: OK"
else
    log "✗ Redis connectivity: FAILED"
    exit 1
fi

# Check 5: Pod status
log "Checking pod status..."
READY_PODS=$(kubectl get pods -n $ENVIRONMENT -l app=app -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | tr ' ' '\n' | grep -c "True")
TOTAL_PODS=$(kubectl get pods -n $ENVIRONMENT -l app=app --no-headers | wc -l)

if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
    log "✓ Pod status: $READY_PODS/$TOTAL_PODS ready"
else
    log "✗ Pod status: $READY_PODS/$TOTAL_PODS ready"
    exit 1
fi

# Check 6: Resource usage
log "Checking resource usage..."
CPU_USAGE=$(kubectl top pods -n $ENVIRONMENT -l app=app | tail -n +2 | awk '{sum+=$3} END {print sum}')
if [ "$CPU_USAGE" -lt 500 ]; then
    log "✓ Resource usage: OK (${CPU_USAGE}m CPU total)"
else
    log "⚠ Resource usage: High (${CPU_USAGE}m CPU total)"
fi

log "All health checks passed successfully"
exit 0
```

### Emergency Rollback

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

ENVIRONMENT=${1:-production}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "EMERGENCY ROLLBACK initiated for $ENVIRONMENT"

# Immediate notification
curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"🚨 EMERGENCY ROLLBACK initiated for $ENVIRONMENT\"}"

# Get previous working image
PREVIOUS_IMAGE=$(kubectl get deployment app -n $ENVIRONMENT -o jsonpath='{.spec.template.spec.containers[0].image}')
log "Previous working image: $PREVIOUS_IMAGE"

if [ -z "$PREVIOUS_IMAGE" ]; then
    log "ERROR: Cannot determine previous working image"
    exit 1
fi

# Scale down current deployment
log "Scaling down current deployment..."
kubectl scale deployment app --replicas=0 -n $ENVIRONMENT

# Wait for scale down
sleep 10

# Update to previous image
log "Updating to previous image: $PREVIOUS_IMAGE"
kubectl set image deployment/app app=$PREVIOUS_IMAGE -n $ENVIRONMENT

# Scale back up
log "Scaling back up..."
kubectl scale deployment app --replicas=3 -n $ENVIRONMENT

# Monitor rollout
if kubectl rollout status deployment/app -n $ENVIRONMENT --timeout=300s; then
    log "Emergency rollback completed successfully"
    
    # Run health check
    if ./scripts/health-check.sh $ENVIRONMENT; then
        log "Health check passed after emergency rollback"
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Emergency rollback successful for $ENVIRONMENT\"}"
    else
        log "ERROR: Health check failed after emergency rollback"
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Emergency rollback completed but health checks failed - $ENVIRONMENT\"}"
        exit 1
    fi
else
    log "ERROR: Emergency rollback failed"
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 EMERGENCY ROLLBACK FAILED - $ENVIRONMENT\"}"
    exit 1
fi
```

---

## Blue-Green Deployment

### Blue-Green Deployment Script

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

ENVIRONMENT=${1:-production}
NEW_IMAGE=${2}
SERVICE_NAME="app"
NAMESPACE=$ENVIRONMENT

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ -z "$NEW_IMAGE" ]; then
    log "ERROR: New image tag is required"
    exit 1
fi

log "Starting blue-green deployment for $ENVIRONMENT"
log "New image: $NEW_IMAGE"

# Determine current active color
CURRENT_COLOR=$(kubectl get service $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")
NEXT_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

log "Current active environment: $CURRENT_COLOR"
log "Deploying to: $NEXT_COLOR"

# Create namespace for new environment
kubectl create namespace $NAMESPACE-$NEXT_COLOR --dry-run=client -o yaml | kubectl apply -f -

# Update Kustomize with new image and color
log "Updating deployment configuration..."
kubectl set image deployment/$SERVICE_NAME-$NEXT_COLOR \
    app=$NEW_IMAGE \
    -n $NAMESPACE-$NEXT_COLOR

# Apply labels with color
kubectl label deployment/$SERVICE_NAME-$NEXT_COLOR \
    color=$NEXT_COLOR \
    -n $NAMESPACE-$NEXT_COLOR --overwrite

# Wait for deployment to be ready
log "Waiting for $NEXT_COLOR environment to be ready..."
if kubectl rollout status deployment/$SERVICE_NAME-$NEXT_COLOR -n $NAMESPACE-$NEXT_COLOR --timeout=600s; then
    log "$NEXT_COLOR environment is ready"
else
    log "ERROR: $NEXT_COLOR environment failed to become ready"
    kubectl logs deployment/$SERVICE_NAME-$NEXT_COLOR -n $NAMESPACE-$NEXT_COLOR --tail=50
    exit 1
fi

# Run smoke tests on new environment
log "Running smoke tests on $NEXT_COLOR environment..."
TEMP_SERVICE_NAME="$SERVICE_NAME-temp"
TEMP_NAMESPACE="$NAMESPACE-$NEXT_COLOR"

# Create temporary service for testing
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: $TEMP_SERVICE_NAME
  namespace: $TEMP_NAMESPACE
spec:
  type: ClusterIP
  selector:
    app: $SERVICE_NAME
    color: $NEXT_COLOR
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
EOF

# Port-forward for testing
log "Setting up port-forward for testing..."
kubectl port-forward service/$TEMP_SERVICE_NAME 8080:80 -n $TEMP_NAMESPACE &
PORT_FORWARD_PID=$!

sleep 10

# Run tests
if ./scripts/smoke-tests.sh http://localhost:8080; then
    log "Smoke tests passed on $NEXT_COLOR environment"
    
    # Kill port-forward
    kill $PORT_FORWARD_PID 2>/dev/null
    
    # Switch traffic to new environment
    log "Switching traffic to $NEXT_COLOR environment..."
    
    # Update main service selector
    kubectl patch service $SERVICE_NAME -n $NAMESPACE -p \
        "{\"spec\":{\"selector\":{\"color\":\"$NEXT_COLOR\",\"app\":\"$SERVICE_NAME\"}}}"
    
    # Wait for traffic switch
    sleep 30
    
    # Verify traffic is flowing
    log "Verifying traffic switch..."
    if curl -f -s https://yourdomain.com/health > /dev/null; then
        log "Traffic switch successful"
        
        # Clean up old environment
        log "Cleaning up old $CURRENT_COLOR environment..."
        kubectl delete namespace $NAMESPACE-$CURRENT_COLOR --ignore-not-found=true
        
        # Update deployment annotation
        kubectl annotate deployment/$SERVICE_NAME-$NEXT_COLOR \
            -n $NAMESPACE-$NEXT_COLOR \
            last-blue-green-deployment=$(date +%Y-%m-%d_%H-%M-%S) \
            --overwrite
        
        log "Blue-green deployment completed successfully"
        
        # Send notification
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Blue-green deployment successful: Switched from $CURRENT_COLOR to $NEXT_COLOR in $ENVIRONMENT\"}"
        
    else
        log "ERROR: Traffic switch verification failed"
        kill $PORT_FORWARD_PID 2>/dev/null
        exit 1
    fi
    
else
    log "ERROR: Smoke tests failed on $NEXT_COLOR environment"
    kill $PORT_FORWARD_PID 2>/dev/null
    
    # Clean up failed deployment
    log "Cleaning up failed $NEXT_COLOR deployment..."
    kubectl delete namespace $NAMESPACE-$NEXT_COLOR --ignore-not-found=true
    
    # Send failure notification
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"❌ Blue-green deployment failed: Smoke tests failed for $NEXT_COLOR in $ENVIRONMENT\"}"
    
    exit 1
fi
```

### Blue-Green Service Definition

```yaml
# kubernetes/base/blue-green-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app
  labels:
    app: app
spec:
  type: LoadBalancer
  selector:
    app: app
    color: blue  # Will be updated during deployment
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
```

### Smoke Test Script

```bash
#!/bin/bash
# scripts/smoke-tests.sh

ENDPOINT=${1:-http://localhost:3000}
MAX_RETRIES=5
RETRY_DELAY=5

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Running smoke tests against $ENDPOINT"

# Test 1: Health endpoint
log "Test 1: Health endpoint"
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "$ENDPOINT/health" > /dev/null; then
        log "✓ Health endpoint: OK"
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        log "✗ Health endpoint: FAILED"
        exit 1
    fi
    sleep $RETRY_DELAY
done

# Test 2: API endpoint
log "Test 2: API endpoint"
if curl -f -s "$ENDPOINT/api/users" > /dev/null; then
    log "✓ API endpoint: OK"
else
    log "✗ API endpoint: FAILED"
    exit 1
fi

# Test 3: Static assets
log "Test 3: Static assets"
if curl -f -s -I "$ENDPOINT/static/app.js" | grep -q "200 OK"; then
    log "✓ Static assets: OK"
else
    log "✗ Static assets: FAILED"
    exit 1
fi

# Test 4: Database operations
log "Test 4: Database operations"
RESPONSE=$(curl -s -X POST "$ENDPOINT/api/test-db" \
    -H "Content-Type: application/json" \
    -d '{"test": true}')
if echo "$RESPONSE" | grep -q '"status":"success"'; then
    log "✓ Database operations: OK"
else
    log "✗ Database operations: FAILED"
    exit 1
fi

# Test 5: Performance check
log "Test 5: Performance check"
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$ENDPOINT/health")
if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    log "✓ Performance check: OK (${RESPONSE_TIME}s)"
else
    log "✗ Performance check: FAILED (${RESPONSE_TIME}s)"
    exit 1
fi

log "All smoke tests passed successfully"
exit 0
```

---

## Disaster Recovery

### Disaster Recovery Plan

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

ENVIRONMENT=${1:-production}
BACKUP_LOCATION=${2:-s3://app-backups-prod}
RECOVERY_POINT=${3:-latest}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting disaster recovery procedure for $ENVIRONMENT"
log "Backup location: $BACKUP_LOCATION"
log "Recovery point: $RECOVERY_POINT"

# Step 1: Assess disaster
log "Step 1: Assessing disaster impact..."
DISASTER_TYPE=${4:-unknown}
case $DISASTER_TYPE in
  "database")
    log "Database disaster detected"
    ;;
  "application")
    log "Application disaster detected"
    ;;
  "infrastructure")
    log "Infrastructure disaster detected"
    ;;
  *)
    log "Unknown disaster type"
    ;;
esac

# Step 2: Activate disaster recovery site
log "Step 2: Activating disaster recovery site..."
if kubectl config get-contexts | grep -q "dr-cluster"; then
    kubectl config use-context dr-cluster
    log "Switched to disaster recovery cluster"
else
    log "ERROR: Disaster recovery cluster not found"
    exit 1
fi

# Step 3: Restore database
log "Step 3: Restoring database..."
BACKUP_FILE=$(aws s3 ls $BACKUP_LOCATION/database/ | grep "$RECOVERY_POINT" | head -1 | awk '{print $4}')
if [ -z "$BACKUP_FILE" ]; then
    log "No backup found for recovery point: $RECOVERY_POINT"
    exit 1
fi

log "Restoring from backup: $BACKUP_FILE"
aws s3 cp "$BACKUP_LOCATION/database/$BACKUP_FILE" - | psql $DB_URL

# Step 4: Deploy application from backup
log "Step 4: Deploying application..."
kubectl apply -f configs/kubernetes/overlays/dr/

# Wait for deployment
log "Waiting for application deployment..."
kubectl rollout status deployment/app -n $ENVIRONMENT --timeout=300s

# Step 5: Verify recovery
log "Step 5: Verifying disaster recovery..."
if ./scripts/health-check.sh $ENVIRONMENT; then
    log "Disaster recovery verification successful"
    
    # Step 6: Update DNS
    log "Step 6: Updating DNS to disaster recovery site..."
    ./scripts/update-dns.sh dr
    
    log "Disaster recovery completed successfully"
    
    # Send notification
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Disaster recovery completed for $ENVIRONMENT\"}"
    
else
    log "ERROR: Disaster recovery verification failed"
    exit 1
fi
```

### Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

ENVIRONMENT=${1:-production}
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$ENVIRONMENT/$BACKUP_TIMESTAMP"
S3_BUCKET="app-backups-$ENVIRONMENT"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup for $ENVIRONMENT environment"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
log "Backing up database..."
kubectl exec -n $ENVIRONMENT deployment/postgres -- \
    pg_dump -U postgres app_prod > "$BACKUP_DIR/database.sql"
gzip "$BACKUP_DIR/database.sql"

# Application code backup
log "Backing up application code..."
tar -czf "$BACKUP_DIR/application.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    .

# Kubernetes resources backup
log "Backing up Kubernetes resources..."
kubectl get all,configmaps,secrets,pvc -n $ENVIRONMENT -o yaml > "$BACKUP_DIR/kubernetes-resources.yaml"

# Configurations backup
log "Backing up configurations..."
cp -r configs/ "$BACKUP_DIR/"

# Upload to S3
log "Uploading backup to S3..."
aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/"

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$BACKUP_TIMESTAMP",
    "database_size": "$(stat -f%z "$BACKUP_DIR/database.sql.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/database.sql.gz")",
    "application_size": "$(stat -f%z "$BACKUP_DIR/application.tar.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/application.tar.gz")",
    "kubernetes_resources": true,
    "configurations": true
}
EOF

aws s3 cp "$BACKUP_DIR/manifest.json" "s3://$S3_BUCKET/"

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups..."
aws s3 ls "s3://$S3_BUCKET/" | while read -r line; do
    BACKUP_DATE=$(echo $line | awk '{print $1}')
    if [ $(($(date +%s) - $(date -d "$BACKUP_DATE" +%s))) -gt 604800 ]; then
        aws s3 rm "s3://$S3_BUCKET/$BACKUP_DATE" --recursive
    fi
done

log "Backup completed successfully"
log "Backup location: s3://$S3_BUCKET/$BACKUP_TIMESTAMP"

# Verify backup
log "Verifying backup integrity..."
if [ -f "$BACKUP_DIR/database.sql.gz" ] && [ -f "$BACKUP_DIR/application.tar.gz" ]; then
    log "Backup verification successful"
else
    log "ERROR: Backup verification failed"
    exit 1
fi
```

### Database Recovery Script

```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE=$1
TARGET_ENVIRONMENT=${2:-production}
DB_URL=${3:-}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ -z "$BACKUP_FILE" ]; then
    log "ERROR: Backup file path is required"
    log "Usage: $0 <backup-file> [target-environment] [db-url]"
    exit 1
fi

log "Starting database restore for $TARGET_ENVIRONMENT"
log "Backup file: $BACKUP_FILE"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create backup of current state
log "Creating backup of current database state..."
CURRENT_BACKUP="current_backup_$(date +%Y%m%d_%H%M%S).sql"
kubectl exec -n $TARGET_ENVIRONMENT deployment/postgres -- \
    pg_dump -U postgres app_prod > "$CURRENT_BACKUP"

# Drop and recreate database
log "Preparing database for restore..."
kubectl exec -n $TARGET_ENVIRONMENT deployment/postgres -- \
    psql -U postgres -c "DROP DATABASE IF EXISTS app_prod;"
kubectl exec -n $TARGET_ENVIRONMENT deployment/postgres -- \
    psql -U postgres -c "CREATE DATABASE app_prod;"

# Restore from backup
log "Restoring from backup..."
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | kubectl exec -i -n $TARGET_ENVIRONMENT deployment/postgres -- \
        psql -U postgres app_prod
else
    kubectl exec -i -n $TARGET_ENVIRONMENT deployment/postgres -- \
        psql -U postgres app_prod < "$BACKUP_FILE"
fi

# Verify restore
log "Verifying database restore..."
if kubectl exec -n $TARGET_ENVIRONMENT deployment/postgres -- \
    psql -U postgres -d app_prod -c "\dt" | grep -q "users"; then
    log "Database restore completed successfully"
else
    log "ERROR: Database restore verification failed"
    log "Restoring from current backup..."
    kubectl exec -i -n $TARGET_ENVIRONMENT deployment/postgres -- \
        psql -U postgres app_prod < "$CURRENT_BACKUP"
    exit 1
fi

log "Database restore completed for $TARGET_ENVIRONMENT"
```

### DNS Failover Script

```bash
#!/bin/bash
# scripts/dns-failover.sh

TARGET_ENVIRONMENT=${1:-dr}
DOMAIN=${2:-yourdomain.com}
AWS_PROFILE=${3:-default}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting DNS failover to $TARGET_ENVIRONMENT"

# Get load balancer IP for target environment
case $TARGET_ENVIRONMENT in
  "dr")
    TARGET_IP=$(kubectl get service app-load-balancer -n disaster-recovery -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    ;;
  "backup")
    TARGET_IP=$(kubectl get service app-load-balancer -n backup -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    ;;
  *)
    log "Unknown target environment: $TARGET_ENVIRONMENT"
    exit 1
    ;;
esac

if [ -z "$TARGET_IP" ]; then
    log "ERROR: Could not determine target IP address"
    exit 1
fi

log "Target IP: $TARGET_IP"

# Update Route53 record
log "Updating DNS record..."
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name $DOMAIN --profile $AWS_PROFILE --query 'HostedZones[0].Id' --output text)

aws route53 change-resource-record-sets \
    --hosted-zone-id $ZONE_ID \
    --profile $AWS_PROFILE \
    --change-batch '{
        "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "'$DOMAIN'",
                "Type": "A",
                "TTL": 60,
                "ResourceRecords": [{"Value": "'$TARGET_IP'"}]
            }
        }]
    }'

# Verify DNS change
log "Verifying DNS change..."
sleep 30
RESOLVED_IP=$(dig +short $DOMAIN)

if [ "$RESOLVED_IP" = "$TARGET_IP" ]; then
    log "DNS failover completed successfully"
    
    # Send notification
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ DNS failover completed: $DOMAIN now points to $TARGET_IP\"}"
else
    log "ERROR: DNS failover verification failed"
    log "Expected: $TARGET_IP, Got: $RESOLVED_IP"
    exit 1
fi
```

---

## Usage Examples

### Complete Deployment Flow

```bash
#!/bin/bash
# Complete deployment example

# 1. Build and push Docker image
./scripts/build-and-push.sh v1.2.3

# 2. Deploy to staging
./scripts/deploy.sh staging v1.2.3

# 3. Run integration tests
./scripts/run-integration-tests.sh staging

# 4. Deploy to production (blue-green)
./scripts/blue-green-deploy.sh production registry.app.com/app:v1.2.3

# 5. Monitor deployment
./scripts/monitor-deployment.sh production

# 6. Run post-deployment verification
./scripts/post-deployment-verification.sh production
```

### Quick Development Setup

```bash
#!/bin/bash
# Development environment setup

# 1. Start local environment
docker-compose -f docker-compose.yml up -d

# 2. Run database migrations
./scripts/migrate.sh dev

# 3. Seed development data
./scripts/seed-data.sh dev

# 4. Start development server
npm run dev
```

### Production Deployment

```bash
#!/bin/bash
# Production deployment

# 1. Create backup
./scripts/backup.sh prod

# 2. Run database migrations
kubectl apply -f kubernetes/migration-job.yaml

# 3. Deploy new version
./scripts/deploy.sh prod v1.2.3

# 4. Monitor deployment
kubectl get pods -n prod -w

# 5. Run health checks
./scripts/health-check.sh prod
```

### Emergency Rollback

```bash
#!/bin/bash
# Emergency rollback

# 1. Initiate emergency rollback
./scripts/emergency-rollback.sh prod

# 2. Verify rollback
./scripts/health-check.sh prod

# 3. Notify team
./scripts/notify-team.sh "Emergency rollback completed in production"
```

### Disaster Recovery

```bash
#!/bin/bash
# Disaster recovery

# 1. Activate disaster recovery
./scripts/disaster-recovery.sh prod s3://app-backups-prod latest database

# 2. Update DNS
./scripts/dns-failover.sh dr yourdomain.com

# 3. Verify recovery
./scripts/health-check.sh dr
```

---

## Best Practices

### Security
1. **Secrets Management**: Always use Kubernetes secrets for sensitive data
2. **Image Scanning**: Scan all container images for vulnerabilities
3. **Network Policies**: Implement network segmentation
4. **RBAC**: Use role-based access control
5. **Pod Security**: Use security contexts and pod security policies

### Reliability
1. **Health Checks**: Implement comprehensive health checks
2. **Circuit Breakers**: Use circuit breakers for external dependencies
3. **Retry Logic**: Implement exponential backoff for retries
4. **Graceful Shutdown**: Handle SIGTERM properly
5. **Resource Limits**: Set appropriate resource limits

### Monitoring
1. **Metrics Collection**: Collect application and infrastructure metrics
2. **Log Aggregation**: Centralize logging with ELK or similar
3. **Alerting**: Set up meaningful alerts with proper thresholds
4. **Tracing**: Implement distributed tracing
5. **Dashboarding**: Create comprehensive monitoring dashboards

### Deployment
1. **Blue-Green Deployments**: Use for zero-downtime deployments
2. **Canary Releases**: Test new versions with a small subset of traffic
3. **Automated Rollbacks**: Implement automatic rollback on failures
4. **Database Migrations**: Always backup before migrations
5. **Feature Flags**: Use feature flags for safer deployments

### Documentation
1. **Runbooks**: Maintain detailed operational runbooks
2. **Architecture Diagrams**: Keep architecture documentation updated
3. **API Documentation**: Document all APIs
4. **Troubleshooting Guides**: Create troubleshooting guides
5. **Training**: Provide training for team members

---

## Maintenance

### Regular Tasks
- **Daily**: Review error logs and performance metrics
- **Weekly**: Check backup integrity and test restores
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and update disaster recovery procedures
- **Annually**: Full disaster recovery testing

### Monitoring Checklist
- [ ] All services are healthy
- [ ] Error rates are within thresholds
- [ ] Response times are acceptable
- [ ] Database connections are healthy
- [ ] Disk space is sufficient
- [ ] Memory usage is normal
- [ ] CPU usage is normal
- [ ] Network latency is acceptable
- [ ] Backup jobs completed successfully
- [ ] SSL certificates are valid

### Security Checklist
- [ ] All secrets are properly secured
- [ ] TLS certificates are valid and up to date
- [ ] No security vulnerabilities in dependencies
- [ ] Access controls are properly configured
- [ ] Network policies are in place
- [ ] Container images are scanned
- [ ] No privileged containers are running
- [ ] Audit logs are being collected
- [ ] Security patches are applied
- [ ] Incident response plan is tested

---

This comprehensive production deployment automation system provides a complete solution for deploying, managing, and maintaining applications in production environments with high availability, security, and reliability.
