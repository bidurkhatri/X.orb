# SylOS Local Preview Guide

## 🎯 What You'll See

This comprehensive guide shows you how to preview the complete SylOS blockchain operating system locally. You'll experience:

- **Desktop Web Interface**: Full blockchain OS with wallet integration
- **Mobile Application**: React Native app for iOS/Android
- **Smart Contract Suite**: Complete blockchain infrastructure
- **Productivity System**: Proof of Productivity (PoP) tracking
- **File Management**: IPFS-based decentralized storage

---

## 🚀 Quick Start - Web Preview

### Option 1: Simple HTML Preview
```bash
# Open the preview page in your browser
open sylos-preview.html
# or
python3 -m http.server 8000
# Then visit: http://localhost:8000/sylos-preview.html
```

### Option 2: Full Development Server
```bash
# Navigate to the blockchain OS
cd /workspace/sylos-blockchain-os

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Visit: http://localhost:5173
```

---

## 📱 Mobile App Preview

### Web-Based Mobile Preview
```bash
# Navigate to the universal app
cd /workspace/sylos-app

# Open in browser for mobile preview
open index.html
# or
python3 -m http.server 8080
# Then visit: http://localhost:8080
```

### Native Mobile Preview (if you have the tools)
```bash
# Navigate to React Native app
cd /workspace/sylos-mobile

# Install Expo CLI globally
npm install -g @expo/cli

# Start the app
expo start

# Scan QR code with Expo Go app on your phone
```

---

## 🔧 Local Development Setup

### 1. Web Application Dependencies
```bash
cd /workspace/sylos-blockchain-os
npm install

# Key dependencies:
# - React 18.2
# - TypeScript 5.9
# - Tailwind CSS
# - ethers.js (blockchain integration)
# - IPFS (decentralized storage)
```

### 2. Smart Contract Development
```bash
cd /workspace/smart-contracts

# Install Hardhat dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet (requires environment variables)
npx hardhat run scripts/deploy.js --network mumbai
```

### 3. Mobile App Development
```bash
cd /workspace/sylos-mobile

# Install React Native dependencies
npm install

# For Expo development
npm install -g @expo/cli
expo start

# For native development
react-native run-ios    # iOS
react-native run-android # Android
```

---

## 🎨 Preview Features

### Web Application Features
- **Desktop Environment**: Complete OS shell with window management
- **6 Blockchain Apps**:
  - 💰 **Wallet**: Multi-wallet support (MetaMask, WalletConnect, etc.)
  - 📊 **PoP Tracker**: Real-time productivity scoring
  - 📁 **File Manager**: IPFS storage and management
  - 💹 **Token Dashboard**: SYLOS/wSYLOS portfolio management
  - ⚙️ **Settings**: Network configuration and security
  - 🖥️ **Terminal**: Command-line interface

### Mobile App Features
- **Biometric Authentication**: Face ID, Touch ID, Fingerprint
- **Offline-First**: Local storage with sync queue
- **Wallet Integration**: Complete blockchain wallet functionality
- **Productivity Tracking**: Mobile-optimized PoP scoring
- **Cross-Platform**: Works on iOS and Android

### Smart Contract Features
- **SYLOS Token**: ERC-20 with anti-bot protection
- **wSYLOS**: Staking wrapper with time-locked rewards
- **PoP Tracker**: Productivity verification system
- **MetaTransactionPaymaster**: Gasless transaction infrastructure
- **SylOSGovernance**: DAO governance and voting

---

## 🔍 What to Test

### 1. Wallet Integration
- Connect MetaMask wallet
- Switch between different wallets
- View wallet balances and transactions

### 2. Productivity System
- Create and complete tasks
- View productivity scoring
- Track daily/weekly/monthly progress

### 3. File Management
- Upload files to IPFS
- Retrieve files using content hashes
- Manage file permissions and sharing

### 4. Staking Interface
- View staking opportunities
- Calculate potential rewards
- Stake and unstake SYLOS tokens

### 5. Mobile Experience
- PIN authentication
- Offline functionality
- Biometric security
- Cross-device sync

---

## 🛠️ Development Commands

### Web Application
```bash
# Development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

### Smart Contracts
```bash
# Compile all contracts
npx hardhat compile

# Run comprehensive tests
npx hardhat test

# Deploy to local network
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Deploy to testnet
npx hardhat run scripts/deploy.js --network mumbai
```

### Mobile App
```bash
# Start Expo development server
expo start

# Build for production
expo build:ios
expo build:android

# Run on specific device
expo run:ios
expo run:android
```

---

## 🌐 Network Configuration

### Development Networks
- **Local Hardhat**: http://localhost:8545
- **Polygon Mumbai**: Testnet for testing
- **Polygon Mainnet**: Production environment

### API Endpoints (Mock)
- **IPFS Gateway**: https://gateway.pinata.cloud/ipfs/
- **Polygon RPC**: https://polygon-rpc.com
- **Price Feeds**: Mock API endpoints for development

---

## 📊 Preview Statistics

| Component | Status | Lines of Code | Files |
|-----------|--------|---------------|-------|
| **Web App** | ✅ Ready | 3,000+ | 30+ |
| **Mobile App** | ✅ Ready | 8,000+ | 100+ |
| **Smart Contracts** | ✅ Ready | 2,000+ | 50+ |
| **Testing Suite** | ✅ Ready | 1,000+ | 20+ |
| **Documentation** | ✅ Ready | 5,000+ | 20+ |

---

## 🎯 Next Steps After Preview

1. **Security Audit**: Professional third-party review
2. **User Testing**: Beta program with real users
3. **Legal Framework**: Terms of service and compliance
4. **Production Launch**: Deploy to mainnet and app stores
5. **Community Building**: Developer and user community

---

## 🆘 Troubleshooting

### Common Issues

**Node.js Version**: Requires Node.js 18+ for optimal performance
```bash
node --version
# Should be 18.0.0 or higher
```

**Port Conflicts**: If ports are in use
```bash
# Use different ports
npm run dev -- --port 3001
```

**Wallet Connection Issues**: 
- Ensure MetaMask is installed
- Switch to Polygon Mumbai testnet
- Refresh the page after connecting

**Mobile Preview Issues**:
- Use Chrome DevTools device emulation
- Or scan QR code with Expo Go app

---

**Ready to explore the future of blockchain operating systems?** 🚀

Start with `sylos-preview.html` for a visual overview, then dive into the full applications using the development server commands above.
