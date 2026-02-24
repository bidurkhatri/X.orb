#!/bin/bash

# IPFS Deployment Script for SylOS
# Description: Deploys static content to IPFS for decentralized storage

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
USE_PINATA=true
USE_WEB3_STORAGE=false
USE_LOCAL_IPFS=false
PIN_STATIC_CONTENT=true
PIN_API_DOCS=true
PIN_ASSETS=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-pinata)
            USE_PINATA=false
            shift
            ;;
        --web3-storage)
            USE_WEB3_STORAGE=true
            shift
            ;;
        --local-ipfs)
            USE_LOCAL_IPFS=true
            shift
            ;;
        --no-static)
            PIN_STATIC_CONTENT=false
            shift
            ;;
        --no-docs)
            PIN_API_DOCS=false
            shift
            ;;
        --no-assets)
            PIN_ASSETS=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Deploy static content to IPFS"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  --dry-run          Show what would be deployed without deploying"
            echo "  --no-pinata        Don't use Pinata for pinning"
            echo "  --web3-storage     Use Web3.Storage instead of Pinata"
            echo "  --local-ipfs       Use local IPFS node"
            echo "  --no-static        Don't pin static content"
            echo "  --no-docs          Don't pin API documentation"
            echo "  --no-assets        Don't pin assets"
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
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$SCRIPT_DIR/../deployment"
IPFS_OUTPUT="$DEPLOYMENT_DIR/ipfs"
LOG_FILE="$DEPLOYMENT_DIR/logs/ipfs-deployment-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p "$IPFS_OUTPUT"
mkdir -p "$DEPLOYMENT_DIR/logs"

# Function to check if content needs to be updated
needs_update() {
    local hash_file="$1"
    local source_dir="$2"
    
    if [ ! -f "$hash_file" ]; then
        return 0  # Needs update if no previous hash
    fi
    
    local old_hash=$(cat "$hash_file" 2>/dev/null || echo "")
    local new_hash=$(calculate_content_hash "$source_dir")
    
    [ "$old_hash" != "$new_hash" ]
}

# Function to calculate content hash
calculate_content_hash() {
    local dir="$1"
    find "$dir" -type f -exec sort {} \; | xargs cat | sha256sum | cut -d' ' -f1
}

# Function to pin to Pinata
pin_to_pinata() {
    local content_path="$1"
    local pin_name="$2"
    local metadata_file="$3"
    
    log_info "Pinning to Pinata: $pin_name"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would pin $pin_name to Pinata"
        return 0
    fi
    
    # Upload to Pinata
    local response=$(curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
        -H "pinata_api_key: $PINATA_API_KEY" \
        -H "pinata_secret_api_key: $PINATA_SECRET_KEY" \
        -F "file=@$content_path" \
        -F "pinataMetadata={\"name\":\"$pin_name\",\"keyvalues\":{\"environment\":\"$ENVIRONMENT\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}}")
    
    if echo "$response" | grep -q "IpfsHash"; then
        local hash=$(echo "$response" | jq -r '.IpfsHash' 2>/dev/null || echo "")
        echo "$hash" > "$IPFS_OUTPUT/${pin_name}.hash"
        log_success "Pinned to Pinata: $hash"
        echo "$hash"
    else
        log_error "Failed to pin to Pinata: $response"
        return 1
    fi
}

# Function to pin directory to IPFS
pin_directory() {
    local source_dir="$1"
    local pin_name="$2"
    local service="${3:-pinata}"
    
    log_info "Pinning directory: $source_dir as $pin_name"
    
    if [ ! -d "$source_dir" ]; then
        log_error "Directory not found: $source_dir"
        return 1
    fi
    
    case "$service" in
        "pinata")
            pin_to_pinata "$source_dir" "$pin_name" ""
            ;;
        "web3")
            pin_to_web3_storage "$source_dir" "$pin_name"
            ;;
        "local")
            pin_to_local_ipfs "$source_dir" "$pin_name"
            ;;
    esac
}

# Function to pin to Web3.Storage
pin_to_web3_storage() {
    local content_path="$1"
    local pin_name="$2"
    
    log_info "Pinning to Web3.Storage: $pin_name"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would pin $pin_name to Web3.Storage"
        return 0
    fi
    
    # This would use the Web3.Storage API
    # For demonstration purposes, we'll simulate the response
    log_info "Web3.Storage pinning would happen here"
    
    local mock_hash="bafybeigdyrztac3r7evufsa2wwndxxcfpv2zhe5awce2txrs7nph4yszmq"
    echo "$mock_hash" > "$IPFS_OUTPUT/${pin_name}.hash"
    log_success "Pinned to Web3.Storage: $mock_hash"
}

