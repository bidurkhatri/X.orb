#!/bin/bash

# Quick setup script for development environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Quick Setup for SylOS Development${NC}"

# Check if we're in the right directory
if [[ ! -f "deploy-sylos.sh" ]]; then
    echo -e "${RED}❌ Please run this script from the deployment-package directory${NC}"
    exit 1
fi

# Check Node.js version
echo "📋 Checking prerequisites..."
node_version=$(node --version | sed 's/v//')
required_version="18.0.0"

if ! node -e "process.exit(process.versions.node.split('.')[0] >= 18 ? 0 : 1)" 2>/dev/null; then
    echo -e "${RED}❌ Node.js version $node_version found. Required: $required_version or higher${NC}"
    exit 1
fi

echo "✅ Node.js version: $node_version"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data logs uploads

# Copy environment file
echo "⚙️  Setting up environment..."
if [[ ! -f "environments/development.env" ]]; then
    if [[ -f "environments/development.env.example" ]]; then
        cp environments/development.env.example environments/development.env
        echo "✅ Created development.env from example"
    else
        echo -e "${YELLOW}⚠️  development.env.example not found, creating basic environment file${NC}"
        cat > environments/development.env << EOF
NODE_ENV=development
PORT=3000
HOST=localhost
DATABASE_URL=sqlite:./data/sylos-dev.db
JWT_SECRET=dev-secret-key-change-in-production
API_SECRET_KEY=dev-api-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-chars
BLOCKCHAIN_NETWORK=localhost
BLOCKCHAIN_RPC_URL=http://localhost:8545
FEATURE_BLOCKCHAIN=true
FEATURE_MOBILE=true
LOG_LEVEL=debug
EOF
    fi
else
    echo "✅ development.env already exists"
fi

# Install dependencies if package.json exists
if [[ -f "../minimax-os/package.json" ]]; then
    echo "📦 Installing web app dependencies..."
    cd ../minimax-os
    npm install
    cd ../deployment-package
    echo "✅ Web app dependencies installed"
else
    echo -e "${YELLOW}⚠️  Web app directory not found, skipping dependency installation${NC}"
fi

if [[ -f "../sylos-mobile/package.json" ]]; then
    echo "📦 Installing mobile app dependencies..."
    cd ../sylos-mobile
    npm install
    cd ../deployment-package
    echo "✅ Mobile app dependencies installed"
else
    echo -e "${YELLOW}⚠️  Mobile app directory not found, skipping dependency installation${NC}"
fi

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x *.sh
chmod +x scripts/*.sh 2>/dev/null || true

# Setup complete
echo
echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
echo
echo "Next steps:"
echo "1. Review and edit environments/development.env if needed"
echo "2. Start development servers:"
echo "   ./dev-start.sh"
echo
echo "Or run the full deployment:"
echo "   ./deploy-sylos.sh development"
echo
echo "For more information, see QUICKSTART.md"