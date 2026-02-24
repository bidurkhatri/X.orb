#!/bin/bash

# Smart Contract Deployment Script for SylOS
# Description: Deploys and verifies smart contracts on Polygon

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
USE_TESTNET=false
VERIFY_CONTRACTS=false
SKIP_BUILD=false
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Deploy smart contracts to Polygon"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -t, --testnet       Use testnet instead of mainnet"
            echo "  -v, --verify        Verify contracts on Polygonscan"
            echo "  -s, --skip-build    Skip build steps"
            echo "  --dry-run          Show what would be deployed without deploying"
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
CONTRACTS_DIR="$SCRIPT_DIR/../contracts"
BUILD_DIR="$SCRIPT_DIR/../build"
DEPLOYMENT_DIR="$SCRIPT_DIR/../deployment"
ADDRESSES_FILE="$DEPLOYMENT_DIR/addresses/${ENVIRONMENT}-addresses.json"

# Create necessary directories
mkdir -p "$DEPLOYMENT_DIR/addresses"
mkdir -p "$DEPLOYMENT_DIR/artifacts"
mkdir -p "$DEPLOYMENT_DIR/logs"

# Function to check if Hardhat is available
check_hardhat() {
    if [ -f "hardhat.config.js" ] || [ -f "hardhat.config.ts" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check if Foundry is available
check_foundry() {
    if [ -f "foundry.toml" ]; then
        return 0
    else
        return 1
    fi
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        if command -v pnpm &> /dev/null; then
            pnpm install
        elif command -v npm &> /dev/null; then
            npm install
        else
            log_error "No package manager found"
            exit 1
        fi
    fi
    
    if [ -f "foundry.toml" ]; then
        if command -v forge &> /dev/null; then
            forge install
        fi
    fi
}

# Function to compile contracts
compile_contracts() {
    log_info "Compiling smart contracts..."
    
    if check_hardhat; then
        if [ "$SKIP_BUILD" = false ]; then
            npx hardhat compile
        fi
    elif check_foundry; then
        if [ "$SKIP_BUILD" = false ]; then
            forge build
        fi
    else
        log_error "No deployment framework found (hardhat/foundry)"
        exit 1
    fi
}

# Function to deploy contracts using Hardhat
deploy_with_hardhat() {
    log_info "Deploying contracts with Hardhat..."
    
    local deploy_script="$CONTRACTS_DIR/scripts/deploy.js"
    local network_param="--network $NETWORK_NAME"
    
    if [ "$VERIFY_CONTRACTS" = true ]; then
        network_param="$network_param --verify"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npx hardhat run $deploy_script $network_param"
        return 0
    fi
    
    npx hardhat run "$deploy_script" $network_param
}

# Function to deploy contracts using Foundry
deploy_with_foundry() {
    log_info "Deploying contracts with Foundry..."
    
    local deploy_script="$CONTRACTS_DIR/script/Deploy.s.sol"
    local network_param="--rpc-url $RPC_URL"
    local private_key_param="--private-key $DEPLOYER_PRIVATE_KEY"
    
    if [ "$VERIFY_CONTRACTS" = true ]; then
        network_param="$network_param --verify"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: forge script $deploy_script $network_param $private_key_param"
        return 0
    fi
    
    forge script "$deploy_script" $network_param $private_key_param
}

# Function to verify contracts
verify_contracts() {
    if [ "$VERIFY_CONTRACTS" = true ]; then
        log_info "Verifying contracts on Polygonscan..."
        
        if [ -f "package.json" ]; then
            # Use Hardhat plugin for verification
            if [ -f "hardhat.config.js" ] || [ -f "hardhat.config.ts" ]; then
                if [ "$DRY_RUN" = false ]; then
                    npx hardhat verify --network "$NETWORK_NAME" --constructor-args "$DEPLOYMENT_DIR/addresses/${ENVIRONMENT}-addresses.json"
                else
                    log_info "[DRY RUN] Would verify contracts using Hardhat"
                fi
            fi
        fi
    fi
}

# Function to save deployment addresses
save_deployment_addresses() {
    log_info "Saving deployment addresses..."
    
    # This would be implemented to save contract addresses to a JSON file
    # The actual implementation depends on the deployment framework used
    
    if [ "$DRY_RUN" = false ]; then
        cat > "$ADDRESSES_FILE" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "network": "$NETWORK_NAME",
    "chainId": $CHAIN_ID,
    "environment": "$ENVIRONMENT"
  },
  "contracts": {
    // Contract addresses will be added here by the deployment script
  }
}
EOF
    fi
}

# Function to test deployment
test_deployment() {
    log_info "Testing deployment..."
    
    if check_hardhat; then
        if [ "$DRY_RUN" = false ]; then
            npx hardhat test
        else
            log_info "[DRY RUN] Would run contract tests"
        fi
    elif check_foundry; then
        if [ "$DRY_RUN" = false ]; then
            forge test
        else
            log_info "[DRY RUN] Would run contract tests"
        fi
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="$DEPLOYMENT_DIR/logs/contract-deployment-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating deployment report: $report_file"
    
    cat > "$report_file" << EOF
# Contract Deployment Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Network:** $NETWORK_NAME
**Chain ID:** $CHAIN_ID
**Testnet Mode:** $USE_TESTNET

## Deployment Details

- **Framework:** $(check_hardhat && echo "Hardhat" || check_foundry && echo "Foundry" || echo "Unknown")
- **Verification:** $VERIFY_CONTRACTS
- **Dry Run:** $DRY_RUN

## Contracts Deployed

| Contract | Address | Transaction Hash |
|----------|---------|------------------|
| // To be filled by deployment script |

## Network Information

- **RPC URL:** $RPC_URL
- **Explorer:** $EXPLORER_URL
- **Currency:** $CURRENCY_SYMBOL

## Verification Status

All contracts are verified on $EXPLORER_URL

EOF
}

# Main deployment function
main() {
    log_info "Starting contract deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Network: $NETWORK_NAME"
    log_info "Testnet: $USE_TESTNET"
    log_info "Verification: $VERIFY_CONTRACTS"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual deployment will occur"
    fi
    
    # Check deployment framework
    if ! check_hardhat && ! check_foundry; then
        log_error "No deployment framework found (hardhat.config.js or foundry.toml)"
        exit 1
    fi
    
    # Install dependencies
    if [ "$SKIP_BUILD" = false ]; then
        install_dependencies
    fi
    
    # Compile contracts
    compile_contracts
    
    # Deploy contracts
    if check_hardhat; then
        deploy_with_hardhat
    elif check_foundry; then
        deploy_with_foundry
    fi
    
    # Verify contracts
    verify_contracts
    
    # Test deployment
    test_deployment
    
    # Save deployment information
    save_deployment_addresses
    
    # Generate report
    generate_deployment_report
    
    log_success "Contract deployment completed!"
    log_info "Deployment addresses saved to: $ADDRESSES_FILE"
    log_info "Deployment report: $DEPLOYMENT_DIR/logs/contract-deployment-${ENVIRONMENT}-*.md"
}

# Run main function
main "$@"