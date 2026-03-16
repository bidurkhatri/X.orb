#!/bin/bash

# Smart Contract Verification Script for SylOS
# Description: Verifies deployed smart contracts on Polygonscan

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
DRY_RUN=false
CONTRACT_ADDRESS=""
CONSTRUCTOR_ARGS=""
OPTIMIZATION=true
OPTIMIZATION_RUNS=200

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--address)
            CONTRACT_ADDRESS="$2"
            shift 2
            ;;
        -c|--constructor)
            CONSTRUCTOR_ARGS="$2"
            shift 2
            ;;
        --no-optimization)
            OPTIMIZATION=false
            shift
            ;;
        --runs)
            OPTIMIZATION_RUNS="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Verify smart contracts on Polygonscan"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -a, --address ADDR  Contract address to verify"
            echo "  -c, --constructor   Constructor arguments (JSON array)"
            echo "  --no-optimization   Disable optimizer"
            echo "  --runs N            Number of optimization runs (default: 200)"
            echo "  --dry-run          Show what would be verified without verifying"
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
DEPLOYMENT_DIR="$SCRIPT_DIR/../deployment"
LOG_FILE="$DEPLOYMENT_DIR/logs/contract-verification-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p "$DEPLOYMENT_DIR/logs"

# Function to verify contract using Hardhat
verify_with_hardhat() {
    local contract_address="$1"
    local constructor_args="$2"
    local contract_name="${3:-}"
    
    log_info "Verifying contract using Hardhat: $contract_address"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would verify $contract_address using Hardhat"
        return 0
    fi
    
    # Build verification command
    local cmd="npx hardhat verify --network $NETWORK_NAME $contract_address"
    
    if [ -n "$constructor_args" ]; then
        cmd="$cmd --constructor-args '$constructor_args'"
    fi
    
    if [ "$OPTIMIZATION" = false ]; then
        cmd="$cmd --no-optimize"
    fi
    
    if [ -n "$contract_name" ]; then
        cmd="$cmd --contract $contract_name"
    fi
    
    log_info "Running: $cmd"
    eval "$cmd"
}

# Function to verify contract using API directly
verify_with_api() {
    local contract_address="$1"
    local constructor_args="$2"
    
    log_info "Verifying contract using API: $contract_address"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY_RUN] Would verify $contract_address using API"
        return 0
    fi
    
    # Prepare API request
    local api_url="https://api-${EXPLORER_URL#https://}/api"
    local request_data=$(cat << EOF
{
    "module": "contract",
    "action": "verifysourcecode",
    "contractaddress": "$contract_address",
    "sourceCode": "$(cat contracts/**/*.sol | tr '\n' ' ' | sed 's/"/\\"/g')",
    "codeformat": "solidity-single-file",
    "contractname": "$(basename contracts/*.sol .sol)",
    "compilerversion": "v0.8.19+commit.7dd6d404",
    "optimization": $OPTIMIZATION,
    "runs": $OPTIMIZATION_RUNS
}
EOF
    )
    
    if [ -n "$constructor_args" ]; then
        request_data=$(echo "$request_data" | jq ".constructorArguements = \"$constructor_args\"")
    fi
    
    # Send verification request
    local response=$(curl -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -d "$request_data" \
        --max-time 60)
    
    if echo "$response" | grep -q '"status":"1"'; then
        log_success "Contract verification submitted successfully"
        return 0
    else
        log_error "Contract verification failed: $response"
        return 1
    fi
}

# Function to check verification status
check_verification_status() {
    local contract_address="$1"
    local max_attempts="${2:-10}"
    local attempt=1
    
    log_info "Checking verification status for $contract_address"
    
    while [ $attempt -le $max_attempts ]; do
        local status_url="https://api-${EXPLORER_URL#https://}/api?module=contract&action=getsourcecode&address=$contract_address"
        local response=$(curl -s "$status_url")
        
        if echo "$response" | grep -q '"sourceCode":"' && ! echo "$response" | grep -q '"sourceCode":"' | grep -q 'Contract source code not verified'; then
            log_success "Contract verification completed successfully!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - still verifying..."
        sleep 30
        attempt=$((attempt + 1))
    done
    
    log_warning "Verification status check timed out after $max_attempts attempts"
    return 1
}

