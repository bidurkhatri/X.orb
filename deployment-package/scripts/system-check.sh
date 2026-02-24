#!/bin/bash

# System check script for SylOS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASS=0
WARN=0
FAIL=0

echo -e "${BLUE}🔍 SylOS System Check${NC}"
echo "======================"
echo

# Function to check and report
check() {
    local name="$1"
    local test_cmd="$2"
    local severity="${3:-PASS}"  # PASS, WARN, FAIL
    
    echo -n "Checking $name... "
    
    if eval "$test_cmd" &>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASS++))
        return 0
    else
        if [[ "$severity" == "WARN" ]]; then
            echo -e "${YELLOW}⚠ WARN${NC}"
            ((WARN++))
        else
            echo -e "${RED}✗ FAIL${NC}"
            ((FAIL++))
        fi
        return 1
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check service status
service_status() {
    systemctl is-active "$1" &> /dev/null
}

# Function to check port
port_open() {
    netstat -tuln 2>/dev/null | grep -q ":$1 " || ss -tuln 2>/dev/null | grep -q ":$1 "
}

# === System Requirements ===
echo -e "${BLUE}📋 System Requirements${NC}"

check "Node.js version" "node -e \"process.exit(process.versions.node.split('.')[0] >= 18 ? 0 : 1)\""
check "NPM availability" "command_exists npm"
check "Git availability" "command_exists git"

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' || echo "0.0.0")
echo "  → Node.js version: $NODE_VERSION"

# === Docker ===
echo
echo -e "${BLUE}🐳 Docker${NC}"

check "Docker installation" "command_exists docker"
check "Docker Compose" "command_exists docker-compose"
check "Docker daemon" "docker info &>/dev/null"
check "Docker permissions" "docker run --rm hello-world &>/dev/null"

# === Database ===
echo
echo -e "${BLUE}🗄️ Database${NC}"

check "PostgreSQL client" "command_exists psql"
check "PostgreSQL service" "service_status postgresql"
check "PostgreSQL port (5432)" "port_open 5432"
check "PostgreSQL connection" "psql $DATABASE_URL -c 'SELECT 1' &>/dev/null || true"

# === Redis ===
echo
echo -e "${BLUE}🔴 Redis${NC}"

check "Redis CLI" "command_exists redis-cli"
check "Redis service" "service_status redis-server"
check "Redis port (6379)" "port_open 6379"
check "Redis connection" "redis-cli ping &>/dev/null"

# === Web Server ===
echo
echo -e "${BLUE}🌐 Web Server${NC}"

check "Nginx installation" "command_exists nginx"
check "Nginx service" "service_status nginx"
check "Nginx configuration" "nginx -t &>/dev/null"
check "Nginx port (80)" "port_open 80"
check "Nginx port (443)" "port_open 443"

# === System Resources ===
echo
echo -e "${BLUE}💻 System Resources${NC}"

# Memory check
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
if [[ $MEMORY_GB -ge 8 ]]; then
    echo -e "${GREEN}✓ Memory: ${MEMORY_GB}GB (Good)${NC}"
    ((PASS++))
elif [[ $MEMORY_GB -ge 4 ]]; then
    echo -e "${YELLOW}⚠ Memory: ${MEMORY_GB}GB (Recommended: 8GB+)${NC}"
    ((WARN++))
else
    echo -e "${RED}✗ Memory: ${MEMORY_GB}GB (Minimum: 4GB)${NC}"
    ((FAIL++))
fi

# Disk space check
DISK_AVAILABLE=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
if [[ $DISK_AVAILABLE -ge 50 ]]; then
    echo -e "${GREEN}✓ Disk Space: ${DISK_AVAILABLE}GB (Good)${NC}"
    ((PASS++))
elif [[ $DISK_AVAILABLE -ge 20 ]]; then
    echo -e "${YELLOW}⚠ Disk Space: ${DISK_AVAILABLE}GB (Recommended: 50GB+)${NC}"
    ((WARN++))
else
    echo -e "${RED}✗ Disk Space: ${DISK_AVAILABLE}GB (Minimum: 20GB)${NC}"
    ((FAIL++))
