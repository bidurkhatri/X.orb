# SylOS Quick Start Guide

> **Get SylOS running in under 10 minutes**

This guide will get you up and running with SylOS quickly. For detailed deployment instructions, see the full [Deployment Guide](./DEPLOYMENT_GUIDE.md).

## Prerequisites

- **Operating System:** Linux, macOS, or Windows with WSL2
- **Memory:** 4GB RAM minimum (8GB recommended)
- **Storage:** 10GB free space minimum (50GB recommended)
- **Node.js:** Version 18.0.0 or higher
- **Git:** Latest version

### Installing Prerequisites

#### Node.js (Linux/macOS)
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or using package manager
# Ubuntu/Debian
sudo apt update && sudo apt install nodejs npm

# macOS
brew install node
```

#### Node.js (Windows)
Download and install from [nodejs.org](https://nodejs.org/) or use [Chocolatey](https://chocolatey.org/):
```powershell
choco install nodejs
```

#### Docker (Required for blockchain components)
```bash
# Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# macOS
# Download Docker Desktop from https://www.docker.com/products/docker-desktop

# Windows
# Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

## Quick Setup (5 minutes)

### 1. Clone the Repository
```bash
git clone <your-sylos-repository>
cd sylos-workspace
```

### 2. Run the Quick Setup Script
```bash
cd deployment-package
chmod +x quick-setup.sh
./quick-setup.sh development
```

This script will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Build the web application
- ✅ Start development servers
- ✅ Generate a local URL for access

### 3. Access SylOS

After the setup completes, you'll see output like:
```
🎉 SylOS is ready!
Web App: http://localhost:3000
Mobile Dev: http://localhost:19006
Blockchain: http://localhost:8545
```

Open your browser and navigate to `http://localhost:3000` to see SylOS!

## Development Mode

For active development with hot reload:

```bash
# Terminal 1: Web application
cd deployment-package
./dev-web.sh

# Terminal 2: Mobile app
./dev-mobile.sh

# Terminal 3: Blockchain (optional)
./dev-blockchain.sh
```

## Production Quick Deploy

For a quick production deployment:

```bash
# 1. Configure environment
cp environments/production.env.example environments/production.env
# Edit production.env with your settings

# 2. Run production deployment
./deploy-sylos.sh production

# 3. Set up reverse proxy (nginx example)
sudo cp nginx.conf.example /etc/nginx/sites-available/sylos
sudo ln -s /etc/nginx/sites-available/sylos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Common Quick Commands

```bash
# Check system status
./scripts/system-check.sh

# View logs
tail -f deployment.log

# Reset everything
./scripts/clean-all.sh

# Update dependencies
./scripts/update-deps.sh
```

## Environment Files

Quick environment setup:

### Development
```bash
# Use default development settings
cp environments/development.env.example environments/development.env
# Edit if needed (defaults are usually fine)
```

### Staging
```bash
# Copy and modify for staging
cp environments/staging.env.example environments/staging.env
# Update database URLs, API endpoints, etc.
```

### Production
```bash
# Production requires manual configuration
cp environments/production.env.example environments/production.env
# Edit with production values:
# - Database URLs
# - API keys
# - SSL certificates
# - Network configurations
```

## Mobile App Quick Start

For mobile development:

```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Start development server
cd sylos-mobile
npm start

# Test on device:
# - iOS: Use Expo Go app
# - Android: Use Expo Go app
# - Scan QR code displayed in terminal
```

## Blockchain Quick Start

For blockchain features:

```bash
# Start local blockchain
cd smart-contracts
npx hardhat node

# In another terminal: deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Update frontend with contract addresses
./scripts/update-contract-addresses.sh
```

## Troubleshooting Quick Fixes

### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 ./dev-web.sh
```

### Permission Errors
```bash
# Fix script permissions
chmod +x deployment-package/*.sh

# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Build Failures
```bash
# Clear caches
npm run clean
npm install

# Reinstall everything
./scripts/reinstall.sh
```

### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
./deploy-sylos.sh development
```

## What to Do Next

1. **Explore SylOS:** Visit http://localhost:3000 and try the desktop environment
2. **Mobile App:** Install Expo Go on your phone and scan the QR code
3. **Customization:** Edit files in `minimax-os/src/` to customize the interface
4. **Blockchain:** Set up a testnet for blockchain features
5. **Production:** When ready, follow the [Production Checklist](./PRODUCTION_CHECKLIST.md)

## Getting Help

- 📖 **Full Documentation:** [README.md](./README.md)
- 🔧 **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- 🔒 **Security:** [SECURITY.md](./SECURITY.md)
- 📱 **Mobile Guide:** [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md)

## Support

If you encounter issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the deployment logs: `tail -f deployment.log`
3. Run system diagnostics: `./scripts/system-check.sh`
4. Check the GitHub issues or create a new one

---

**🎉 Congratulations!** SylOS is now running. Start exploring the desktop environment, try the mobile app, and experiment with blockchain features!

For production deployments, make sure to review the [Security Guide](./SECURITY.md) and [Maintenance Guide](./MAINTENANCE.md).