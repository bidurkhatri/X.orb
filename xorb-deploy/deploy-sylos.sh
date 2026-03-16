#!/bin/bash

# SylOS Comprehensive Deployment Script
# Author: SylOS Development Team
# Description: Main deployment script for all SylOS components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="SylOS"
DEPLOYMENT_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$SCRIPT_DIR/logs/deployment_${DEPLOYMENT_TIMESTAMP}.log"

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

SylOS Comprehensive Deployment Script

OPTIONS:
    -h, --help              Show this help message
    -a, --all              Deploy all components
    -c, --contracts        Deploy smart contracts
    -f, --frontend         Deploy frontend applications
    -m, --mobile           Build and deploy mobile app
    -i, --ipfs             Deploy to IPFS
    -e, --env ENV          Environment (development|staging|production)
    -t, --testnet          Use testnet instead of mainnet
    -v, --verify           Verify contracts after deployment
    -p, --parallel         Run deployments in parallel
    -s, --skip-build       Skip build steps
    --dry-run              Show what would be deployed without deploying

EXAMPLES:
    $0 --all --env production              # Deploy everything to production
    $0 --contracts --verify --env staging   # Deploy contracts to staging with verification
    $0 --frontend --skip-build             # Deploy frontend without rebuilding
    $0 --mobile --testnet                  # Build mobile app for testnet

EOF
}

# Default values
DEPLOY_CONTRACTS=false
DEPLOY_FRONTEND=false
DEPLOY_MOBILE=false
DEPLOY_IPFS=false
ENVIRONMENT="development"
USE_TESTNET=false
VERIFY_CONTRACTS=false
PARALLEL=false
SKIP_BUILD=false
DRY_RUN=false
DEPLOY_ALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -a|--all)
            DEPLOY_ALL=true
            shift
            ;;
        -c|--contracts)
            DEPLOY_CONTRACTS=true
            shift
            ;;
        -f|--frontend)
            DEPLOY_FRONTEND=true
            shift
            ;;
        -m|--mobile)
            DEPLOY_MOBILE=true
            shift
            ;;
        -i|--ipfs)
            DEPLOY_IPFS=true
            shift
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--testnet)
            USE_TESTNET=true
            shift
            ;;
        -v|--verify)
            VERIFY_CONTRACTS=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# If --all is specified, set all deployment flags
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_CONTRACTS=true
    DEPLOY_FRONTEND=true
    DEPLOY_MOBILE=true
    DEPLOY_IPFS=true
fi

# Load environment configuration
load_environment() {
    local env_file="$SCRIPT_DIR/environments/${ENVIRONMENT}.env"
    if [ -f "$env_file" ]; then
        log_info "Loading environment configuration from $env_file"
        source "$env_file"
    else
        log_error "Environment file not found: $env_file"
        exit 1
    fi
}

# Load secrets (if available)
load_secrets() {
    local secrets_file="$SCRIPT_DIR/config/secrets.env"
    if [ -f "$secrets_file" ]; then
        log_info "Loading secrets from $secrets_file"
        source "$secrets_file"
    else
        log_warning "Secrets file not found: $secrets_file"
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "git" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check for environment-specific requirements
    if [ "$DEPLOY_CONTRACTS" = true ]; then
        if ! command -v "hardhat" &> /dev/null && ! command -v "foundry" &> /dev/null; then
            log_error "No contract deployment tool found (hardhat/foundry)"
            exit 1
        fi
    fi
    
    if [ "$DEPLOY_FRONTEND" = true ]; then
        if ! command -v "pnpm" &> /dev/null && ! command -v "npm" &> /dev/null; then
            log_error "No package manager found (pnpm/npm)"
            exit 1
        fi
    fi
    
    if [ "$DEPLOY_MOBILE" = true ]; then
        if ! command -v "expo" &> /dev/null; then
            log_error "Expo CLI not found. Please install with: npm install -g @expo/cli"
            exit 1
        fi
    fi
    
    log_success "All prerequisites validated"
}

# Deploy smart contracts
deploy_contracts() {
    log_info "Running smart contract test suite..."
    (cd "$ROOT_DIR/smart-contracts" && npx hardhat test) || {
        log_error "Smart contract tests failed! Aborting deployment."
        exit 1
    }

    log_info "Deploying smart contracts to ${NETWORK_NAME}..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy contracts to $NETWORK_NAME"
        return 0
    fi
    
    local deploy_script="$SCRIPT_DIR/scripts/deploy-contracts.sh"
    if [ -f "$deploy_script" ]; then
        if [ "$SKIP_BUILD" = false ]; then
            bash "$deploy_script" --env "$ENVIRONMENT" --testnet="$USE_TESTNET" --verify="$VERIFY_CONTRACTS"
        else
            bash "$deploy_script" --env "$ENVIRONMENT" --testnet="$USE_TESTNET" --verify="$VERIFY_CONTRACTS" --skip-build
        fi
    else
        log_error "Contract deployment script not found: $deploy_script"
        exit 1
    fi
}

# Deploy frontend applications
deploy_frontend() {
    log_info "Deploying frontend applications..."
    
    # Inject environment variables
    export NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
    export NEXT_PUBLIC_POLYGON_RPC="${POLYGON_RPC:-$NEXT_PUBLIC_POLYGON_RPC}"
    log_info "Injected Supabase and Polygon RPC environment variables."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy frontend applications"
        return 0
    fi
    
    local frontend_script="$SCRIPT_DIR/scripts/deploy-frontend.sh"
    if [ -f "$frontend_script" ]; then
        if [ "$SKIP_BUILD" = false ]; then
            bash "$frontend_script" --env "$ENVIRONMENT"
        else
            bash "$frontend_script" --env "$ENVIRONMENT" --skip-build
        fi
    else
        log_error "Frontend deployment script not found: $frontend_script"
        exit 1
    fi
}

