#!/bin/bash

# SylOS System Check Script
# Description: Comprehensive system validation before deployment

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
QUICK_CHECK=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -q|--quick)
            QUICK_CHECK=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Comprehensive system check for SylOS deployment"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -q, --quick         Quick check mode"
            echo "  -v, --verbose       Verbose output"
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
ENV_FILE="$SCRIPT_DIR/../environments/${ENVIRONMENT}.env"

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# Configuration
LOG_FILE="$SCRIPT_DIR/../deployment/logs/system-check-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

# Create log file
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log and print
log_both() {
    echo "$1" | tee -a "$LOG_FILE"
}

# Function to run check
run_check() {
    local check_name="$1"
    local check_command="$2"
    local required="$3"
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if [ "$VERBOSE" = true ]; then
        log_info "Running check: $check_name"
    fi
    
    if eval "$check_command" &>> "$LOG_FILE"; then
        log_success "$check_name"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        if [ "$required" = "true" ]; then
            log_error "$check_name FAILED"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        else
            log_warning "$check_name warning"
            return 0
        fi
    fi
}

# Function to check command availability
check_command() {
    local cmd="$1"
    if command -v "$cmd" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check file existence
check_file() {
    local file="$1"
    [ -f "$file" ]
}

# Function to check directory existence
check_dir() {
    local dir="$1"
    [ -d "$dir" ]
}

# Function to check URL accessibility
check_url() {
    local url="$1"
    if curl -s --max-time 10 "$url" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check environment variable
check_env_var() {
    local var_name="$1"
    [ -n "${!var_name}" ]
}

# System Requirements Check
check_system_requirements() {
    log_info "Checking system requirements..."
    
    run_check "Node.js installed" "check_command node" "true"
    run_check "npm/pnpm available" "check_command pnpm || check_command npm" "true"
    run_check "Git installed" "check_command git" "true"
    run_check "cURL available" "check_command curl" "true"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        run_check "rsync available" "check_command rsync" "true"
        run_check "jq available" "check_command jq" "true"
    fi
}

# Project Structure Check
check_project_structure() {
    log_info "Checking project structure..."
    
    run_check "Deployment scripts exist" "check_dir $SCRIPT_DIR" "true"
    run_check "Frontend project exists" "check_dir $ROOT_DIR/minimax-os" "false"
    run_check "Blockchain project exists" "check_dir $ROOT_DIR/sylos-blockchain-os" "false"
    run_check "Mobile project exists" "check_dir $ROOT_DIR/sylos-mobile-new" "false"
    run_check "Environment files exist" "check_file $ENV_FILE" "true"
    
    if [ "$QUICK_CHECK" = false ]; then
        run_check "Git repository" "check_dir $ROOT_DIR/.git" "false"
    fi
}

# Environment Configuration Check
check_environment_config() {
    log_info "Checking environment configuration..."
    
    run_check "Network name configured" "check_env_var NETWORK_NAME" "true"
    run_check "RPC URL configured" "check_env_var RPC_URL" "true"
    run_check "Chain ID configured" "check_env_var CHAIN_ID" "true"
    run_check "Explorer URL configured" "check_env_var EXPLORER_URL" "true"
    run_check "Currency symbol configured" "check_env_var CURRENCY_SYMBOL" "true"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        run_check "Production database URL" "check_env_var DATABASE_URL" "true"
        run_check "Frontend URL configured" "check_env_var FRONTEND_URL" "true"
    fi
}

# Dependencies Check
check_dependencies() {
    log_info "Checking project dependencies..."
    
    if [ -f "$ROOT_DIR/package.json" ]; then
        run_check "Root package.json valid" "cd $ROOT_DIR && node -e 'require(\"./package.json\")' > /dev/null" "true"
    fi
    
    if [ -d "$ROOT_DIR/minimax-os" ]; then
        if [ -f "$ROOT_DIR/minimax-os/package.json" ]; then
            run_check "Main frontend dependencies" "cd $ROOT_DIR/minimax-os && (pnpm install --dry-run || npm install --dry-run) > /dev/null" "true"
        fi
    fi
    
    if [ -d "$ROOT_DIR/sylos-blockchain-os" ]; then
        if [ -f "$ROOT_DIR/sylos-blockchain-os/package.json" ]; then
            run_check "Blockchain OS dependencies" "cd $ROOT_DIR/sylos-blockchain-os && (pnpm install --dry-run || npm install --dry-run) > /dev/null" "true"
        fi
    fi
    
    if [ -d "$ROOT_DIR/sylos-mobile-new" ]; then
        if [ -f "$ROOT_DIR/sylos-mobile-new/package.json" ]; then
            run_check "Mobile app dependencies" "cd $ROOT_DIR/sylos-mobile-new && (pnpm install --dry-run || npm install --dry-run) > /dev/null" "true"
        fi
    fi
}

# Network Connectivity Check
check_network_connectivity() {
    log_info "Checking network connectivity..."
    
    run_check "Internet connectivity" "check_url https://google.com" "true"
    run_check "RPC endpoint accessible" "check_url $RPC_URL" "true"
    run_check "Block explorer accessible" "check_url $EXPLORER_URL" "false"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        run_check "IPFS gateway accessible" "check_url $IPFS_GATEWAY_DEFAULT" "false"
        run_check "CDN accessible" "check_url $CDN_URL" "false"
    fi
}

# Database Connectivity Check
check_database_connectivity() {
    if [ "$ENVIRONMENT" = "production" ] && [ "$QUICK_CHECK" = false ]; then
        log_info "Checking database connectivity..."
        
        if [ -n "$DATABASE_URL" ]; then
            run_check "Database connection" "psql $DATABASE_URL -c 'SELECT 1;' > /dev/null" "false"
        fi
        
        if [ -n "$REDIS_URL" ]; then
            run_check "Redis connection" "redis-cli -u $REDIS_URL ping | grep -q PONG" "false"
        fi
    fi
}

# Security Configuration Check
check_security_config() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Checking security configuration..."
        
        # Check for secrets in environment
        run_check "No hardcoded secrets in config" "! grep -r 'PRIVATE_KEY' $ROOT_DIR --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null" "true"
        
        # Check for environment variables
        run_check "Supabase configuration" "check_env_var SUPABASE_URL && check_env_var SUPABASE_ANON_KEY" "false"
        run_check "IPFS configuration" "check_env_var PINATA_API_KEY" "false"
        
        # Check file permissions
        run_check "Environment file permissions" "[ \$(stat -c %a $ENV_FILE) -le 644 ]" "false"
    fi
}

# Build Tools Check
check_build_tools() {
    if [ "$QUICK_CHECK" = false ]; then
        log_info "Checking build tools..."
        
        # Check for contract deployment tools
        if [ -f "$ROOT_DIR/contracts/hardhat.config.js" ] || [ -f "$ROOT_DIR/contracts/hardhat.config.ts" ]; then
            run_check "Hardhat available" "check_command npx && echo | npx hardhat --version > /dev/null 2>&1" "false"
        fi
        
        if [ -f "$ROOT_DIR/contracts/foundry.toml" ]; then
            run_check "Foundry available" "check_command forge" "false"
        fi
        
        # Check for mobile build tools
        if [ -d "$ROOT_DIR/sylos-mobile-new" ]; then
            run_check "Expo CLI available" "check_command expo || npm list -g @expo/cli > /dev/null 2>&1" "false"
        fi
    fi
}

# Disk Space Check
check_disk_space() {
    if [ "$QUICK_CHECK" = false ]; then
        log_info "Checking disk space..."
        
        # Check available disk space (require at least 1GB)
        local available_space=$(df . | tail -1 | awk '{print $4}')
        if [ "$available_space" -gt 1048576 ]; then
            log_success "Sufficient disk space"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            log_warning "Low disk space"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
        CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    fi
}

# Memory Check
check_memory() {
    if [ "$QUICK_CHECK" = false ]; then
        log_info "Checking available memory..."
        
        # Check available memory (require at least 2GB)
        local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        if [ "$available_memory" -gt 2048 ]; then
            log_success "Sufficient memory available"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
        else
            log_warning "Low memory available ($available_memory MB)"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
        fi
        CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    fi
}

# Generate system check report
generate_report() {
    local report_file="$SCRIPT_DIR/../deployment/logs/system-check-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating system check report: $report_file"
    
    cat > "$report_file" << EOF
# System Check Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Check Mode:** $([ "$QUICK_CHECK" = true ] && echo "Quick" || echo "Comprehensive")
**Verbose:** $([ "$VERBOSE" = true ] && echo "Yes" || echo "No")

## Summary

- **Total Checks:** $CHECKS_TOTAL
- **Passed:** $CHECKS_PASSED ✅
- **Failed:** $CHECKS_FAILED ❌
- **Success Rate:** $(( (CHECKS_PASSED * 100) / CHECKS_TOTAL ))%

## Check Results

### System Requirements
EOF

    # Add check results
    cat "$LOG_FILE" | grep -E "\[SUCCESS\]|\[ERROR\]|\[WARNING\]" >> "$report_file"

    cat >> "$report_file" << EOF

## Recommendations

EOF

    if [ "$CHECKS_FAILED" -gt 0 ]; then
        echo "❌ **Action Required:** Some checks failed. Please address the issues before deployment." >> "$report_file"
    else
        echo "✅ **Ready for Deployment:** All critical checks passed." >> "$report_file"
    fi

    if [ "$ENVIRONMENT" = "production" ]; then
        echo "" >> "$report_file"
        echo "⚠️ **Production Deployment:** Ensure all security checks pass before proceeding." >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Next Steps

1. Review any failed checks
2. Address security concerns
3. Ensure all dependencies are installed
4. Verify network connectivity
5. Proceed with deployment when ready

Full logs available at: $LOG_FILE
EOF

    log_success "System check report generated: $report_file"
}

# Main function
main() {
    log_info "Starting SylOS system check..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Quick Check: $QUICK_CHECK"
    log_info "Verbose: $VERBOSE"
    
    # Start logging
    exec > >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE")
    
    # Run all checks
    check_system_requirements
    check_project_structure
    check_environment_config
    check_dependencies
    check_network_connectivity
    check_database_connectivity
    check_security_config
    check_build_tools
    check_disk_space
    check_memory
    
    # Generate report
    generate_report
    
    # Final summary
    log_info "System check completed!"
    log_info "Total checks: $CHECKS_TOTAL"
    log_info "Passed: $CHECKS_PASSED"
    log_info "Failed: $CHECKS_FAILED"
    
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        log_success "System is ready for deployment!"
        exit 0
    else
        log_error "System has issues that need to be addressed before deployment"
        exit 1
    fi
}

# Run main function
main "$@"