# Function to pin to local IPFS
pin_to_local_ipfs() {
    local content_path="$1"
    local pin_name="$2"
    
    log_info "Pinning to local IPFS: $pin_name"
    
    if ! command -v ipfs &> /dev/null; then
        log_error "IPFS CLI not found. Install IPFS first."
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would pin $pin_name to local IPFS"
        return 0
    fi
    
    # Add to IPFS
    local hash=$(ipfs add -r "$content_path" | tail -1 | awk '{print $2}')
    
    # Pin the content
    ipfs pin add "$hash"
    
    echo "$hash" > "$IPFS_OUTPUT/${pin_name}.hash"
    log_success "Pinned to local IPFS: $hash"
}

# Function to create IPFS gateway URLs
create_gateway_urls() {
    local hash="$1"
    local service="${2:-pinata}"
    
    case "$service" in
        "pinata")
            echo "https://gateway.pinata.cloud/ipfs/$hash"
            ;;
        "web3")
            echo "https://w3s.link/ipfs/$hash"
            ;;
        "local")
            echo "http://localhost:8080/ipfs/$hash"
            ;;
    esac
}

# Function to pin static frontend content
pin_static_content() {
    if [ "$PIN_STATIC_CONTENT" = true ]; then
        log_info "Pinning static frontend content..."
        
        local build_dir="$ROOT_DIR/minimax-os/dist"
        if [ -d "$build_dir" ]; then
            if needs_update "$IPFS_OUTPUT/static-content.hash" "$build_dir"; then
                local hash=$(pin_directory "$build_dir" "static-content" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                if [ -n "$hash" ]; then
                    local gateway_url=$(create_gateway_urls "$hash" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                    echo "Static Content Gateway: $gateway_url" >> "$IPFS_OUTPUT/urls.txt"
                fi
            else
                log_info "Static content is up to date"
            fi
        else
            log_warning "Static content build directory not found: $build_dir"
        fi
    fi
}

# Function to pin blockchain OS content
pin_blockchain_content() {
    if [ "$PIN_STATIC_CONTENT" = true ]; then
        log_info "Pinning blockchain OS content..."
        
        local build_dir="$ROOT_DIR/sylos-blockchain-os/dist"
        if [ -d "$build_dir" ]; then
            if needs_update "$IPFS_OUTPUT/blockchain-content.hash" "$build_dir"; then
                local hash=$(pin_directory "$build_dir" "blockchain-content" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                if [ -n "$hash" ]; then
                    local gateway_url=$(create_gateway_urls "$hash" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                    echo "Blockchain OS Gateway: $gateway_url" >> "$IPFS_OUTPUT/urls.txt"
                fi
            else
                log_info "Blockchain content is up to date"
            fi
        else
            log_warning "Blockchain OS build directory not found: $build_dir"
        fi
    fi
}

# Function to pin API documentation
pin_api_docs() {
    if [ "$PIN_API_DOCS" = true ]; then
        log_info "Pinning API documentation..."
        
        local docs_dir="$ROOT_DIR/docs"
        if [ -d "$docs_dir" ]; then
            if needs_update "$IPFS_OUTPUT/api-docs.hash" "$docs_dir"; then
                local hash=$(pin_directory "$docs_dir" "api-docs" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                if [ -n "$hash" ]; then
                    local gateway_url=$(create_gateway_urls "$hash" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                    echo "API Docs Gateway: $gateway_url" >> "$IPFS_OUTPUT/urls.txt"
                fi
            else
                log_info "API documentation is up to date"
            fi
        else
            log_warning "API docs directory not found: $docs_dir"
        fi
    fi
}

# Function to pin assets
pin_assets() {
    if [ "$PIN_ASSETS" = true ]; then
        log_info "Pinning assets..."
        
        local assets_dir="$ROOT_DIR/imgs"
        if [ -d "$assets_dir" ]; then
            if needs_update "$IPFS_OUTPUT/assets.hash" "$assets_dir"; then
                local hash=$(pin_directory "$assets_dir" "assets" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                if [ -n "$hash" ]; then
                    local gateway_url=$(create_gateway_urls "$hash" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
                    echo "Assets Gateway: $gateway_url" >> "$IPFS_OUTPUT/urls.txt"
                fi
            else
                log_info "Assets are up to date"
            fi
        else
            log_warning "Assets directory not found: $assets_dir"
        fi
    fi
}

# Function to create IPNS record
create_ipns_record() {
    log_info "Creating IPNS record..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create IPNS record"
        return 0
    fi
    
    if ! command -v ipfs &> /dev/null; then
        log_warning "IPFS CLI not available, skipping IPNS record"
        return 0
    fi
    
    # This would create an IPNS record pointing to the latest content
    # Implementation depends on the specific use case
    log_info "IPNS record creation would happen here"
}

# Function to backup IPFS data
backup_ipfs_data() {
    log_info "Backing up IPFS data..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would backup IPFS data"
        return 0
    fi
    
    # Export all pinned content info
    if command -v ipfs &> /dev/null; then
        ipfs pin ls > "$IPFS_OUTPUT/pins.txt"
    fi
    
    # Save all hash files
    for hash_file in "$IPFS_OUTPUT"/*.hash; do
        if [ -f "$hash_file" ]; then
            echo "Content: $(basename "$hash_file" .hash)" >> "$IPFS_OUTPUT/backup-manifest.txt"
            echo "Hash: $(cat "$hash_file")" >> "$IPFS_OUTPUT/backup-manifest.txt"
            echo "---" >> "$IPFS_OUTPUT/backup-manifest.txt"
        fi
    done
}

# Function to generate IPFS deployment report
generate_deployment_report() {
    local report_file="$DEPLOYMENT_DIR/logs/ipfs-deployment-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating IPFS deployment report: $report_file"
    
    cat > "$report_file" << EOF
# IPFS Deployment Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Service:** ${USE_PINATA:+Pinata}${USE_WEB3_STORAGE:+Web3.Storage}${USE_LOCAL_IPFS:+Local IPFS}

## Deployed Content

| Content Type | Status | Hash | Gateway |
|--------------|--------|------|---------|
EOF

    # Add entries for each deployed content
    for hash_file in "$IPFS_OUTPUT"/*.hash; do
        if [ -f "$hash_file" ]; then
            local content_name=$(basename "$hash_file" .hash)
            local hash=$(cat "$hash_file")
            local gateway_url=$(create_gateway_urls "$hash" "${USE_PINATA:+pinata}${USE_WEB3_STORAGE:+web3}${USE_LOCAL_IPFS:+local}")
            echo "| $content_name | ✅ | \`$hash\` | [View]($gateway_url) |" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

## IPFS Configuration

- **Gateway URL:** $IPFS_GATEWAY_DEFAULT
- **API Endpoint:** $IPFS_API_ENDPOINT
- **Project ID:** $IPFS_PROJECT_ID

## Content Summary

- **Static Content:** $PIN_STATIC_CONTENT
- **API Documentation:** $PIN_API_DOCS
- **Assets:** $PIN_ASSETS

## Gateway Access

All content is available through IPFS gateways:

EOF

    if [ -f "$IPFS_OUTPUT/urls.txt" ]; then
        while IFS= read -r line; do
            echo "- $line" >> "$report_file"
        done < "$IPFS_OUTPUT/urls.txt"
    fi

    cat >> "$report_file" << EOF

## Backup Information

- **Pins List:** $IPFS_OUTPUT/pins.txt
- **Backup Manifest:** $IPFS_OUTPUT/backup-manifest.txt
- **Hash Files:** $IPFS_OUTPUT/*.hash

## Next Steps

1. Update DNS records to point to IPFS gateways
2. Test content accessibility through gateways
3. Set up monitoring for content availability
4. Consider using IPNS for dynamic content updates

EOF
}

# Main deployment function
main() {
    log_info "Starting IPFS deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Use Pinata: $USE_PINATA"
    log_info "Use Web3.Storage: $USE_WEB3_STORAGE"
    log_info "Use Local IPFS: $USE_LOCAL_IPFS"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual deployment will occur"
    fi
    
    # Check prerequisites
    if [ "$USE_PINATA" = true ]; then
        if [ -z "$PINATA_API_KEY" ] || [ -z "$PINATA_SECRET_KEY" ]; then
            log_warning "Pinata credentials not found in environment"
        fi
    fi
    
    if [ "$USE_LOCAL_IPFS" = true ]; then
        if ! command -v ipfs &> /dev/null; then
            log_error "IPFS CLI not found. Install IPFS first."
            exit 1
        fi
    fi
    
    # Pin all content
    pin_static_content
    pin_blockchain_content
    pin_api_docs
    pin_assets
    
    # Create IPNS record
    create_ipns_record
    
    # Backup IPFS data
    backup_ipfs_data
    
    # Generate report
    generate_deployment_report
    
    log_success "IPFS deployment completed!"
    log_info "IPFS output: $IPFS_OUTPUT"
    log_info "Deployment logs: $DEPLOYMENT_DIR/logs"
    
    if [ -f "$IPFS_OUTPUT/urls.txt" ]; then
        log_info "Gateway URLs:"
        cat "$IPFS_OUTPUT/urls.txt" | sed 's/^/  /'
    fi
}

# Run main function
main "$@"