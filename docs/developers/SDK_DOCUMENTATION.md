# SylOS SDK Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Core SDK Architecture](#core-sdk-architecture)
5. [API Reference](#api-reference)
6. [Examples](#examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Introduction

The SylOS SDK is a comprehensive development toolkit that enables developers to build applications, plugins, and extensions for the SylOS Blockchain Operating System ecosystem. The SDK provides unified access to blockchain functionality, storage systems, productivity tracking, and user interface components across all SylOS platforms.

### Key Features

- **Cross-Platform Support**: Build once, deploy everywhere (Web, Mobile, Desktop)
- **Blockchain Integration**: Native support for SYLOS token, staking, governance, and PoP system
- **IPFS Storage**: Decentralized file storage and retrieval
- **Productivity Tracking**: Built-in productivity scoring and task management
- **Plugin System**: Extensible architecture for third-party integrations
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### SDK Components

```
SylOS SDK
├── Core Blockchain API
├── Storage Management
├── Productivity System
├── User Interface Components
├── Authentication & Security
├── Network Communication
└── Plugin Framework
```

## Quick Start

### Installation

```bash
# NPM
npm install @sylos/sdk

# Yarn
yarn add @sylos/sdk

# PNPM
pnpm add @sylos/sdk
```

### Basic Usage

```typescript
import { SylOS, createWallet, connectNetwork } from '@sylos/sdk';

// Initialize SylOS
const sylos = new SylOS({
  network: 'polygon-mainnet',
  environment: 'production'
});

// Create a new wallet
const wallet = await createWallet({
  type: 'hd',
  accountIndex: 0,
  chain: 'polygon'
});

// Connect to blockchain
const connection = await connectNetwork({
  network: 'polygon-mainnet',
  wallet: wallet
});

// Get SYLOS balance
const balance = await sylos.blockchain.getBalance({
  address: wallet.address,
  token: 'SYLOS'
});

console.log(`SYLOS Balance: ${balance.formatted} SYLOS`);
```

## Installation

### Requirements

- Node.js 16+ or 18+
- TypeScript 4.5+
- Modern browser with Web3 support or React Native 0.65+

### Platform-Specific Setup

#### Web Applications

```bash
npm install @sylos/sdk @sylos/react
```

```typescript
// main.tsx
import { SylOSProvider } from '@sylos/react';

const App = () => {
  return (
    <SylOSProvider
      config={{
        network: 'polygon-mainnet',
        enableAnalytics: true,
        plugins: ['wallet', 'storage', 'productivity']
      }}
    >
      <YourApp />
    </SylOSProvider>
  );
};
```

#### React Native Applications

```bash
npm install @sylos/sdk-react-native react-native-mmkv
```

```typescript
// App.tsx
import { SylOSProvider } from '@sylos/sdk-react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const sylos = new SylOS({
  storage: storage,
  network: 'polygon-mainnet'
});

export default function App() {
  return (
    <SylOSProvider sdk={sylos}>
      <YourApp />
    </SylOSProvider>
  );
}
```

#### Node.js Applications

```bash
npm install @sylos/sdk ethers
```

```typescript
// server.ts
import { SylOS, createPrivateKeyWallet } from '@sylos/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const sylos = new SylOS({
  provider: provider,
  signer: wallet,
  network: 'polygon-mainnet'
});

const app = express();
app.use('/api', sylos.getExpressRouter());
```

### Environment Configuration

Create a `.env` file:

```env
# Blockchain Configuration
SYLOS_NETWORK=polygon-mainnet
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# API Keys
IPFS_PROJECT_ID=your_ipfs_project_id
IPFS_PROJECT_SECRET=your_ipfs_project_secret
PINATA_API_KEY=your_pinata_api_key
WEB3_STORAGE_TOKEN=your_web3_storage_token

# SDK Configuration
SYLOS_SDK_VERSION=latest
ENABLE_ANALYTICS=true
LOG_LEVEL=info
```

## Core SDK Architecture

### Module Structure

```typescript
// Core modules
export { SylOS } from './core/SylOS';
export { BlockchainService } from './blockchain/BlockchainService';
export { StorageService } from './storage/StorageService';
export { ProductivityService } from './productivity/ProductivityService';
export { WalletService } from './wallet/WalletService';
export { PluginService } from './plugin/PluginService';

// Utility modules
export { NetworkUtils } from './utils/NetworkUtils';
export { CryptoUtils } from './utils/CryptoUtils';
export { StorageUtils } from './utils/StorageUtils';

// React components
export { SylOSProvider } from './react/SylOSProvider';
export { useWallet } from './react/hooks/useWallet';
export { useBlockchain } from './react/hooks/useBlockchain';
export { useStorage } from './react/hooks/useStorage';
export { useProductivity } from './react/hooks/useProductivity';
```

### Core Classes

#### SylOS (Main Class)

```typescript
class SylOS {
  constructor(config: SylOSConfig);
  
  // Properties
  readonly blockchain: BlockchainService;
  readonly storage: StorageService;
  readonly productivity: ProductivityService;
  readonly wallet: WalletService;
  readonly plugins: PluginService;
  
  // Methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;
  getConfig(): SylOSConfig;
}
```

#### BlockchainService

```typescript
class BlockchainService {
  // Properties
  readonly network: NetworkInfo;
  readonly gasPrice: number;
  readonly blockNumber: number;
  
  // Methods
  getBalance(params: BalanceParams): Promise<BalanceInfo>;
  sendTransaction(tx: Transaction): Promise<TransactionResult>;
  readContract<T>(address: string, abi: ContractAbi, method: string, args?: any[]): Promise<T>;
  writeContract<T>(address: string, abi: ContractAbi, method: string, args?: any[]): Promise<T>;
  getTransactionHistory(address: string, options?: HistoryOptions): Promise<Transaction[]>;
  estimateGas(tx: Transaction): Promise<number>;
}
```

#### StorageService

```typescript
class StorageService {
  // Methods
  uploadFile(file: File, options?: UploadOptions): Promise<UploadResult>;
  downloadFile(hash: string): Promise<Blob>;
  getFileMetadata(hash: string): Promise<FileMetadata>;
  listFiles(query?: ListQuery): Promise<FileList>;
  deleteFile(hash: string): Promise<void>;
  pinFile(hash: string, provider?: PinProvider): Promise<void>;
  unpinFile(hash: string, provider?: PinProvider): Promise<void>;
}
```

#### ProductivityService

```typescript
class ProductivityService {
  // Methods
  createTask(task: TaskData): Promise<Task>;
  completeTask(taskId: string, evidence?: string): Promise<void>;
  getProductivityScore(userId: string, period?: TimePeriod): Promise<ProductivityScore>;
  getTasks(options?: TaskQuery): Promise<Task[]>;
  getLeaderboard(period?: TimePeriod, limit?: number): Promise<LeaderboardEntry[]>;
  submitEvidence(taskId: string, evidence: EvidenceData): Promise<void>;
}
```

### Configuration

```typescript
interface SylOSConfig {
  // Network Configuration
  network: 'polygon-mainnet' | 'polygon-mumbai' | 'polygon-zkevm' | 'custom';
  rpcUrl?: string;
  
  // Storage Configuration
  storage: {
    provider: 'ipfs' | 'pinata' | 'web3storage' | 'custom';
    apiKey?: string;
    gateway?: string;
  };
  
  // Wallet Configuration
  wallet: {
    type: 'web3' | 'private-key' | 'mnemonic' | 'hd';
    privateKey?: string;
    mnemonic?: string;
    hdPath?: string;
  };
  
  // Plugin Configuration
  plugins: string[];
  pluginConfig?: Record<string, any>;
  
  // Optional Features
  enableAnalytics?: boolean;
  enableTelemetry?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

## API Reference

### Authentication Methods

```typescript
// Create wallet from mnemonic
const wallet = await sylos.wallet.createFromMnemonic({
  mnemonic: 'your 12 or 24 word mnemonic',
  hdPath: "m/44'/60'/0'/0/0",
  passphrase: 'optional passphrase'
});

// Import existing wallet
const wallet = await sylos.wallet.importPrivateKey({
  privateKey: '0x...',
  network: 'polygon-mainnet'
});

// Connect Web3 wallet (MetaMask, WalletConnect)
const wallet = await sylos.wallet.connectWeb3({
  providers: ['metamask', 'walletconnect'],
  onConnect: (address) => console.log('Connected:', address)
});
```

### Blockchain Operations

```typescript
// Get token balance
const balance = await sylos.blockchain.getBalance({
  address: '0x...',
  tokens: ['SYLOS', 'WMATIC', 'USDC']
});

// Transfer tokens
const tx = await sylos.blockchain.transfer({
  to: '0x...',
  amount: '100',
  token: 'SYLOS',
  gasPrice: 30000000000, // 30 gwei
  onConfirmation: (receipt) => console.log('Confirmed:', receipt.txHash)
});

// Stake tokens
const stakeTx = await sylos.blockchain.stake({
  amount: '1000',
  lockPeriod: 365, // days
  autoCompound: true
});

// Vote in governance
const voteTx = await sylos.blockchain.vote({
  proposalId: '0x...',
  support: true,
  votingPower: '1000'
});
```

### Storage Operations

```typescript
// Upload file to IPFS
const upload = await sylos.storage.uploadFile(file, {
  metadata: {
    name: file.name,
    description: 'Uploaded via SylOS SDK',
    tags: ['sdk', 'example']
  },
  pin: true
});

console.log('File hash:', upload.hash);
console.log('File URL:', upload.url);

// Download file from IPFS
const blob = await sylos.storage.downloadFile(upload.hash);

// List files
const files = await sylos.storage.listFiles({
  owner: '0x...',
  createdAfter: new Date('2023-01-01'),
  limit: 10
});
```

### Productivity Tracking

```typescript
// Create productivity task
const task = await sylos.productivity.createTask({
  title: 'Develop new feature',
  description: 'Implement user authentication system',
  category: 'development',
  estimatedHours: 8,
  priority: 'high',
  dueDate: new Date('2023-12-01'),
  teamId: 'team-123'
});

// Complete task with evidence
await sylos.productivity.completeTask(task.id, {
  completionNotes: 'Successfully implemented JWT-based authentication',
  timeSpent: 8.5,
  deliverables: ['auth.ts', 'auth.test.ts', 'docs.md'],
  qualityScore: 9.5
});

// Get productivity score
const score = await sylos.productivity.getProductivityScore('user-123', {
  period: 'monthly',
  includeTeam: true
});
```

### Plugin System

```typescript
// Register custom plugin
sylos.plugins.register({
  name: 'my-plugin',
  version: '1.0.0',
  init: async (context) => {
    context.registerCommand('hello', {
      description: 'Say hello',
      handler: (args) => console.log('Hello, SylOS!')
    });
  }
});

// Use plugin functionality
const result = await sylos.plugins.execute('my-plugin', 'hello');

// List available plugins
const plugins = await sylos.plugins.list();
```

## Examples

### Complete Web Application

```typescript
// App.tsx
import React, { useEffect, useState } from 'react';
import { SylOSProvider, useWallet, useBlockchain, useStorage } from '@sylos/react';

const WalletDashboard = () => {
  const { wallet, connect, disconnect, isConnected } = useWallet();
  const { balance, refreshBalance } = useBlockchain();
  const { uploadFile, listFiles } = useStorage();
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (isConnected) {
      refreshBalance();
      loadFiles();
    }
  }, [isConnected]);

  const loadFiles = async () => {
    const fileList = await listFiles({ limit: 10 });
    setFiles(fileList.files);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const result = await uploadFile(file);
      alert(`File uploaded! Hash: ${result.hash}`);
      loadFiles();
    }
  };

  if (!isConnected) {
    return (
      <div>
        <h1>Connect Your Wallet</h1>
        <button onClick={connect}>Connect MetaMask</button>
      </div>
    );
  }

  return (
    <div>
      <h1>SylOS Dashboard</h1>
      <div>Address: {wallet?.address}</div>
      <div>SYLOS Balance: {balance?.formatted}</div>
      
      <div>
        <h2>Files</h2>
        <input type="file" onChange={handleFileUpload} />
        <ul>
          {files.map(file => (
            <li key={file.hash}>
              {file.name} - {file.size} bytes
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <SylOSProvider
      config={{
        network: 'polygon-mainnet',
        storage: { provider: 'pinata' },
        plugins: ['wallet', 'storage', 'productivity']
      }}
    >
      <WalletDashboard />
    </SylOSProvider>
  );
};

export default App;
```

### React Native Mobile App

```typescript
// MobileWalletScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, TouchableOpacity } from 'react-native';
import { useWallet, useBlockchain, useProductivity } from '@sylos/sdk-react-native';

export default function MobileWalletScreen() {
  const { wallet, createWallet, importWallet, isInitialized } = useWallet();
  const { balance, transferTokens } = useBlockchain();
  const { createTask, getProductivityScore } = useProductivity();
  const [pin, setPin] = useState('');

  const handleCreateWallet = async () => {
    const newWallet = await createWallet({
      type: 'hd',
      hdPath: "m/44'/60'/0'/0/0"
    });
    console.log('New wallet created:', newWallet.address);
  };

  const handleTransfer = async () => {
    try {
      await transferTokens({
        to: '0x...',
        amount: '10',
        token: 'SYLOS'
      });
      alert('Transfer successful!');
    } catch (error) {
      alert(`Transfer failed: ${error.message}`);
    }
  };

  const handleCreateTask = async () => {
    const task = await createTask({
      title: 'Complete SDK integration',
      description: 'Integrate SylOS SDK into mobile app',
      category: 'development',
      estimatedHours: 4
    });
    console.log('Task created:', task.id);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        SylOS Mobile Wallet
      </Text>
      
      {wallet && (
        <>
          <Text>Address: {wallet.address}</Text>
          <Text>Balance: {balance?.formatted} SYLOS</Text>
          
          <TouchableOpacity 
            style={{ backgroundColor: 'blue', padding: 15, margin: 10 }}
            onPress={handleTransfer}
          >
            <Text style={{ color: 'white' }}>Send 10 SYLOS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{ backgroundColor: 'green', padding: 15, margin: 10 }}
            onPress={handleCreateTask}
          >
            <Text style={{ color: 'white' }}>Create Productivity Task</Text>
          </TouchableOpacity>
        </>
      )}
      
      {!wallet && (
        <TouchableOpacity 
          style={{ backgroundColor: 'blue', padding: 15, margin: 10 }}
          onPress={handleCreateWallet}
        >
          <Text style={{ color: 'white' }}>Create New Wallet</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

### Node.js Server Integration

```typescript
// server.ts
import express from 'express';
import { SylOS } from '@sylos/sdk';

const app = express();
const sylos = new SylOS({
  network: 'polygon-mainnet',
  rpcUrl: process.env.POLYGON_RPC_URL,
  wallet: {
    type: 'private-key',
    privateKey: process.env.SERVER_PRIVATE_KEY
  }
});

app.use(express.json());

// API endpoint to get wallet balance
app.get('/api/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await sylos.blockchain.getBalance({
      address,
      token: 'SYLOS'
    });
    res.json({ balance: balance.formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to transfer tokens
app.post('/api/transfer', async (req, res) => {
  try {
    const { to, amount, token } = req.body;
    const result = await sylos.blockchain.transfer({
      to,
      amount,
      token
    });
    res.json({ transactionHash: result.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to upload file
app.post('/api/upload', async (req, res) => {
  try {
    const { file } = req.body; // Base64 encoded file
    const buffer = Buffer.from(file, 'base64');
    const blob = new Blob([buffer]);
    
    const result = await sylos.storage.uploadFile(blob, {
      metadata: { name: req.body.name }
    });
    
    res.json({ hash: result.hash, url: result.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook handler for blockchain events
app.post('/webhooks/blockchain', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    switch (event) {
      case 'Transfer':
        console.log('Transfer event:', data);
        // Process transfer event
        break;
      case 'Stake':
        console.log('Stake event:', data);
        // Process stake event
        break;
    }
    
    res.json({ status: 'processed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SylOS API Server running on port ${PORT}`);
});
```

### Advanced Plugin Development

```typescript
// my-productivity-plugin.ts
import { Plugin, PluginContext } from '@sylos/sdk';

export class ProductivityPlugin implements Plugin {
  name = 'productivity-enhanced';
  version = '1.0.0';

  async init(context: PluginContext) {
    // Register custom commands
    context.registerCommand('quick-task', {
      description: 'Create a quick productivity task',
      handler: this.createQuickTask.bind(this)
    });

    context.registerCommand('productivity-stats', {
      description: 'Get detailed productivity statistics',
      handler: this.getProductivityStats.bind(this)
    });

    context.registerCommand('auto-complete', {
      description: 'Auto-complete tasks based on criteria',
      handler: this.autoCompleteTasks.bind(this)
    });

    // Register event listeners
    context.on('task:created', this.onTaskCreated.bind(this));
    context.on('task:completed', this.onTaskCompleted.bind(this));

    // Register UI components
    context.registerComponent('productivity-dashboard', this.renderDashboard);
    context.registerComponent('task-suggestions', this.renderTaskSuggestions);
  }

  async createQuickTask(args: any) {
    const { title, priority = 'medium', estimatedHours = 1 } = args;
    
    const task = await context.services.productivity.createTask({
      title,
      priority,
      estimatedHours,
      category: 'quick',
      autoAssign: true
    });

    return {
      success: true,
      taskId: task.id,
      message: `Quick task "${title}" created successfully`
    };
  }

  async getProductivityStats(args: any) {
    const { userId, period = 'weekly' } = args;
    
    const stats = await context.services.productivity.getDetailedStats({
      userId,
      period,
      includeMetrics: true,
      includeComparisons: true,
      includeTrends: true
    });

    return {
      period,
      overallScore: stats.overallScore,
      tasksCompleted: stats.tasksCompleted,
      hoursLogged: stats.hoursLogged,
      efficiency: stats.efficiency,
      trends: stats.trends
    };
  }

  async autoCompleteTasks(args: any) {
    const { userId, criteria } = args;
    
    // Find tasks that meet auto-completion criteria
    const tasks = await context.services.productivity.findTasks({
      userId,
      status: 'in_progress',
      overdue: true,
      criteria: criteria || 'low_priority_no_deliverables'
    });

    let completedCount = 0;
    for (const task of tasks) {
      try {
        await context.services.productivity.completeTask(task.id, {
          autoCompleted: true,
          completionReason: 'Auto-completed based on criteria'
        });
        completedCount++;
      } catch (error) {
        console.error(`Failed to auto-complete task ${task.id}:`, error);
      }
    }

    return {
      success: true,
      completedCount,
      message: `Auto-completed ${completedCount} tasks`
    };
  }

  onTaskCreated(task: any) {
    // Send notification for new high-priority tasks
    if (task.priority === 'high') {
      context.services.notification.send({
        type: 'task:high_priority',
        title: 'New High Priority Task',
        message: `Task "${task.title}" has been assigned to you`,
        userId: task.assignedTo
      });
    }
  }

  onTaskCompleted(task: any) {
    // Update productivity metrics in real-time
    context.services.analytics.track('task_completed', {
      taskId: task.id,
      category: task.category,
      priority: task.priority,
      timeSpent: task.timeSpent
    });
  }

  renderDashboard(data: any) {
    return {
      type: 'productivity-dashboard',
      props: {
        score: data.score,
        tasks: data.recentTasks,
        trends: data.trends,
        achievements: data.achievements
      }
    };
  }

  renderTaskSuggestions(data: any) {
    const suggestions = this.generateTaskSuggestions(data);
    
    return {
      type: 'task-suggestions',
      props: {
        suggestions,
        onAccept: (suggestionId: string) => {
          this.acceptSuggestion(suggestionId);
        },
        onDismiss: (suggestionId: string) => {
          this.dismissSuggestion(suggestionId);
        }
      }
    };
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
// Always wrap SDK operations in try-catch
try {
  const result = await sylos.blockchain.transfer({
    to: recipient,
    amount: amount,
    token: 'SYLOS'
  });
  console.log('Transfer successful:', result.hash);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.log('Insufficient balance for transfer');
  } else if (error.code === 'USER_REJECTED') {
    console.log('User rejected the transaction');
  } else {
    console.error('Transfer failed:', error);
  }
}
```

### 2. Connection Management

```typescript
// Properly handle wallet connections
const { connect, disconnect, isConnected } = useWallet();

useEffect(() => {
  // Set up connection listeners
  const handleAccountsChanged = (accounts) => {
    console.log('Accounts changed:', accounts);
    if (accounts.length === 0) {
      disconnect();
    }
  };

  const handleChainChanged = (chainId) => {
    console.log('Chain changed:', chainId);
    // Reinitialize SDK with new network if needed
  };

  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }

  return () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };
}, []);
```

### 3. Storage Optimization

```typescript
// Compress large files before upload
const compressFile = async (file: File): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // For images, resize and compress
  if (file.type.startsWith('image/')) {
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = URL.createObjectURL(file);
    });
    
    canvas.width = 1920;
    canvas.height = 1080;
    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
    });
  }
  
  return file;
};

// Upload with progress tracking
const uploadWithProgress = async (file: File) => {
  const compressedFile = await compressFile(file);
  
  return await sylos.storage.uploadFile(compressedFile, {
    onProgress: (progress) => {
      console.log(`Upload progress: ${progress}%`);
      updateUIProgress(progress);
    },
    metadata: {
      originalSize: file.size,
      compressed: true,
      compressionRatio: file.size / compressedFile.size
    }
  });
};
```

### 4. Performance Optimization

```typescript
// Cache frequently accessed data
const useWalletBalance = (address: string) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    
    const fetchBalance = async () => {
      try {
        // Check cache first
        const cached = await cache.get(`balance:${address}`);
        if (cached && Date.now() - cached.timestamp < 30000) { // 30s cache
          if (!isCancelled) {
            setBalance(cached.data);
            setLoading(false);
          }
          return;
        }

        const newBalance = await sylos.blockchain.getBalance({ address });
        
        if (!isCancelled) {
          setBalance(newBalance);
          setLoading(false);
          
          // Update cache
          await cache.set(`balance:${address}`, {
            data: newBalance,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch balance:', error);
          setLoading(false);
        }
      }
    };

    fetchBalance();
    
    return () => {
      isCancelled = true;
    };
  }, [address]);

  return { balance, loading, refetch: () => fetchBalance() };
};
```

### 5. Security Considerations

```typescript
// Never expose private keys or mnemonic phrases
const secureWalletCreation = async (passphrase: string) => {
  // Use Web Crypto API to securely generate entropy
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  // Create mnemonic from secure random bytes
  const mnemonic = bip39.entropyToMnemonic(randomBytes);
  
  // Store securely (not in localStorage)
  const encrypted = await encryptString(mnemonic, passphrase);
  await secureStorage.setItem('wallet-seed', encrypted);
  
  return mnemonic;
};

// Validate user inputs
const validateTransaction = (tx: any) => {
  if (!ethers.isAddress(tx.to)) {
    throw new Error('Invalid recipient address');
  }
  
  if (!ethers.parseEther(tx.amount) || 
      ethers.parseEther(tx.amount) <= 0n) {
    throw new Error('Invalid amount');
  }
  
  if (tx.gasPrice && tx.gasPrice < 1000000000) { // Less than 1 gwei
    throw new Error('Gas price too low');
  }
  
  return true;
};
```

## Troubleshooting

### Common Issues

#### Network Connection Problems

**Issue**: Cannot connect to blockchain network

**Solutions**:
1. Check network configuration
2. Verify RPC URL accessibility
3. Ensure correct network chain ID
4. Check firewall/proxy settings

```typescript
// Test network connectivity
const testConnection = async () => {
  try {
    const blockNumber = await sylos.blockchain.getBlockNumber();
    console.log('Connected to network, latest block:', blockNumber);
    return true;
  } catch (error) {
    console.error('Network connection failed:', error);
    
    // Try alternative RPC endpoint
    const backupRPC = 'https://polygon-rpc.com';
    sylos.updateConfig({ rpcUrl: backupRPC });
    
    try {
      const blockNumber = await sylos.blockchain.getBlockNumber();
      console.log('Connected via backup RPC');
      return true;
    } catch (backupError) {
      console.error('Backup connection also failed:', backupError);
      return false;
    }
  }
};
```

#### Wallet Connection Issues

**Issue**: MetaMask or other wallet not connecting

**Solutions**:
1. Check if wallet extension is installed
2. Ensure wallet is unlocked
3. Verify network matches SDK configuration
4. Handle user rejection gracefully

```typescript
const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask extension.');
  }

  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) {
      throw new Error('No accounts found in wallet');
    }
    
    const address = accounts[0];
    
    // Verify network
    const chainId = await window.ethereum.request({ 
      method: 'eth_chainId' 
    });
    
    if (chainId !== '0x89') { // Polygon Mainnet
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    }
    
    return address;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Please connect to MetaMask');
    }
    throw error;
  }
};
```

#### Storage Upload Problems

**Issue**: File upload to IPFS failing

**Solutions**:
1. Check file size limits
2. Verify IPFS service configuration
3. Handle network timeouts
4. Implement retry logic

```typescript
const uploadWithRetry = async (file: File, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sylos.storage.uploadFile(file, {
        timeout: 30000, // 30 second timeout
        metadata: {
          uploadAttempt: attempt,
          timestamp: new Date().toISOString()
        }
      });
      return result;
    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Upload failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};
```

#### TypeScript Errors

**Issue**: TypeScript compilation errors

**Solutions**:
1. Ensure proper type definitions installation
2. Check TypeScript version compatibility
3. Configure tsconfig.json correctly

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@sylos/sdk": ["node_modules/@sylos/sdk"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### Debug Mode

Enable debug logging:

```typescript
const sylos = new SylOS({
  logLevel: 'debug',
  enableTelemetry: true
});

// Enable specific module debugging
sylos.blockchain.setDebugMode(true);
sylos.storage.setDebugMode(true);
sylos.productivity.setDebugMode(true);
```

### Getting Help

- **Documentation**: [https://docs.sylos.dev](https://docs.sylos.dev)
- **GitHub Issues**: [https://github.com/sylos/sdk/issues](https://github.com/sylos/sdk/issues)
- **Discord Community**: [https://discord.gg/sylos](https://discord.gg/sylos)
- **Developer Support**: support@sylos.dev

### Support Channels

1. **GitHub Discussions** - Technical questions and feature requests
2. **Discord** - Real-time community support
3. **Stack Overflow** - Tag your questions with `sylos-sdk`
4. **Email Support** - For enterprise and priority support

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

**SylOS SDK Version**: 1.0.0  
**Last Updated**: November 10, 2025  
**License**: MIT