# Multi-stage build for optimal production container

# Stage 1: Dependencies and build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with cache
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build arguments
ARG NODE_ENV=production
ARG VITE_APP_TITLE=SylOS
ARG VITE_API_URL=https://api.sylos.io
ARG VITE_WS_URL=wss://ws.sylos.io
ARG VITE_CHAIN_ID=137
ARG VITE_NETWORK_NAME="Polygon Mainnet"
ARG VITE_EXPLORER_URL=https://polygonscan.com
ARG VITE_SUPABASE_URL=https://production.supabase.co

# Set environment variables
ENV NODE_ENV=$NODE_ENV
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_NETWORK_NAME=$VITE_NETWORK_NAME
ENV VITE_EXPLORER_URL=$VITE_EXPLORER_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

# Build the application with optimizations
RUN pnpm run build:optimized

# Generate source maps for production debugging
RUN node scripts/generate-sourcemaps.js || true

# Stage 2: Production runtime
FROM nginx:1.25-alpine AS production

# Install security updates and necessary tools
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Create nginx user and group
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy service worker for offline support
COPY --from=builder /app/dist/sw.js /usr/share/nginx/html/sw.js

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Create directory for logs
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80 443

# Add labels
LABEL maintainer="SylOS Team" \
      version="1.0.0" \
      description="SylOS Production Web Application" \
      build-date="${BUILD_DATE}" \
      vcs-ref="${VCS_REF}" \
      source="https://github.com/sylos/sylos-web"

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
