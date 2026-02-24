#!/bin/bash

# Start SylOS development environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting SylOS Development Environment${NC}"
echo

# Check if environment is set up
if [[ ! -f "environments/development.env" ]]; then
    echo -e "${YELLOW}⚠️  Environment not set up. Running quick setup...${NC}"
    ./quick-setup.sh
fi

# Load environment
source environments/development.env

# Create data directory if it doesn't exist
mkdir -p data

# Start Redis (if available)
if command -v redis-server &> /dev/null; then
    echo -e "${BLUE}🔴 Starting Redis...${NC}"
    if ! redis-cli ping &> /dev/null; then
        redis-server --daemonize yes
        sleep 2
    fi
    echo -e "${GREEN}✅ Redis running${NC}"
else
    echo -e "${YELLOW}⚠️  Redis not installed (optional for development)${NC}"
fi

# Start blockchain local network (if contracts directory exists)
if [[ -d "../smart-contracts" && -f "../smart-contracts/hardhat.config.js" ]]; then
    echo -e "${BLUE}⛓️  Starting local blockchain...${NC}"
    cd ../smart-contracts
    
    # Check if network is already running
    if ! curl -s http://localhost:8545 > /dev/null 2>&1; then
        npx hardhat node &
        BLOCKCHAIN_PID=$!
        sleep 5
        echo -e "${GREEN}✅ Local blockchain started${NC}"
    else
        echo -e "${GREEN}✅ Local blockchain already running${NC}"
    fi
    
    cd ../deployment-package
else
    echo -e "${YELLOW}⚠️  Smart contracts directory not found${NC}"
fi

# Start web application (if minimax-os exists)
if [[ -d "../minimax-os" && -f "../minimax-os/package.json" ]]; then
    echo -e "${BLUE}🌐 Starting web application...${NC}"
    cd ../minimax-os
    
    # Start in background
    if command -v pm2 &> /dev/null; then
        pm2 start npm --name "sylos-web" -- run dev
    else
        npm run dev &
        WEB_PID=$!
    fi
    
    echo -e "${GREEN}✅ Web application started (PID: $WEB_PID)${NC}"
    cd ../deployment-package
else
    echo -e "${YELLOW}⚠️  Web app directory not found${NC}"
fi

# Start mobile development server (if mobile app exists)
if [[ -d "../sylos-mobile" && -f "../sylos-mobile/package.json" ]]; then
    echo -e "${BLUE}📱 Starting mobile development server...${NC}"
    cd ../sylos-mobile
    
    if command -v pm2 &> /dev/null; then
        pm2 start npm --name "sylos-mobile" -- start
    else
        npm start &
        MOBILE_PID=$!
    fi
    
    echo -e "${GREEN}✅ Mobile development server started (PID: $MOBILE_PID)${NC}"
    cd ../deployment-package
else
    echo -e "${YELLOW}⚠️  Mobile app directory not found${NC}"
fi

echo
echo -e "${GREEN}🎉 Development environment started!${NC}"
echo
echo -e "${BLUE}Services:${NC}"
echo "📱 Web App:        http://localhost:3000"
echo "📱 Mobile:         http://localhost:19006"
echo "⛓️  Blockchain:     http://localhost:8545"
echo "🔴 Redis:          redis://localhost:6379"
echo
echo -e "${BLUE}Commands:${NC}"
echo "• View logs:       pm2 logs"
echo "• Stop services:   pm2 stop all"
echo "• Restart:         ./dev-start.sh"
echo "• Full deploy:     ./deploy-sylos.sh development"
echo
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    
    if command -v pm2 &> /dev/null; then
        pm2 stop all
    fi
    
    if [[ -n "$BLOCKCHAIN_PID" ]]; then
        kill $BLOCKCHAIN_PID 2>/dev/null || true
    fi
    
    if command -v redis-server &> /dev/null; then
        redis-cli shutdown 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
while true; do
    sleep 1
done