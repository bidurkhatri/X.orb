/**
 * Test Data Generator
 * Generates consistent test data for various test scenarios
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

class TestDataGenerator {
  constructor() {
    this.wallets = [];
    this.blockchainData = new Map();
    this.testUsers = [];
  }

  // Generate test wallet addresses
  generateWallets(count = 10) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom();
      wallets.push({
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase,
        index: i,
      });
    }
    this.wallets = wallets;
    return wallets;
  }

  // Generate blockchain transaction data
  generateTransactionData(count = 100) {
    const transactions = [];
    for (let i = 0; i < count; i++) {
      const from = this.getRandomWallet();
      const to = this.getRandomWallet();
      const amount = (Math.random() * 1000).toFixed(6);
      const gasPrice = Math.floor(Math.random() * 100) + 10; // 10-110 gwei
      const gasUsed = 21000 + Math.floor(Math.random() * 100000);
      
      transactions.push({
        hash: `0x${crypto.randomBytes(32).toString('hex')}`,
        from: from.address,
        to: to.address,
        value: amount,
        gasPrice: gasPrice * 1e9, // Convert to wei
        gasUsed: gasUsed,
        blockNumber: 17000000 + Math.floor(Math.random() * 1000000),
        timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Last 30 days
        status: Math.random() > 0.05 ? 1 : 0, // 95% success rate
        type: this.getRandomTransactionType(),
        chainId: this.getRandomChainId(),
      });
    }
    return transactions;
  }

  // Generate PoP (Proof of Productivity) data
  generatePopData(count = 200) {
    const popData = [];
    const tiers = ['Bronze', 'Silver', 'Gold', 'Diamond'];
    
    for (let i = 0; i < count; i++) {
      const user = this.getRandomWallet();
      const baseScore = Math.floor(Math.random() * 20000);
      const tier = tiers[Math.floor(baseScore / 5000)];
      
      popData.push({
        userId: `user_${i}`,
        walletAddress: user.address,
        score: baseScore,
        tier: tier,
        tasksCompleted: Math.floor(baseScore / 100),
        productivityScore: Math.floor(baseScore * 0.8 + Math.random() * baseScore * 0.2),
        lastActivity: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000, // Last 7 days
        weeklyReward: Math.floor(baseScore * 0.01),
        monthlyProjection: Math.floor(baseScore * 0.12),
        verificationCount: Math.floor(baseScore / 500),
        reputation: Math.floor(baseScore / 10),
        rank: Math.floor(Math.random() * 10000) + 1,
      });
    }
    return popData.sort((a, b) => b.score - a.score);
  }

  // Generate file system data for IPFS testing
  generateFileSystemData(count = 50) {
    const fileTypes = ['.txt', '.json', '.png', '.jpg', '.pdf', '.mp4', '.mp3'];
    const files = [];
    
    for (let i = 0; i < count; i++) {
      const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
      const fileSize = Math.floor(Math.random() * 10 * 1024 * 1024); // 0-10MB
      const name = `test_file_${i}_${Date.now()}${fileType}`;
      
      files.push({
        cid: this.generateIPFSCid(),
        name: name,
        size: fileSize,
        type: fileType,
        uploadedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        encrypted: Math.random() > 0.7,
        tags: this.generateTags(),
        owner: this.getRandomWallet().address,
        access: Math.random() > 0.2 ? 'public' : 'private',
      });
    }
    return files;
  }

  // Generate token portfolio data
  generateTokenPortfolioData(count = 20) {
    const tokens = ['SYLOS', 'wSYLOS', 'ETH', 'MATIC', 'BNB', 'USDC', 'USDT'];
    const portfolios = [];
    
    for (let i = 0; i < count; i++) {
      const wallet = this.getRandomWallet();
      const holdings = [];
      
      for (const token of tokens) {
        const balance = (Math.random() * 10000).toFixed(6);
        const price = Math.random() * 1000; // Random price
        const value = (parseFloat(balance) * price).toFixed(2);
        
        holdings.push({
          symbol: token,
          balance: balance,
          price: price,
          value: value,
          change24h: (Math.random() - 0.5) * 20, // -10% to +10%
        });
      }
      
      const totalValue = holdings.reduce((sum, holding) => sum + parseFloat(holding.value), 0);
      
      portfolios.push({
        walletAddress: wallet.address,
        totalValue: totalValue.toFixed(2),
        holdings: holdings,
        lastUpdated: Date.now() - Math.random() * 24 * 60 * 60 * 1000, // Last 24 hours
        stakingDetails: this.generateStakingData(),
      });
    }
    return portfolios;
  }

  // Generate network status data
  generateNetworkStatusData() {
    const networks = [
      { name: 'Ethereum', chainId: 1, status: 'healthy', tps: 12, avgBlockTime: 12.5 },
      { name: 'Polygon', chainId: 137, status: 'healthy', tps: 65, avgBlockTime: 2.1 },
      { name: 'BSC', chainId: 56, status: 'healthy', tps: 80, avgBlockTime: 3.0 },
      { name: 'Arbitrum', chainId: 42161, status: 'healthy', tps: 40, avgBlockTime: 1.0 },
      { name: 'Optimism', chainId: 10, status: 'healthy', tps: 25, avgBlockTime: 2.0 },
    ];
    
    return networks.map(network => ({
      ...network,
      blockNumber: 17000000 + Math.floor(Math.random() * 100000),
      gasPrice: Math.floor(Math.random() * 100) + 10,
      activeUsers: Math.floor(Math.random() * 100000) + 10000,
      lastUpdated: Date.now(),
    }));
  }

  // Generate error scenarios data
  generateErrorScenarios() {
    return [
      {
        scenario: 'network_timeout',
        description: 'Network request timeout',
        expectedError: 'ETIMEDOUT',
        severity: 'medium',
        recoveryStrategy: 'retry_with_backoff',
      },
      {
        scenario: 'insufficient_funds',
        description: 'Wallet has insufficient balance',
        expectedError: 'Insufficient balance',
        severity: 'high',
        recoveryStrategy: 'show_error_message',
      },
      {
        scenario: 'smart_contract_revert',
        description: 'Smart contract execution reverted',
        expectedError: 'Execution reverted',
        severity: 'high',
        recoveryStrategy: 'user_notification',
      },
      {
        scenario: 'ipfs_upload_failed',
        description: 'IPFS node unavailable or slow',
        expectedError: 'Upload failed',
        severity: 'medium',
        recoveryStrategy: 'retry_with_different_node',
      },
      {
        scenario: 'metamask_not_installed',
        description: 'MetaMask extension not detected',
        expectedError: 'No Ethereum provider found',
        severity: 'critical',
        recoveryStrategy: 'prompt_installation',
      },
      {
        scenario: 'wrong_network',
        description: 'Connected to wrong blockchain network',
        expectedError: 'Wrong network',
        severity: 'high',
        recoveryStrategy: 'prompt_network_switch',
      },
    ];
  }

  // Generate accessibility test cases
  generateAccessibilityTestCases() {
    return [
      {
        id: 'a11y_001',
        description: 'All images must have alt text',
        wcagCriteria: '1.1.1',
        severity: 'high',
        testType: 'automated',
      },
      {
        id: 'a11y_002',
        description: 'Form inputs must have labels',
        wcagCriteria: '3.3.2',
        severity: 'critical',
        testType: 'automated',
      },
      {
        id: 'a11y_003',
        description: 'Color contrast must meet 4.5:1 ratio',
        wcagCriteria: '1.4.3',
        severity: 'high',
        testType: 'visual',
      },
      {
        id: 'a11y_004',
        description: 'Keyboard navigation must work',
        wcagCriteria: '2.1.1',
        severity: 'critical',
        testType: 'manual',
      },
      {
        id: 'a11y_005',
        description: 'Focus indicators must be visible',
        wcagCriteria: '2.4.7',
        severity: 'medium',
        testType: 'automated',
      },
    ];
  }

  // Helper methods
  getRandomWallet() {
    if (this.wallets.length === 0) {
      this.generateWallets(10);
    }
    return this.wallets[Math.floor(Math.random() * this.wallets.length)];
  }

  getRandomTransactionType() {
    const types = ['transfer', 'stake', 'unstake', 'claim', 'vote'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getRandomChainId() {
    const chainIds = [1, 137, 56, 42161, 10]; // Ethereum, Polygon, BSC, Arbitrum, Optimism
    return chainIds[Math.floor(Math.random() * chainIds.length)];
  }

  generateIPFSCid() {
    // Generate a mock IPFS CID
    const chars = 'QmNbCqNdLmJNhJ5pYK83JP2MCvc9M5W5ZLnBYvhQocqGL7';
    return chars + crypto.randomBytes(12).toString('base58btc');
  }

  generateTags() {
    const allTags = ['document', 'image', 'video', 'audio', 'archive', 'encrypted', 'public', 'private'];
    const tagCount = Math.floor(Math.random() * 3) + 1; // 1-3 tags
    const tags = [];
    
    for (let i = 0; i < tagCount; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  generateStakingData() {
    const pools = ['default', 'high_yield', 'stable', 'deflationary'];
    const lockPeriods = [30, 60, 90, 180, 365];
    const apy = (Math.random() * 20 + 5).toFixed(2); // 5-25% APY
    
    return {
      pool: pools[Math.floor(Math.random() * pools.length)],
      amount: (Math.random() * 10000).toFixed(2),
      lockPeriod: lockPeriods[Math.floor(Math.random() * lockPeriods.length)],
      apy: apy,
      earned: (Math.random() * 1000).toFixed(2),
      unlockDate: Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000,
    };
  }

  // Generate consistent seed data for tests
  generateSeedData() {
    return {
      wallets: this.generateWallets(20),
      transactions: this.generateTransactionData(500),
      popData: this.generatePopData(1000),
      fileSystem: this.generateFileSystemData(200),
      portfolios: this.generateTokenPortfolioData(50),
      networkStatus: this.generateNetworkStatusData(),
      errorScenarios: this.generateErrorScenarios(),
      accessibilityCases: this.generateAccessibilityTestCases(),
    };
  }

  // Export test data in various formats
  exportToJSON(filename, data) {
    const fs = require('fs');
    const path = require('path');
    
    const exportPath = path.join(__dirname, `../test-data/${filename}.json`);
    
    // Ensure directory exists
    const dir = path.dirname(exportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    console.log(`Test data exported to: ${exportPath}`);
  }

  // Load test data from file
  loadFromJSON(filename) {
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, `../test-data/${filename}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    }
    
    throw new Error(`Test data file not found: ${filePath}`);
  }
}

module.exports = TestDataGenerator;

// CLI interface for generating test data
if (require.main === module) {
  const generator = new TestDataGenerator();
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    console.log('Generating all test data...');
    const seedData = generator.generateSeedData();
    generator.exportToJSON('seed-data', seedData);
  } else if (args.includes('--wallets')) {
    console.log('Generating test wallets...');
    const wallets = generator.generateWallets(parseInt(args[args.indexOf('--wallets') + 1]) || 10);
    generator.exportToJSON('wallets', wallets);
  } else if (args.includes('--transactions')) {
    console.log('Generating transaction data...');
    const transactions = generator.generateTransactionData(parseInt(args[args.indexOf('--transactions') + 1]) || 100);
    generator.exportToJSON('transactions', transactions);
  } else if (args.includes('--pop')) {
    console.log('Generating PoP data...');
    const popData = generator.generatePopData(parseInt(args[args.indexOf('--pop') + 1]) || 200);
    generator.exportToJSON('pop-data', popData);
  } else {
    console.log('Usage: node test-data-generator.js [--all|--wallets|--transactions|--pop] [count]');
    console.log('Examples:');
    console.log('  node test-data-generator.js --all');
    console.log('  node test-data-generator.js --wallets 50');
    console.log('  node test-data-generator.js --transactions 1000');
  }
}
