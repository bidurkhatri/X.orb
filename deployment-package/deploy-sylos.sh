#!/bin/bash

# =============================================================================
# SYLOS DEPLOYMENT SCRIPT
# Master script for deploying the complete SylOS ecosystem
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_TYPE=${1:-"development"}
ENV_FILE="$SCRIPT_DIR/environments/${DEPLOYMENT_TYPE}.env"
LOG_FILE="$SCRIPT_DIR/deployment.log"
MAX_RETRIES=3

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "git" "docker" "docker-compose")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found. Please install it first."
            exit 1
        fi
    done
    
    # Check required environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file '$ENV_FILE' not found."
        error "Available environments: development, staging, production"
        exit 1
    fi
    
    # Load environment variables
    source "$ENV_FILE"
    
    success "Prerequisites check passed"
}

# Verify system requirements
verify_system() {
    log "Verifying system requirements..."
    
    # Check available memory
    local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $memory_gb -lt 4 ]]; then
        warning "Low memory detected (${memory_gb}GB). Recommended: 8GB+"
    fi
    
    # Check disk space (minimum 10GB)
    local disk_gb=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [[ $disk_gb -lt 10 ]]; then
        warning "Low disk space detected (${disk_gb}GB). Recommended: 50GB+"
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    if ! node -e "process.exit(process.versions.node.split('.')[0] >= 18 ? 0 : 1)" 2>/dev/null; then
        error "Node.js version $node_version found. Required: $required_version or higher"
        exit 1
    fi
    
    success "System requirements verified"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install web app dependencies
    if [[ -d "$SCRIPT_DIR/../minimax-os" ]]; then
        log "Installing web app dependencies..."
        cd "$SCRIPT_DIR/../minimax-os"
        npm ci --production=false
        success "Web app dependencies installed"
    fi
    
    # Install mobile app dependencies
    if [[ -d "$SCRIPT_DIR/../sylos-mobile" ]]; then
        log "Installing mobile app dependencies..."
        cd "$SCRIPT_DIR/../sylos-mobile"
        npm ci
        success "Mobile app dependencies installed"
    fi
    
    # Install smart contract dependencies
    if [[ -d "$SCRIPT_DIR/../smart-contracts" ]]; then
        log "Installing smart contract dependencies..."
        cd "$SCRIPT_DIR/../smart-contracts"
        npm ci
        success "Smart contract dependencies installed"
    fi
}

# Build smart contracts
build_contracts() {
    if [[ -d "$SCRIPT_DIR/../smart-contracts" ]]; then
        log "Building smart contracts..."
        cd "$SCRIPT_DIR/../smart-contracts"
        
        # Compile contracts
        npx hardhat compile
        
        # Run tests
        npx hardhat test
        
        # Deploy contracts (if environment allows)
        if [[ "$DEPLOYMENT_TYPE" == "production" && -n "$PRIVATE_KEY" ]]; then
            npx hardhat run scripts/deploy.js --network "$NETWORK"
            success "Contracts deployed to $NETWORK"
        else
            success "Contracts compiled (deployment skipped for $DEPLOYMENT_TYPE)"
        fi
    fi
}

# Build web application
build_web_app() {
    if [[ -d "$SCRIPT_DIR/../minimax-os" ]]; then
        log "Building web application..."
        cd "$SCRIPT_DIR/../minimax-os"
        
        # Install dependencies if not done
        npm ci
        
        # Build for production
        if [[ "$DEPLOYMENT_TYPE" == "production" ]]; then
            npm run build
            success "Web application built for production"
        else
            # Development build
            npm run build:dev
            success "Web application built for development"
        fi
    fi
}

# Build mobile application
build_mobile_app() {
    if [[ -d "$SCRIPT_DIR/../sylos-mobile" ]]; then
        log "Building mobile application..."
        cd "$SCRIPT_DIR/../sylos-mobile"
        
        # Install dependencies if not done
        npm ci
        
        # Prebuild if needed
        if [[ ! -d "ios" && ! -d "android" ]]; then
            npx expo prebuild
        fi
        
        if [[ "$DEPLOYMENT_TYPE" == "production" ]]; then
            # Build for production
            npx expo build:android --type apk
            npx expo build:ios --type archive
            success "Mobile applications built for production"
        else
            # Start development build
            npx expo start --dev-client
            success "Mobile development server started"
        fi
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure..."
    
    # Start Docker services if docker-compose exists
    if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
        docker-compose up -d
        success "Docker services started"
    fi
    
    # Deploy IPFS if configured
    if [[ -f "$SCRIPT_DIR/ipfs/docker-compose.yml" ]]; then
        cd "$SCRIPT_DIR/ipfs"
        docker-compose up -d
        success "IPFS nodes started"
    fi
}

