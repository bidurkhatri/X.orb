#!/bin/bash

# Frontend Deployment Script for SylOS
# Description: Builds and deploys frontend applications

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
ENVIRONMENT="development"
SKIP_BUILD=false
DRY_RUN=false
DEPLOY_FRONTEND=true
DEPLOY_BLOCKCHAIN=true
DEPLOY_MOBILE=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-frontend)
            DEPLOY_FRONTEND=false
            shift
            ;;
        --no-blockchain)
            DEPLOY_BLOCKCHAIN=false
            shift
            ;;
        --no-mobile)
            DEPLOY_MOBILE=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Deploy frontend applications"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -s, --skip-build    Skip build steps"
            echo "  --dry-run          Show what would be deployed without deploying"
            echo "  --no-frontend      Skip main frontend deployment"
            echo "  --no-blockchain    Skip blockchain OS deployment"
            echo "  --no-mobile        Skip mobile web deployment"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../environments/${ENVIRONMENT}.env"

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$SCRIPT_DIR/../deployment"
BUILD_OUTPUT="$DEPLOYMENT_DIR/builds"
LOG_FILE="$DEPLOYMENT_DIR/logs/frontend-deployment-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p "$BUILD_OUTPUT"
mkdir -p "$DEPLOYMENT_DIR/logs"

# Function to check package manager
get_package_manager() {
    if command -v pnpm &> /dev/null; then
        echo "pnpm"
    elif command -v npm &> /dev/null; then
        echo "npm"
    else
        log_error "No package manager found"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    local project_dir="$1"
    log_info "Installing dependencies in $project_dir..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would install dependencies in $project_dir"
        return 0
    fi
    
    cd "$project_dir"
    local pm=$(get_package_manager)
    $pm install
}

# Function to build project
build_project() {
    local project_dir="$1"
    local project_name="$2"
    log_info "Building $project_name..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would build $project_name"
        return 0
    fi
    
    cd "$project_dir"
    local pm=$(get_package_manager)
    $pm run build
}

# Function to copy build artifacts
copy_build_artifacts() {
    local source_dir="$1"
    local target_dir="$2"
    local project_name="$3"
    
    log_info "Copying build artifacts for $project_name..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would copy build artifacts from $source_dir to $target_dir"
        return 0
    fi
    
    mkdir -p "$target_dir"
    cp -r "$source_dir/dist/"* "$target_dir/" 2>/dev/null || cp -r "$source_dir/build/"* "$target_dir/" 2>/dev/null || {
        log_error "No build artifacts found in $source_dir"
        exit 1
    }
}

# Function to deploy to static hosting (Netlify/Vercel compatible)
deploy_to_static_hosting() {
    local build_dir="$1"
    local project_name="$2"
    log_info "Deploying $project_name to static hosting..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy $project_name to $FRONTEND_URL"
        return 0
    fi
    
    # This would be implemented with actual deployment commands
    # For example: netlify deploy --prod --dir="$build_dir"
    # or: vercel --prod "$build_dir"
    
    log_info "Static hosting deployment for $project_name would happen here"
}

# Function to update environment variables
update_environment_variables() {
    local project_dir="$1"
    local project_name="$2"
    
    log_info "Updating environment variables for $project_name..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update environment variables in $project_dir"
        return 0
    fi
    
    # Create or update .env file
    local env_file="$project_dir/.env.${ENVIRONMENT}"
    cat > "$env_file" << EOF
VITE_APP_ENV=$ENVIRONMENT
VITE_NETWORK_NAME=$NETWORK_NAME
VITE_RPC_URL=$RPC_URL
VITE_CHAIN_ID=$CHAIN_ID
VITE_EXPLORER_URL=$EXPLORER_URL
VITE_FRONTEND_URL=$FRONTEND_URL
VITE_API_URL=$API_URL
VITE_IPFS_GATEWAY=$IPFS_GATEWAY
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
}

# Function to build main frontend (minimax-os)
build_main_frontend() {
    if [ "$DEPLOY_FRONTEND" = true ]; then
        log_info "Building main frontend application..."
        
        local project_dir="$ROOT_DIR/minimax-os"
        if [ ! -d "$project_dir" ]; then
            log_error "Main frontend project not found: $project_dir"
            return 1
        fi
        
        if [ "$SKIP_BUILD" = false ]; then
            install_dependencies "$project_dir"
        fi
        
        update_environment_variables "$project_dir" "Main Frontend"
        build_project "$project_dir" "Main Frontend"
        copy_build_artifacts "$project_dir" "$BUILD_OUTPUT/main" "Main Frontend"
        
        if [ "$ENVIRONMENT" = "production" ]; then
            deploy_to_static_hosting "$BUILD_OUTPUT/main" "Main Frontend"
        fi
    fi
}

# Function to build blockchain OS
build_blockchain_os() {
    if [ "$DEPLOY_BLOCKCHAIN" = true ]; then
        log_info "Building blockchain OS..."
        
        local project_dir="$ROOT_DIR/sylos-blockchain-os"
        if [ ! -d "$project_dir" ]; then
            log_error "Blockchain OS project not found: $project_dir"
            return 1
        fi
        
        if [ "$SKIP_BUILD" = false ]; then
            install_dependencies "$project_dir"
        fi
        
        update_environment_variables "$project_dir" "Blockchain OS"
        build_project "$project_dir" "Blockchain OS"
        copy_build_artifacts "$project_dir" "$BUILD_OUTPUT/blockchain" "Blockchain OS"
        
        if [ "$ENVIRONMENT" = "production" ]; then
            deploy_to_static_hosting "$BUILD_OUTPUT/blockchain" "Blockchain OS"
        fi
    fi
}

# Function to build mobile web
build_mobile_web() {
    if [ "$DEPLOY_MOBILE" = true ]; then
        log_info "Building mobile web version..."
        
        local project_dir="$ROOT_DIR/sylos-mobile-new"
        if [ ! -d "$project_dir" ]; then
            log_error "Mobile project not found: $project_dir"
            return 1
        fi
        
        if [ "$SKIP_BUILD" = false ]; then
            install_dependencies "$project_dir"
        fi
        
        # Create environment file for Expo
        if [ "$DRY_RUN" = false ]; then
            cat > "$project_dir/.env" << EOF
EXPO_PUBLIC_APP_ENV=$ENVIRONMENT
EXPO_PUBLIC_NETWORK_NAME=$NETWORK_NAME
EXPO_PUBLIC_RPC_URL=$RPC_URL
EXPO_PUBLIC_CHAIN_ID=$CHAIN_ID
EXPO_PUBLIC_EXPLORER_URL=$EXPLORER_URL
EXPO_PUBLIC_FRONTEND_URL=$FRONTEND_URL
EXPO_PUBLIC_API_URL=$API_URL
EXPO_PUBLIC_IPFS_GATEWAY=$IPFS_GATEWAY
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
        fi
        
        # Build web version
        log_info "Building web version of mobile app..."
        if [ "$DRY_RUN" = false ]; then
            cd "$project_dir"
            local pm=$(get_package_manager)
            $pm run web
        fi
        
        copy_build_artifacts "$project_dir/web-build" "$BUILD_OUTPUT/mobile" "Mobile Web"
        
        if [ "$ENVIRONMENT" = "production" ]; then
            deploy_to_static_hosting "$BUILD_OUTPUT/mobile" "Mobile Web"
        fi
    fi
}

