#!/bin/bash

# Update Contract Addresses Script for SylOS
# Description: Updates frontend configurations with deployed contract addresses

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
FRONTEND_DIR=""
BLOCKCHAIN_DIR=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --frontend)
            FRONTEND_DIR="$2"
            shift 2
            ;;
        --blockchain)
            BLOCKCHAIN_DIR="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Update contract addresses in frontend configurations"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  --frontend DIR      Frontend directory to update"
            echo "  --blockchain DIR    Blockchain directory to update"
            echo "  --dry-run          Show what would be updated without updating"
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
ADDRESSES_FILE="$DEPLOYMENT_DIR/addresses/${ENVIRONMENT}-addresses.json"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Default directories
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/minimax-os}"
BLOCKCHAIN_DIR="${BLOCKCHAIN_DIR:-$ROOT_DIR/sylos-blockchain-os}"

# Create addresses file if it doesn't exist
create_addresses_file() {
    if [ ! -f "$ADDRESSES_FILE" ]; then
        log_info "Creating addresses file: $ADDRESSES_FILE"
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would create addresses file"
            return 0
        fi
        
        cat > "$ADDRESSES_FILE" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "network": "$NETWORK_NAME",
    "chainId": $CHAIN_ID,
    "environment": "$ENVIRONMENT"
  },
  "contracts": {}
}
EOF
    fi
}

# Function to read contract addresses
read_contract_addresses() {
    if [ -f "$ADDRESSES_FILE" ]; then
        log_info "Reading contract addresses from: $ADDRESSES_FILE"
        cat "$ADDRESSES_FILE"
    else
        log_warning "Addresses file not found: $ADDRESSES_FILE"
        echo '{"contracts": {}}'
    fi
}

# Function to update environment file
update_env_file() {
    local env_file="$1"
    local contract_addresses="$2"
    
    log_info "Updating environment file: $env_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update $env_file with contract addresses"
        return 0
    fi
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        return 1
    fi
    
    # Create backup
    cp "$env_file" "$env_file.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Update contract addresses in environment file
    local temp_file=$(mktemp)
    
    # Add or update contract addresses
    if grep -q "CONTRACT_" "$env_file"; then
        # Update existing contract addresses
        sed '/^CONTRACT_/d' "$env_file" > "$temp_file"
    else
        # Just copy the file
        cat "$env_file" > "$temp_file"
    fi
    
    # Add new contract addresses
    echo "" >> "$temp_file"
    echo "# Contract addresses updated on $(date)" >> "$temp_file"
    
    # Parse and add contract addresses
    echo "$contract_addresses" | jq -r '.contracts | to_entries[] | "CONTRACT_\(.key | ascii_upcase)=\(.value.address)"' >> "$temp_file"
    
    mv "$temp_file" "$env_file"
    log_success "Updated environment file: $env_file"
}

# Function to update TypeScript config
update_ts_config() {
    local config_file="$1"
    local contract_addresses="$2"
    
    log_info "Updating TypeScript config: $config_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update $config_file with contract addresses"
        return 0
    fi
    
    if [ ! -f "$config_file" ]; then
        log_error "Config file not found: $config_file"
        return 1
    fi
    
    # Create backup
    cp "$config_file" "$config_file.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Read existing config
    local temp_config=$(mktemp)
    
    # Create or update contract config
    local contract_config=$(echo "$contract_addresses" | jq -r '.contracts | {addresses: .}')
    
    # Update or add contract configuration
    if [ -f "$config_file" ]; then
        # Parse existing config and merge
        jq --argjson contracts "$contract_config" '.contracts = $contracts' "$config_file" > "$temp_config" 2>/dev/null || {
            # If jq fails, create new config
            cat > "$temp_config" << EOF
{
  "contracts": $contract_config,
  "network": {
    "name": "$NETWORK_NAME",
    "chainId": $CHAIN_ID,
    "rpcUrl": "$RPC_URL",
    "explorerUrl": "$EXPLORER_URL"
  }
}
EOF
        }
    else
        # Create new config
        cat > "$temp_config" << EOF
{
  "contracts": $contract_config,
  "network": {
    "name": "$NETWORK_NAME",
    "chainId": $CHAIN_ID,
    "rpcUrl": "$RPC_URL",
    "explorerUrl": "$EXPLORER_URL"
  }
}
EOF
    fi
    
    mv "$temp_config" "$config_file"
    log_success "Updated TypeScript config: $config_file"
}