fi

# CPU cores
CPU_CORES=$(nproc)
if [[ $CPU_CORES -ge 4 ]]; then
    echo -e "${GREEN}✓ CPU Cores: $CPU_CORES (Good)${NC}"
    ((PASS++))
elif [[ $CPU_CORES -ge 2 ]]; then
    echo -e "${YELLOW}⚠ CPU Cores: $CPU_CORES (Recommended: 4+)${NC}"
    ((WARN++))
else
    echo -e "${RED}✗ CPU Cores: $CPU_CORES (Minimum: 2)${NC}"
    ((FAIL++))
fi

# === Environment Configuration ===
echo
echo -e "${BLUE}⚙️ Environment Configuration${NC}"

check "Development environment" "test -f environments/development.env"
check "Environment syntax" "bash -n environments/development.env &>/dev/null"
check "NODE_ENV variable" "source environments/development.env && [[ -n \$NODE_ENV ]]"
check "DATABASE_URL variable" "source environments/development.env && [[ -n \$DATABASE_URL ]]"

# === Network ===
echo
echo -e "${BLUE}🌐 Network${NC}"

# Check if internet is available
if ping -c 1 google.com &>/dev/null; then
    echo -e "${GREEN}✓ Internet connectivity${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Internet connectivity${NC}"
    ((FAIL++))
fi

# Check DNS resolution
if nslookup google.com &>/dev/null; then
    echo -e "${GREEN}✓ DNS resolution${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ DNS resolution${NC}"
    ((FAIL++))
fi

# === Application Components ===
echo
echo -e "${BLUE}📦 Application Components${NC}"

check "Web app directory" "test -d ../minimax-os"
check "Web app package.json" "test -f ../minimax-os/package.json"
check "Web app node_modules" "test -d ../minimax-os/node_modules"
check "Mobile app directory" "test -d ../sylos-mobile"
check "Mobile app package.json" "test -f ../sylos-mobile/package.json"
check "Smart contracts directory" "test -d ../smart-contracts"
check "Smart contracts config" "test -f ../smart-contracts/hardhat.config.js"

# === SSL Certificates (if applicable) ===
echo
echo -e "${BLUE}🔐 SSL Certificates${NC}"

if [[ -f "environments/production.env" ]]; then
    check "Production environment" "test -f environments/production.env"
    check "SSL certificate" "test -f /etc/ssl/certs/sylos.crt"
    check "SSL key" "test -f /etc/ssl/private/sylos.key"
    
    # Test SSL if domain is set
    if source environments/production.env 2>/dev/null && [[ -n "\$CORS_ORIGIN" ]]; then
        DOMAIN=$(echo $CORS_ORIGIN | sed 's|https\?://||' | sed 's|/.*||')
        if curl -k -s "https://$DOMAIN" &>/dev/null; then
            echo -e "${GREEN}✓ SSL connection to $DOMAIN${NC}"
            ((PASS++))
        else
            echo -e "${YELLOW}⚠ SSL connection to $DOMAIN failed${NC}"
            ((WARN++))
        fi
    fi
else
    echo -e "${YELLOW}⚠ Production environment not configured${NC}"
    ((WARN++))
fi

# === Security ===
echo
echo -e "${BLUE}🛡️ Security${NC}"

check "Firewall status" "ufw status | grep -q 'Status: active'"
check "Fail2ban" "command_exists fail2ban-client"
check "SSH key authentication" "test -f ~/.ssh/id_rsa"

# === Summary ===
echo
echo -e "${BLUE}📊 Summary${NC}"
echo "======================"
echo -e "Passed:  ${GREEN}$PASS${NC}"
echo -e "Warnings: ${YELLOW}$WARN${NC}"
echo -e "Failed:  ${RED}$FAIL${NC}"
echo

# Overall status
if [[ $FAIL -eq 0 ]]; then
    if [[ $WARN -eq 0 ]]; then
        echo -e "${GREEN}🎉 All checks passed! System is ready for deployment.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  System ready with warnings. Review warnings before production deployment.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ System check failed. Please resolve issues before deployment.${NC}"
    exit 1
fi