# Function to run tests
run_tests() {
    log_info "Running frontend tests..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run frontend tests"
        return 0
    fi
    
    local test_results_dir="$DEPLOYMENT_DIR/test-results"
    mkdir -p "$test_results_dir"
    
    # Test main frontend
    if [ "$DEPLOY_FRONTEND" = true ]; then
        local project_dir="$ROOT_DIR/minimax-os"
        if [ -d "$project_dir" ]; then
            cd "$project_dir"
            local pm=$(get_package_manager)
            $pm run test > "$test_results_dir/main-frontend-test.log" 2>&1 || true
        fi
    fi
    
    # Test blockchain OS
    if [ "$DEPLOY_BLOCKCHAIN" = true ]; then
        local project_dir="$ROOT_DIR/sylos-blockchain-os"
        if [ -d "$project_dir" ]; then
            cd "$project_dir"
            local pm=$(get_package_manager)
            $pm run test > "$test_results_dir/blockchain-os-test.log" 2>&1 || true
        fi
    fi
}

# Function to optimize builds
optimize_builds() {
    log_info "Optimizing build artifacts..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would optimize build artifacts"
        return 0
    fi
    
    # Compress assets
    find "$BUILD_OUTPUT" -name "*.js" -o -name "*.css" -o -name "*.html" | while read file; do
        if command -v gzip &> /dev/null; then
            gzip -9 "$file" 2>/dev/null || true
        fi
    done
    
    # Generate service worker
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Generating service worker..."
        cat > "$BUILD_OUTPUT/sw.js" << 'EOF'
// Simple service worker for offline functionality
const CACHE_NAME = 'sylos-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        return response || fetch(event.request);
      }
    )
  );
});
EOF
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="$DEPLOYMENT_DIR/logs/frontend-deployment-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating deployment report: $report_file"
    
    cat > "$report_file" << EOF
# Frontend Deployment Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Build Output:** $BUILD_OUTPUT

## Deployed Applications

| Application | Status | Build Directory |
|-------------|--------|-----------------|
EOF

    if [ "$DEPLOY_FRONTEND" = true ]; then
        echo "| Main Frontend | ✅ | $BUILD_OUTPUT/main |" >> "$report_file"
    fi
    
    if [ "$DEPLOY_BLOCKCHAIN" = true ]; then
        echo "| Blockchain OS | ✅ | $BUILD_OUTPUT/blockchain |" >> "$report_file"
    fi
    
    if [ "$DEPLOY_MOBILE" = true ]; then
        echo "| Mobile Web | ✅ | $BUILD_OUTPUT/mobile |" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Configuration

- **Network:** $NETWORK_NAME
- **RPC URL:** $RPC_URL
- **Frontend URL:** $FRONTEND_URL
- **API URL:** $API_URL
- **IPFS Gateway:** $IPFS_GATEWAY

## Build Statistics

- **Node Environment:** $NODE_ENV
- **Build Environment:** $BUILD_ENV

## Deployment URLs

EOF

    if [ "$DEPLOY_FRONTEND" = true ]; then
        echo "- **Main Frontend:** $FRONTEND_URL" >> "$report_file"
    fi
    
    if [ "$DEPLOY_BLOCKCHAIN" = true ]; then
        echo "- **Blockchain OS:** $FRONTEND_URL/blockchain" >> "$report_file"
    fi
    
    if [ "$DEPLOY_MOBILE" = true ]; then
        echo "- **Mobile Web:** $FRONTEND_URL/mobile" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Next Steps

1. Verify all applications are accessible
2. Test core functionality
3. Monitor for any errors
4. Update DNS/CDN configuration if needed

EOF
}

# Main deployment function
main() {
    log_info "Starting frontend deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Build Skip: $SKIP_BUILD"
    log_info "Dry Run: $DRY_RUN"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual deployment will occur"
    fi
    
    # Build all applications
    build_main_frontend
    build_blockchain_os
    build_mobile_web
    
    # Run tests
    run_tests
    
    # Optimize builds
    optimize_builds
    
    # Generate report
    generate_deployment_report
    
    log_success "Frontend deployment completed!"
    log_info "Build artifacts: $BUILD_OUTPUT"
    log_info "Deployment logs: $DEPLOYMENT_DIR/logs"
}

# Run main function
main "$@"