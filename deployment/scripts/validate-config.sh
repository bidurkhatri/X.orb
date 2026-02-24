#!/bin/bash

# Configuration Validation Script for SylOS
# Description: Validates all configuration files and settings

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
VALIDATE_ALL=false
STRICT_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--all)
            VALIDATE_ALL=true
            shift
            ;;
        -s|--strict)
            STRICT_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Validate SylOS configuration"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -a, --all          Validate all environments"
            echo "  -s, --strict       Strict validation mode"
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
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
VALIDATION_LOG="$SCRIPT_DIR/../deployment/logs/config-validation-$(date +%Y%m%d_%H%M%S).log"
ERRORS=0
WARNINGS=0

# Create log directory
mkdir -p "$(dirname "$VALIDATION_LOG")"

# Function to validate environment file
validate_env_file() {
    local env_file="$1"
    local env_name="$2"
    
    log_info "Validating environment file: $env_name"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
    
    # Check required variables
    local required_vars=(
        "NETWORK_NAME"
        "RPC_URL"
        "CHAIN_ID"
        "EXPLORER_URL"
        "CURRENCY_SYMBOL"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            log_error "Missing required variable: $var"
            ERRORS=$((ERRORS + 1))
        fi
    done
    
    # Check URL formats
    if grep -q "RPC_URL=" "$env_file"; then
        local rpc_url=$(grep "RPC_URL=" "$env_file" | cut -d'=' -f2)
        if [[ ! "$rpc_url" =~ ^https?:// ]]; then
            log_error "Invalid RPC URL format: $rpc_url"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    if grep -q "EXPLORER_URL=" "$env_file"; then
        local explorer_url=$(grep "EXPLORER_URL=" "$env_file" | cut -d'=' -f2)
        if [[ ! "$explorer_url" =~ ^https?:// ]]; then
            log_error "Invalid explorer URL format: $explorer_url"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    # Check for sensitive data
    if grep -i "private_key.*=.*0x[0-9a-fA-F]{40,}" "$env_file" > /dev/null; then
        log_warning "Private key found in environment file (should be in secrets)"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check for common mistakes
    if grep -q "localhost" "$env_file" && [ "$env_name" = "production" ]; then
        log_error "localhost found in production configuration"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ "$STRICT_MODE" = true ]; then
        # Additional strict checks
        if grep -q "example\.com" "$env_file"; then
            log_error "Placeholder domain found: example.com"
            ERRORS=$((ERRORS + 1))
        fi
        
        if grep -q "your_.*_here" "$env_file"; then
            log_error "Placeholder values found in configuration"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    log_success "Environment file validation completed"
}

# Function to validate project configuration
validate_project_config() {
    local project_dir="$1"
    local project_name="$2"
    
    log_info "Validating $project_name configuration..."
    
    if [ ! -d "$project_dir" ]; then
        log_warning "Project directory not found: $project_dir"
        WARNINGS=$((WARNINGS + 1))
        return 0
    fi
    
    # Check package.json
    if [ -f "$project_dir/package.json" ]; then
        if ! node -e "require('./$project_dir/package.json')" > /dev/null 2>&1; then
            log_error "Invalid package.json in $project_name"
            ERRORS=$((ERRORS + 1))
        fi
        
        # Check for required scripts
        if ! grep -q "\"build\"" "$project_dir/package.json"; then
            log_error "Missing 'build' script in $project_name package.json"
            ERRORS=$((ERRORS + 1))
        fi
    else
        log_warning "package.json not found in $project_name"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check TypeScript configuration
    if [ -f "$project_dir/tsconfig.json" ]; then
        if ! node -e "require('./$project_dir/tsconfig.json')" > /dev/null 2>&1; then
            log_error "Invalid tsconfig.json in $project_name"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    # Check Vite configuration (if exists)
    if [ -f "$project_dir/vite.config.ts" ] || [ -f "$project_dir/vite.config.js" ]; then
        if ! node -e "require('./$project_dir/vite.config.ts')" > /dev/null 2>&1; then
            if ! node -e "require('./$project_dir/vite.config.js')" > /dev/null 2>&1; then
                log_error "Invalid Vite configuration in $project_name"
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
    
    log_success "$project_name configuration validation completed"
}

# Function to validate contract configuration
validate_contract_config() {
    local contracts_dir="$ROOT_DIR/contracts"
    
    if [ ! -d "$contracts_dir" ]; then
        log_info "No contracts directory found, skipping contract validation"
        return 0
    fi
    
    log_info "Validating contract configuration..."
    
    # Check for Hardhat configuration
    if [ -f "$contracts_dir/hardhat.config.js" ] || [ -f "$contracts_dir/hardhat.config.ts" ]; then
        if ! node -e "require('./$contracts_dir/hardhat.config.js')" > /dev/null 2>&1; then
            if ! node -e "require('./$contracts_dir/hardhat.config.ts')" > /dev/null 2>&1; then
                log_error "Invalid Hardhat configuration"
                ERRORS=$((ERRORS + 1))
            fi
        fi
        
        # Check for network configuration
        if ! grep -q "networks:" "$contracts_dir/hardhat.config.js" "$contracts_dir/hardhat.config.ts" 2>/dev/null; then
            log_warning "No network configuration found in Hardhat config"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
    
    # Check for Foundry configuration
    if [ -f "$contracts_dir/foundry.toml" ]; then
        if [ ! -f "$contracts_dir/script/Deploy.s.sol" ]; then
            log_warning "Foundry configuration found but no deploy script"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
    
    # Check for contracts directory structure
    if [ ! -d "$contracts_dir/contracts" ]; then
        log_error "No contracts directory found"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for deployment scripts
    if [ ! -d "$contracts_dir/scripts" ] && [ ! -d "$contracts_dir/script" ]; then
        log_warning "No deployment scripts directory found"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    log_success "Contract configuration validation completed"
}

# Function to validate CI/CD configuration
validate_cicd_config() {
    log_info "Validating CI/CD configuration..."
    
    # Check GitHub Actions configuration
    if [ -f "$ROOT_DIR/.github/workflows/*.yml" ]; then
        for workflow in "$ROOT_DIR/.github/workflows/"*.yml; do
            if [ -f "$workflow" ]; then
                if ! python -c "import yaml; yaml.safe_load(open('$workflow'))" > /dev/null 2>&1; then
                    log_error "Invalid YAML in GitHub Actions workflow: $workflow"
                    ERRORS=$((ERRORS + 1))
                fi
            fi
        done
    fi
    
    # Check GitLab CI configuration
    if [ -f "$ROOT_DIR/.gitlab-ci.yml" ]; then
        if ! python -c "import yaml; yaml.safe_load(open('$ROOT_DIR/.gitlab-ci.yml'))" > /dev/null 2>&1; then
            log_error "Invalid GitLab CI configuration"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    
    # Check deployment scripts
    if [ ! -x "$SCRIPT_DIR/deploy-sylos.sh" ]; then
        log_warning "Main deployment script is not executable"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Validate all deployment scripts
    for script in "$SCRIPT_DIR/scripts/"*.sh; do
        if [ -f "$script" ]; then
            # Check if script has syntax errors
            if ! bash -n "$script" > /dev/null 2>&1; then
                log_error "Syntax error in script: $script"
                ERRORS=$((ERRORS + 1))
            fi
            
            # Check if script is executable
            if [ ! -x "$script" ] && [ "$STRICT_MODE" = true ]; then
                log_warning "Script is not executable: $script"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    done
    
    log_success "CI/CD configuration validation completed"
}

# Function to validate secrets configuration
validate_secrets_config() {
    if [ "$ENVIRONMENT" = "production" ] || [ "$STRICT_MODE" = true ]; then
        log_info "Validating secrets configuration..."
        
        local secrets_file="$SCRIPT_DIR/../config/secrets.env"
        if [ -f "$secrets_file" ]; then
            log_warning "Secrets file found in repository (should be in .gitignore)"
            WARNINGS=$((WARNINGS + 1))
        fi
        
        # Check .gitignore
        if [ -f "$ROOT_DIR/.gitignore" ]; then
            if ! grep -q "\.env" "$ROOT_DIR/.gitignore"; then
                log_warning ".env files not in .gitignore"
                WARNINGS=$((WARNINGS + 1))
            fi
            
            if ! grep -q "secrets" "$ROOT_DIR/.gitignore"; then
                log_warning "secrets directory not in .gitignore"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            log_error ".gitignore file not found"
            ERRORS=$((ERRORS + 1))
        fi
        
        log_success "Secrets configuration validation completed"
    fi
}

# Function to validate file permissions
validate_file_permissions() {
    if [ "$STRICT_MODE" = true ]; then
        log_info "Validating file permissions..."
        
        # Check deployment scripts permissions
        for script in "$SCRIPT_DIR/"*.sh "$SCRIPT_DIR/scripts/"*.sh; do
            if [ -f "$script" ]; then
                if [ "$(stat -c %a "$script")" != "755" ]; then
                    log_warning "Incorrect permissions on script: $script (should be 755)"
                    WARNINGS=$((WARNINGS + 1))
                fi
            fi
        done
        
        # Check environment files permissions
        for env_file in "$SCRIPT_DIR/../environments/"*.env; do
            if [ -f "$env_file" ]; then
                if [ "$(stat -c %a "$env_file")" -gt 644 ]; then
                    log_warning "Environment file has excessive permissions: $env_file"
                    WARNINGS=$((WARNINGS + 1))
                fi
            fi
        done
        
        log_success "File permissions validation completed"
    fi
}

# Function to generate validation report
generate_report() {
    local report_file="$SCRIPT_DIR/../deployment/logs/config-validation-report-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating validation report: $report_file"
    
    cat > "$report_file" << EOF
# Configuration Validation Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Strict Mode:** $([ "$STRICT_MODE" = true ] && echo "Yes" || echo "No")

## Summary

- **Errors:** $ERRORS ❌
- **Warnings:** $WARNINGS ⚠️

## Status

EOF

    if [ "$ERRORS" -eq 0 ]; then
        echo "✅ **Configuration is valid**" >> "$report_file"
    else
        echo "❌ **Configuration has errors that need to be fixed**" >> "$report_file"
    fi

    if [ "$WARNINGS" -gt 0 ]; then
        echo "⚠️ **$WARNINGS warnings found**" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Recommendations

EOF

    if [ "$ERRORS" -gt 0 ]; then
        echo "1. **Fix all errors** before proceeding with deployment" >> "$report_file"
    fi

    if [ "$WARNINGS" -gt 0 ]; then
        echo "2. **Address warnings** to improve configuration quality" >> "$report_file"
    fi

    if [ "$STRICT_MODE" = true ]; then
        echo "3. **Run in non-strict mode** for development if needed" >> "$report_file"
    else
        echo "3. **Run in strict mode** for production deployments" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Next Steps

1. Review the validation log for detailed information
2. Fix identified errors and warnings
3. Re-run validation
4. Proceed with deployment when clean

Full validation log: $VALIDATION_LOG
EOF

    log_success "Validation report generated: $report_file"
}

# Main function
main() {
    log_info "Starting SylOS configuration validation..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Strict Mode: $STRICT_MODE"
    
    # Start logging
    exec > >(tee -a "$VALIDATION_LOG")
    exec 2> >(tee -a "$VALIDATION_LOG")
    
    # Determine which environments to validate
    if [ "$VALIDATE_ALL" = true ]; then
        local environments=("development" "staging" "production")
    else
        local environments=("$ENVIRONMENT")
    fi
    
    # Validate each environment
    for env in "${environments[@]}"; do
        log_info "Validating environment: $env"
        local env_file="$SCRIPT_DIR/../environments/${env}.env"
        validate_env_file "$env_file" "$env"
    done
    
    # Validate project configurations
    validate_project_config "$ROOT_DIR/minimax-os" "Main Frontend"
    validate_project_config "$ROOT_DIR/sylos-blockchain-os" "Blockchain OS"
    validate_project_config "$ROOT_DIR/sylos-mobile-new" "Mobile App"
    
    # Validate other configurations
    validate_contract_config
    validate_cicd_config
    validate_secrets_config
    validate_file_permissions
    
    # Generate report
    generate_report
    
    # Final summary
    log_info "Configuration validation completed!"
    log_info "Errors: $ERRORS"
    log_info "Warnings: $WARNINGS"
    
    if [ "$ERRORS" -eq 0 ]; then
        log_success "Configuration is valid!"
        exit 0
    else
        log_error "Configuration validation failed with $ERRORS errors"
        exit 1
    fi
}

# Run main function
main "$@"