# Run system checks
run_system_checks() {
    log "Running system checks..."
    
    # Health check script
    if [[ -f "$SCRIPT_DIR/scripts/system-check.sh" ]]; then
        bash "$SCRIPT_DIR/scripts/system-check.sh"
        success "System checks completed"
    fi
}

# Generate deployment report
generate_report() {
    local report_file="$SCRIPT_DIR/deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    log "Generating deployment report..."
    
    cat > "$report_file" << EOF
# SylOS Deployment Report

**Deployment Date:** $(date)
**Deployment Type:** $DEPLOYMENT_TYPE
**Environment File:** $ENV_FILE

## Deployed Components

### Web Application
- Path: $SCRIPT_DIR/../minimax-os
- Build Status: $([ -d "$SCRIPT_DIR/../minimax-os/dist" ] && echo "✓ Built" || echo "✗ Failed")

### Mobile Application
- Path: $SCRIPT_DIR/../sylos-mobile
- Build Status: $([ -f "$SCRIPT_DIR/../sylos-mobile/dist" ] && echo "✓ Built" || echo "✗ Failed")

### Smart Contracts
- Path: $SCRIPT_DIR/../smart-contracts
- Compile Status: $([ -d "$SCRIPT_DIR/../smart-contracts/artifacts" ] && echo "✓ Compiled" || echo "✗ Failed")

## System Information
- Node.js Version: $(node --version)
- Docker Version: $(docker --version 2>/dev/null || echo "Not installed")
- Available Memory: $(free -h | awk '/^Mem:/ {print $2}')
- Disk Space: $(df -h . | awk 'NR==2{print $4}')

## Next Steps
1. Configure reverse proxy (nginx)
2. Set up SSL certificates
3. Configure monitoring
4. Set up automated backups

**Report generated at:** $(date)
EOF
    
    success "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    log "=== SylOS Deployment Started ==="
    log "Deployment Type: $DEPLOYMENT_TYPE"
    log "Environment File: $ENV_FILE"
    
    # Parse command line options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-contracts)
                SKIP_CONTRACTS=true
                shift
                ;;
            --skip-mobile)
                SKIP_MOBILE=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                if [[ $# -eq 1 && $1 != --* ]]; then
                    # Last argument is deployment type
                    break
                fi
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_prerequisites
    verify_system
    
    if [[ "$SKIP_DEPS" != true ]]; then
        install_dependencies
    fi
    
    if [[ "$SKIP_CONTRACTS" != true ]]; then
        build_contracts
    fi
    
    build_web_app
    
    if [[ "$SKIP_MOBILE" != true ]]; then
        build_mobile_app
    fi
    
    deploy_infrastructure
    run_system_checks
    generate_report
    
    success "=== SylOS Deployment Completed Successfully ==="
    
    # Show next steps
    show_next_steps
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [DEPLOYMENT_TYPE] [OPTIONS]

DEPLOYMENT_TYPE:
  development    Deploy for development (default)
  staging        Deploy for staging environment
  production     Deploy for production environment

OPTIONS:
  --skip-deps     Skip dependency installation
  --skip-contracts  Skip smart contract deployment
  --skip-mobile   Skip mobile app deployment
  --help          Show this help message

EXAMPLES:
  $0 production                    # Full production deployment
  $0 development --skip-mobile     # Development without mobile
  $0 --help                        # Show help

For more information, see QUICKSTART.md
EOF
}

# Show next steps
show_next_steps() {
    echo
    echo -e "${BLUE}=== Next Steps ===${NC}"
    echo "1. Configure your web server (nginx/Apache)"
    echo "2. Set up SSL certificates for production"
    echo "3. Configure monitoring and logging"
    echo "4. Set up automated backups"
    echo "5. Review security settings in SECURITY.md"
    echo
    echo -e "📚 See ${YELLOW}QUICKSTART.md${NC} for immediate setup instructions"
    echo -e "🔧 See ${YELLOW}TROUBLESHOOTING.md${NC} for common issues"
    echo -e "📋 See ${YELLOW}PRODUCTION_CHECKLIST.md${NC} for production readiness"
}

# Run main function
main "$@"