# Function to update JavaScript config
update_js_config() {
    local config_file="$1"
    local contract_addresses="$2"
    
    log_info "Updating JavaScript config: $config_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update $config_file with contract addresses"
        return 0
    fi
    
    # Create or update config file
    local contract_config=$(echo "$contract_addresses" | jq -r '.contracts | to_entries[] | "export const \\(.key | ascii_upcase)_ADDRESS = \"\\(.value.address)\";"' | tr '\n' ' ')
    
    cat > "$config_file" << EOF
// Auto-generated contract addresses
// Updated on $(date)

import { ethers } from 'ethers';

export const NETWORK_CONFIG = {
  name: '$NETWORK_NAME',
  chainId: $CHAIN_ID,
  rpcUrl: '$RPC_URL',
  explorerUrl: '$EXPLORER_URL',
  currency: {
    name: '$CURRENCY_SYMBOL',
    decimals: 18
  }
};

$contract_config

export const CONTRACT_ADDRESSES = {
$(
  echo "$contract_addresses" | jq -r '.contracts | to_entries[] | "  \(.key): \"\(.value.address)\","
')
};

export const getContract = (contractName, providerOrSigner) => {
  const address = CONTRACT_ADDRESSES[contractName];
  if (!address) {
    throw new Error(\`Contract \${contractName} not found\`);
  }
  
  // This would return the contract instance
  // Implementation depends on the specific contract interface
  return { address, network: NETWORK_CONFIG };
};

export default {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  getContract
};
EOF

    log_success "Updated JavaScript config: $config_file"
}

# Function to update React constants
update_react_constants() {
    local constants_file="$1"
    local contract_addresses="$2"
    
    log_info "Updating React constants: $constants_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update $constants_file with contract addresses"
        return 0
    fi
    
    # Create or update React constants file
    cat > "$constants_file" << EOF
// Auto-generated contract addresses and configuration
// Updated on $(date)
import { ChainId, Network } from '@rainbow-me/rainbowkit';

export const NETWORK = {
  chainId: $CHAIN_ID,
  name: '$NETWORK_NAME',
  currency: {
    name: '$CURRENCY_SYMBOL',
    symbol: '$CURRENCY_SYMBOL',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['$RPC_URL'] },
    public: { http: ['$RPC_URL'] },
  },
  blockExplorers: {
    default: { name: 'Polygonscan', url: '$EXPLORER_URL' },
  },
} as const;

export const CONTRACT_ADDRESSES = {
$(
  echo "$contract_addresses" | jq -r '.contracts | to_entries[] | "  \([.key | split(" ") | join("_") | ascii_upcase]): \"\(.value.address)\","
')
};

// Contract ABI placeholders - replace with actual ABIs
export const CONTRACT_ABIS = {
  // Add contract ABIs here
};

export const CONTRACTS = {
$(
  echo "$contract_addresses" | jq -r '.contracts | to_entries[] | "  \([.key | split(" ") | join("_") | ascii_upcase]): { address: CONTRACT_ADDRESSES.\([.key | split(" ") | join("_") | ascii_upcase]), abi: CONTRACT_ABIS.\([.key | split(" ") | join("_") | ascii_upcase]) },"
')
};

export default {
  NETWORK,
  CONTRACT_ADDRESSES,
  CONTRACTS,
  CONTRACT_ABIS,
};
EOF

    log_success "Updated React constants: $constants_file"
}

# Function to update all frontend configurations
update_frontend_configs() {
    local contract_addresses="$1"
    
    # Update main frontend
    if [ -d "$FRONTEND_DIR" ]; then
        log_info "Updating main frontend configuration..."
        
        # Update environment file
        if [ -f "$FRONTEND_DIR/.env.${ENVIRONMENT}" ]; then
            update_env_file "$FRONTEND_DIR/.env.${ENVIRONMENT}" "$contract_addresses"
        fi
        
        # Update TypeScript config
        if [ -f "$FRONTEND_DIR/src/config/contracts.ts" ]; then
            update_ts_config "$FRONTEND_DIR/src/config/contracts.ts" "$contract_addresses"
        elif [ -f "$FRONTEND_DIR/src/config/contracts.js" ]; then
            update_js_config "$FRONTEND_DIR/src/config/contracts.js" "$contract_addresses"
        fi
        
        # Update React constants
        if [ -f "$FRONTEND_DIR/src/constants/contracts.tsx" ]; then
            update_react_constants "$FRONTEND_DIR/src/constants/contracts.tsx" "$contract_addresses"
        fi
    fi
    
    # Update blockchain OS
    if [ -d "$BLOCKCHAIN_DIR" ]; then
        log_info "Updating blockchain OS configuration..."
        
        # Update environment file
        if [ -f "$BLOCKCHAIN_DIR/.env.${ENVIRONMENT}" ]; then
            update_env_file "$BLOCKCHAIN_DIR/.env.${ENVIRONMENT}" "$contract_addresses"
        fi
        
        # Update config files
        if [ -f "$BLOCKCHAIN_DIR/src/config/contracts.ts" ]; then
            update_ts_config "$BLOCKCHAIN_DIR/src/config/contracts.ts" "$contract_addresses"
        elif [ -f "$BLOCKCHAIN_DIR/src/config/contracts.js" ]; then
            update_js_config "$BLOCKCHAIN_DIR/src/config/contracts.js" "$contract_addresses"
        fi
    fi
}

# Function to create contract ABIs update script
create_abi_update_script() {
    local output_file="$DEPLOYMENT_DIR/scripts/update-contract-abis.sh"
    
    log_info "Creating ABI update script: $output_file"
    
    cat > "$output_file" << 'EOF'
#!/bin/bash

# Contract ABI Update Script
# Description: Updates contract ABIs from compiled artifacts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

ENVIRONMENT="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Find ABI files in build/artifacts
ARTIFACTS_DIR="$ROOT_DIR/contracts/artifacts"
if [ -d "$ARTIFACTS_DIR" ]; then
    log_info "Extracting ABIs from artifacts..."
    
    for abi_file in "$ARTIFACTS_DIR"/*.json; do
        if [ -f "$abi_file" ]; then
            # Extract ABI and save to a more accessible location
            contract_name=$(basename "$abi_file" .json)
            jq -r '.abi' "$abi_file" > "$SCRIPT_DIR/../deployment/abis/${contract_name}.json"
            log_success "Extracted ABI for $contract_name"
        fi
    done
else
    log_info "No artifacts directory found, skipping ABI extraction"
fi
EOF

    chmod +x "$output_file"
    log_success "Created ABI update script: $output_file"
}

# Function to generate update report
generate_update_report() {
    local report_file="$DEPLOYMENT_DIR/logs/contract-addresses-update-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating update report: $report_file"
    
    cat > "$report_file" << EOF
# Contract Addresses Update Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Network:** $NETWORK_NAME
**Chain ID:** $CHAIN_ID

## Updated Files

| File | Status | Backup |
|------|--------|--------|
EOF

    # List updated files
    if [ -d "$FRONTEND_DIR" ]; then
        echo "| $FRONTEND_DIR/.env.${ENVIRONMENT} | ✅ | $(ls -la $FRONTEND_DIR/.env.${ENVIRONMENT}.backup.* 2>/dev/null | tail -1 | awk '{print $NF}' | xargs basename)" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Contract Addresses

\`\`\`json
$(read_contract_addresses)
\`\`\`

## Network Configuration

- **Name:** $NETWORK_NAME
- **Chain ID:** $CHAIN_ID
- **RPC URL:** $RPC_URL
- **Explorer:** $EXPLORER_URL

## Next Steps

1. Rebuild frontend applications
2. Test contract interactions
3. Update API documentation
4. Deploy updated frontend

EOF
}

# Main update function
main() {
    log_info "Starting contract addresses update..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Frontend Dir: $FRONTEND_DIR"
    log_info "Blockchain Dir: $BLOCKCHAIN_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual updates will occur"
    fi
    
    # Create addresses file if needed
    create_addresses_file
    
    # Read current contract addresses
    local contract_addresses=$(read_contract_addresses)
    
    # Update all frontend configurations
    update_frontend_configs "$contract_addresses"
    
    # Create ABI update script
    create_abi_update_script
    
    # Generate report
    generate_update_report
    
    log_success "Contract addresses update completed!"
    log_info "Update report: $DEPLOYMENT_DIR/logs/contract-addresses-update-${ENVIRONMENT}-*.md"
    
    if [ "$DRY_RUN" = false ]; then
        log_info "Backups created for all modified files"
        log_info "You may now rebuild your frontend applications"
    fi
}

# Run main function
main "$@"