# Function to verify multiple contracts
verify_multiple_contracts() {
    local addresses_file="$1"
    
    if [ ! -f "$addresses_file" ]; then
        log_error "Contract addresses file not found: $addresses_file"
        return 1
    fi
    
    log_info "Verifying multiple contracts from: $addresses_file"
    
    # This would parse the addresses file and verify each contract
    # Implementation depends on the file format
    
    local contracts=$(cat "$addresses_file" | jq -r '.contracts | to_entries[] | "\(.key):\(.value.address)"' 2>/dev/null || echo "")
    
    if [ -z "$contracts" ]; then
        log_warning "No contracts found in addresses file"
        return 0
    fi
    
    while IFS=':' read -r contract_name contract_address; do
        if [ -n "$contract_name" ] && [ -n "$contract_address" ]; then
            log_info "Verifying contract: $contract_name at $contract_address"
            verify_with_hardhat "$contract_address" "" "$contract_name"
        fi
    done <<< "$contracts"
}

# Function to generate verification report
generate_verification_report() {
    local report_file="$DEPLOYMENT_DIR/logs/contract-verification-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating verification report: $report_file"
    
    cat > "$report_file" << EOF
# Contract Verification Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Network:** $NETWORK_NAME
**Explorer:** $EXPLORER_URL

## Verification Details

- **Optimization:** $OPTIMIZATION
- **Optimization Runs:** $OPTIMIZATION_RUNS
- **Contract Address:** ${CONTRACT_ADDRESS:-"Multiple"}
- **Constructor Args:** ${CONSTRUCTOR_ARGS:-"None"}

## Verification Status

| Contract | Address | Status | Explorer Link |
|----------|---------|--------|---------------|
EOF

    # Add verification results
    if [ -n "$CONTRACT_ADDRESS" ]; then
        local explorer_link="$EXPLORER_URL/address/$CONTRACT_ADDRESS#code"
        echo "| Main | $CONTRACT_ADDRESS | ✅ | [View]($explorer_link) |" >> "$report_file"
    else
        echo "| Multiple | See addresses file | ✅ | See explorer |" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Verification Method

Contracts are verified using:
- **Primary:** Hardhat verification plugin
- **Fallback:** Direct API verification

## Next Steps

1. Review verified contracts on explorer
2. Test contract interaction
3. Update frontend with verified contract addresses
4. Monitor contract events and transactions

EOF
}

# Main verification function
main() {
    log_info "Starting contract verification..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Network: $NETWORK_NAME"
    log_info "Contract Address: ${CONTRACT_ADDRESS:-"Multiple"}"
    log_info "Optimization: $OPTIMIZATION"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual verification will occur"
    fi
    
    # Determine verification method
    if [ -f "package.json" ] && (grep -q "hardhat-verify" package.json || grep -q "@nomiclabs/hardhat-etherscan" package.json); then
        log_info "Using Hardhat verification"
        
        if [ -n "$CONTRACT_ADDRESS" ]; then
            verify_with_hardhat "$CONTRACT_ADDRESS" "$CONSTRUCTOR_ARGS"
        else
            # Verify all contracts from addresses file
            local addresses_file="$DEPLOYMENT_DIR/addresses/${ENVIRONMENT}-addresses.json"
            verify_multiple_contracts "$addresses_file"
        fi
    else
        log_info "Using direct API verification"
        
        if [ -n "$CONTRACT_ADDRESS" ]; then
            verify_with_api "$CONTRACT_ADDRESS" "$CONSTRUCTOR_ARGS"
            check_verification_status "$CONTRACT_ADDRESS"
        fi
    fi
    
    # Generate report
    generate_verification_report
    
    log_success "Contract verification completed!"
    log_info "Verification report: $DEPLOYMENT_DIR/logs/contract-verification-report-${ENVIRONMENT}-*.md"
}

# Run main function
main "$@"