#!/bin/bash

# Security scanning script for SylOS Blockchain OS
set -e

echo "🔒 Starting security scan for SylOS Blockchain OS..."

# Configuration
PROJECT_NAME="sylos-blockchain-os"
NODE_ENV=${NODE_ENV:-production}

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

# Initialize report
REPORT_FILE="security-report.md"
echo "# Security Scan Report - $PROJECT_NAME" > "$REPORT_FILE"
echo "**Scan Time:** $(date)" >> "$REPORT_FILE"
echo "**Environment:** $NODE_ENV" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check for sensitive files
check_sensitive_files() {
    log_info "Checking for sensitive files..."
    
    echo "## Sensitive File Check" >> "$REPORT_FILE"
    
    SENSITIVE_FILES=(
        ".env*"
        "*.key"
        "*.pem"
        "*.p12"
        "*.pfx"
        "id_rsa*"
        "id_dsa*"
        "id_ecdsa*"
        "id_ed25519*"
        "*.p12"
        "*.jks"
        "*.keystore"
        "config/secrets*"
    )
    
    FOUND_FILES=()
    for pattern in "${SENSITIVE_FILES[@]}"; do
        if find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | grep -q .; then
            FOUND_FILES+=("$pattern")
        fi
    done
    
    if [ ${#FOUND_FILES[@]} -gt 0 ]; then
        log_warning "Found potential sensitive files:"
        echo "- ❌ Found potential sensitive files:" >> "$REPORT_FILE"
        for file in "${FOUND_FILES[@]}"; do
            echo "  - $file" >> "$REPORT_FILE"
            log_warning "  - $file"
        done
    else
        log_success "No sensitive files found in public directories"
        echo "- ✅ No sensitive files found" >> "$REPORT_FILE"
    fi
}

# NPM audit
npm_audit() {
    log_info "Running npm audit..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Dependencies Security Audit" >> "$REPORT_FILE"
    
    if npm audit --audit-level moderate 2>/dev/null; then
        log_success "No security vulnerabilities found"
        echo "- ✅ No vulnerabilities found" >> "$REPORT_FILE"
    else
        log_warning "Security vulnerabilities found"
        echo "- ❌ Security vulnerabilities found:" >> "$REPORT_FILE"
        npm audit --audit-level moderate 2>&1 | tee -a "$REPORT_FILE"
    fi
}

# Snyk security scan
snyk_scan() {
    log_info "Running Snyk security scan..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Snyk Security Scan" >> "$REPORT_FILE"
    
    if command -v snyk &> /dev/null; then
        if snyk test --severity-threshold=high 2>/dev/null; then
            log_success "No high-severity vulnerabilities found by Snyk"
            echo "- ✅ No high-severity vulnerabilities found" >> "$REPORT_FILE"
        else
            log_warning "High-severity vulnerabilities found by Snyk"
            echo "- ❌ High-severity vulnerabilities found:" >> "$REPORT_FILE"
            snyk test --severity-threshold=high 2>&1 | tee -a "$REPORT_FILE"
        fi
    else
        log_warning "Snyk not installed, skipping"
        echo "- ⚠️  Snyk not installed" >> "$REPORT_FILE"
    fi
}

# Check package.json for security issues
package_security() {
    log_info "Checking package.json for security issues..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Package Configuration" >> "$REPORT_FILE"
    
    # Check for known vulnerable packages
    VULNERABLE_PACKAGES=("lodash" "moment" "express" "qs" "debug")
    FOUND_VULNS=()
    
    for pkg in "${VULNERABLE_PACKAGES[@]}"; do
        if grep -q "\"$pkg\"" package.json; then
            VERSION=$(grep "\"$pkg\"" package.json | head -1 | sed 's/.*"\(.*\)".*/\1/')
            log_info "Found package: $pkg@$VERSION"
            echo "- Package: $pkg@$VERSION" >> "$REPORT_FILE"
        fi
    done
    
    # Check scripts for security issues
    if grep -q "eval\|exec\|system\|shell" package.json; then
        log_warning "Found potentially unsafe scripts in package.json"
        echo "- ❌ Found potentially unsafe scripts" >> "$REPORT_FILE"
    else
        log_success "No unsafe scripts found in package.json"
        echo "- ✅ No unsafe scripts found" >> "$REPORT_FILE"
    fi
}

# Check for hardcoded secrets
check_hardcoded_secrets() {
    log_info "Checking for hardcoded secrets..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Hardcoded Secrets Check" >> "$REPORT_FILE"
    
    # Patterns to search for
    SECRET_PATTERNS=(
        "password\s*=\s*['\"][^'\"]+['\"]"
        "secret\s*=\s*['\"][^'\"]+['\"]"
        "key\s*=\s*['\"][^'\"]+['\"]"
        "token\s*=\s*['\"][^'\"]+['\"]"
        "api_key\s*=\s*['\"][^'\"]+['\"]"
        "private_key\s*=\s*['\"][^'\"]+['\"]"
    )
    
    FOUND_SECRETS=0
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if grep -r -E "$pattern" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null; then
            ((FOUND_SECRETS++))
        fi
    done
    
    if [ $FOUND_SECRETS -gt 0 ]; then
        log_warning "Found potential hardcoded secrets"
        echo "- ❌ Found potential hardcoded secrets: $FOUND_SECRETS instances" >> "$REPORT_FILE"
    else
        log_success "No hardcoded secrets found"
        echo "- ✅ No hardcoded secrets found" >> "$REPORT_FILE"
    fi
}

# Check environment variables
check_env_variables() {
    log_info "Checking environment variables configuration..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Environment Variables" >> "$REPORT_FILE"
    
    # Check if .env files are gitignored
    if [ -f ".env" ] && ! grep -q "^\.env$" .gitignore 2>/dev/null; then
        log_warning ".env file not in .gitignore"
        echo "- ❌ .env file not in .gitignore" >> "$REPORT_FILE"
    else
        log_success ".env files properly configured"
        echo "- ✅ .env files properly gitignored" >> "$REPORT_FILE"
    fi
    
    # Check for production secrets in config
    if grep -r -i "password\|secret\|key" .env.production 2>/dev/null | grep -v "your_.*_here\|replace.*with"; then
        log_warning "Potential production secrets in environment file"
        echo "- ⚠️  Review production environment file for actual secrets" >> "$REPORT_FILE"
    else
        log_success "No obvious production secrets found"
        echo "- ✅ No obvious production secrets found" >> "$REPORT_FILE"
    fi
}

# Check for dependency vulnerabilities
check_dependencies() {
    log_info "Checking for vulnerable dependencies..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Dependency Vulnerability Check" >> "$REPORT_FILE"
    
    # Check for outdated packages
    if command -v npm &> /dev/null; then
        OUTDATED=$(npm outdated --depth=0 2>/dev/null | wc -l)
        if [ $OUTDATED -gt 0 ]; then
            log_warning "Found $OUTDATED outdated packages"
            echo "- ⚠️  Found $OUTDATED outdated packages" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            echo "### Outdated Packages" >> "$REPORT_FILE"
            npm outdated --depth=0 2>/dev/null | tee -a "$REPORT_FILE"
        else
            log_success "All packages are up to date"
            echo "- ✅ All packages are up to date" >> "$REPORT_FILE"
        fi
    fi
}

# Check for CSRF and XSS protection
check_security_headers() {
    log_info "Checking security headers configuration..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Security Headers Configuration" >> "$REPORT_FILE"
    
    # Check if security config exists
    if [ -f "config/security.ts" ]; then
        log_success "Security configuration found"
        echo "- ✅ Security configuration file exists" >> "$REPORT_FILE"
        
        # Check for specific headers
        if grep -q "csp\|CSP" config/security.ts; then
            echo "- ✅ CSP configuration found" >> "$REPORT_FILE"
        fi
        if grep -q "xFrameOptions\|frameguard" config/security.ts; then
            echo "- ✅ X-Frame-Options configuration found" >> "$REPORT_FILE"
        fi
        if grep -q "xssFilter\|xss" config/security.ts; then
            echo "- ✅ XSS protection configuration found" >> "$REPORT_FILE"
        fi
    else
        log_warning "Security configuration not found"
        echo "- ❌ Security configuration file missing" >> "$REPORT_FILE"
    fi
}

# Check authentication and authorization
check_auth_security() {
    log_info "Checking authentication and authorization..."
    
    echo "" >> "$REPORT_FILE"
    echo "## Authentication & Authorization" >> "$REPORT_FILE"
    
    # Check for JWT configuration
    if grep -r -i "jwt\|token" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -q "secret\|key"; then
        echo "- ✅ JWT authentication found" >> "$REPORT_FILE"
    fi
    
    # Check for rate limiting
    if grep -r -i "rate.*limit\|throttle" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
        echo "- ✅ Rate limiting implemented" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Rate limiting not found" >> "$REPORT_FILE"
    fi
}

# Main security scan function
main() {
    echo "🔍 Starting comprehensive security scan..."
    echo ""
    
    check_sensitive_files
    npm_audit
    snyk_scan
    package_security
    check_hardcoded_secrets
    check_env_variables
    check_dependencies
    check_security_headers
    check_auth_security
    
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "**Scan completed at:** $(date)" >> "$REPORT_FILE"
    
    echo ""
    log_success "Security scan completed!"
    echo "Report generated: $REPORT_FILE"
    echo ""
    echo "📋 Please review the security report for any issues that need to be addressed."
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo ""
        exit 0
        ;;
    *)
        main "$1"
        ;;
esac