# Build and deploy mobile app
deploy_mobile() {
    log_info "Building and deploying mobile application..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would build and deploy mobile application"
        return 0
    fi
    
    local mobile_script="$SCRIPT_DIR/scripts/deploy-mobile.sh"
    if [ -f "$mobile_script" ]; then
        if [ "$SKIP_BUILD" = false ]; then
            bash "$mobile_script" --env "$ENVIRONMENT" --testnet="$USE_TESTNET"
        else
            bash "$mobile_script" --env "$ENVIRONMENT" --testnet="$USE_TESTNET" --skip-build
        fi
    else
        log_error "Mobile deployment script not found: $mobile_script"
        exit 1
    fi
}

# Deploy to IPFS
deploy_ipfs() {
    log_info "Deploying to IPFS..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy to IPFS"
        return 0
    fi
    
    local ipfs_script="$SCRIPT_DIR/scripts/deploy-ipfs.sh"
    if [ -f "$ipfs_script" ]; then
        bash "$ipfs_script" --env "$ENVIRONMENT"
    else
        log_error "IPFS deployment script not found: $ipfs_script"
        exit 1
    fi
}

# Run post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."
    
    # Update contract addresses
    if [ "$DEPLOY_CONTRACTS" = true ]; then
        log_info "Updating contract addresses in configuration..."
        local update_script="$SCRIPT_DIR/scripts/update-contract-addresses.sh"
        if [ -f "$update_script" ]; then
            bash "$update_script" --env "$ENVIRONMENT"
        fi
    fi
    
    # Generate deployment report
    generate_deployment_report
}

# Generate deployment report
generate_deployment_report() {
    local report_file="$SCRIPT_DIR/logs/deployment-report-${DEPLOYMENT_TIMESTAMP}.md"
    log_info "Generating deployment report: $report_file"
    
    cat > "$report_file" << EOF
# SylOS Deployment Report

**Deployment Date:** $(date)
**Environment:** $ENVIRONMENT
**Network:** $NETWORK_NAME
**Timestamp:** $DEPLOYMENT_TIMESTAMP

## Deployed Components

EOF

    if [ "$DEPLOY_CONTRACTS" = true ]; then
        echo "- ✅ Smart Contracts" >> "$report_file"
    fi
    
    if [ "$DEPLOY_FRONTEND" = true ]; then
        echo "- ✅ Frontend Applications" >> "$report_file"
    fi
    
    if [ "$DEPLOY_MOBILE" = true ]; then
        echo "- ✅ Mobile Application" >> "$report_file"
    fi
    
    if [ "$DEPLOY_IPFS" = true ]; then
        echo "- ✅ IPFS Deployment" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Configuration

- **Network:** $NETWORK_NAME
- **RPC URL:** $RPC_URL
- **Environment:** $ENVIRONMENT
- **Testnet Mode:** $USE_TESTNET

## Deployment Details

For detailed deployment logs, see: $LOG_FILE

EOF

    log_success "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    log_info "Starting SylOS deployment..."
    log_info "Project: $PROJECT_NAME"
    log_info "Environment: $ENVIRONMENT"
    log_info "Timestamp: $DEPLOYMENT_TIMESTAMP"
    
    # Load configurations
    load_environment
    load_secrets
    
    # Validate prerequisites
    validate_prerequisites
    
    # Create deployment directory structure
    mkdir -p "$SCRIPT_DIR/logs"
    mkdir -p "$SCRIPT_DIR/temp"
    
    # Start logging
    exec > >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    log_info "Deployment log: $LOG_FILE"
    
    # Run deployments
    if [ "$PARALLEL" = true ]; then
        log_info "Running deployments in parallel..."
        
        # Array to track background processes
        declare -a pids
        
        if [ "$DEPLOY_CONTRACTS" = true ]; then
            deploy_contracts &
            pids+=($!)
        fi
        
        if [ "$DEPLOY_FRONTEND" = true ]; then
            deploy_frontend &
            pids+=($!)
        fi
        
        if [ "$DEPLOY_MOBILE" = true ]; then
            deploy_mobile &
            pids+=($!)
        fi
        
        if [ "$DEPLOY_IPFS" = true ]; then
            deploy_ipfs &
            pids+=($!)
        fi
        
        # Wait for all background processes
        for pid in "${pids[@]}"; do
            wait "$pid"
        done
    else
        # Sequential deployment
        if [ "$DEPLOY_CONTRACTS" = true ]; then
            deploy_contracts
        fi
        
        if [ "$DEPLOY_FRONTEND" = true ]; then
            deploy_frontend
        fi
        
        if [ "$DEPLOY_MOBILE" = true ]; then
            deploy_mobile
        fi
        
        if [ "$DEPLOY_IPFS" = true ]; then
            deploy_ipfs
        fi
    fi
    
    # Post-deployment tasks
    post_deployment
    
    log_success "SylOS deployment completed successfully!"
    log_info "Check the deployment report: $SCRIPT_DIR/logs/deployment-report-${DEPLOYMENT_TIMESTAMP}.md"
}

# Script entry point
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi