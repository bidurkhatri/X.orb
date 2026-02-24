// SylOS Mobile Type Definitions

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Wallet: undefined;
  PoP: undefined;
  FileManager: undefined;
  TokenDashboard: undefined;
  Settings: undefined;
  Onboarding: undefined;
  LockScreen: undefined;
};

export type TabParamList = {
  Home: undefined;
  Wallet: undefined;
  PoP: undefined;
  Files: undefined;
  Tokens: undefined;
  Settings: undefined;
};

// Network Types
export type Network = 'polygon-pos' | 'polygon-zkevm' | 'goerli' | 'sepolia' | 'mainnet';

// Wallet Types
export interface Wallet {
  id: string;
  name: string;
  address: string;
  chainId: number;
  balance: number;
  network: Network;
  createdAt: Date;
  lastSync: Date;
  transactions: Transaction[];
  encryptedPrivateKey: string;
  mnemonic: string;
  tokens: TokenBalance[];
  isConnected: boolean;
  provider: WalletProvider;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  usdValue: number;
  decimals: number;
}

export interface TokenHolding {
  token: TokenBalance;
  value: number;
  percentage: number;
}

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase' | 'cdp' | 'trust';

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  fee: string;
  status: TransactionStatus;
  timestamp: Date;
  blockNumber?: number;
  confirmations?: number;
}

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';

// PoP Types
export interface PoPProfile {
  userId: string;
  address: string;
  score: number;
  streak: number;
  tier: Tier;
  totalTasks: number;
  completedTasks: number;
  weeklyReward: string;
  lastActivity: Date;
}

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  points: number;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  verifiedBy?: string[];
  proof?: string; // IPFS hash or URL
}

export type TaskCategory = 'work' | 'learning' | 'creative' | 'social' | 'other';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'verified' | 'rejected';

// File Manager Types
export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: number;
  hash: string; // IPFS hash
  url?: string; // IPFS gateway URL
  createdAt: Date;
  modifiedAt: Date;
  isEncrypted: boolean;
  isShared: boolean;
  sharePermissions?: SharePermission[];
}

export type FileType = 'document' | 'image' | 'video' | 'audio' | 'other';

export interface SharePermission {
  userId: string;
  address: string;
  permission: 'read' | 'write';
  expiresAt?: Date;
}

// Token Dashboard Types
export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo?: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: string;
}

export interface StakingPool {
  id: string;
  token: string;
  apy: number;
  totalStaked: string;
  userStaked: string;
  rewards: string;
  lockPeriod: number; // days
  isActive: boolean;
}

// Settings Types
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  currency: string;
  network: 'mainnet' | 'testnet';
  notifications: NotificationSettings;
  security: SecuritySettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  push: boolean;
  email: boolean;
  transaction: boolean;
  poP: boolean;
  system: boolean;
}

export interface SecuritySettings {
  biometricEnabled: boolean;
  autoLock: number; // minutes
  requirePasswordForTransactions: boolean;
  sessionTimeout: number; // minutes
}

export interface PrivacySettings {
  allowAnalytics: boolean;
  allowCrashReports: boolean;
  showOnChainActivity: boolean;
  trackProductivity: boolean;
}

// Security Types
export interface BiometricData {
  type: 'face' | 'touch' | 'fingerprint';
  isEnrolled: boolean;
  isAvailable: boolean;
  lastUsed: Date;
}

export interface SecureData {
  walletKeys: string;
  backupPhrase: string;
  pin: string;
  isEncrypted: boolean;
  lastBackup: Date;
}

// Network Types
export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'WALLET_ERROR'
  | 'TRANSACTION_ERROR'
  | 'STORAGE_ERROR'
  | 'PERMISSION_ERROR'
  | 'DEVICE_ERROR'
  | 'UNKNOWN_ERROR';

// Device Types
export interface DeviceInfo {
  id: string;
  model: string;
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  isEmulator: boolean;
  isTablet: boolean;
  hasSecureEnclave: boolean;
  hasBiometric: boolean;
}

// Analytics Types
export interface UserAnalytics {
  userId: string;
  address: string;
  events: AnalyticsEvent[];
  productivity: ProductivityMetrics;
  blockchain: BlockchainMetrics;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  metadata?: any;
}

export interface ProductivityMetrics {
  tasksCompleted: number;
  hoursWorked: number;
  score: number;
  tier: Tier;
  streak: number;
}

export interface BlockchainMetrics {
  transactions: number;
  gasUsed: string;
  feesPaid: string;
  tokensHeld: number;
}

// UI Types
export interface AppTheme {
  colors: typeof import('../constants/colors').Colors;
  spacing: typeof import('../theme/spacing').Spacing;
  typography: typeof import('../theme/typography').Typography;
  borderRadius: typeof import('../theme/borderRadius').BorderRadius;
  shadows: typeof import('../theme/shadows').Shadows;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface FormState {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}
