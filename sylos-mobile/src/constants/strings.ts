// SylOS Mobile String Constants

export const App = {
  NAME: 'SylOS Mobile',
  VERSION: '1.0.0',
  BUNDLE_ID: 'com.sylos.mobile',
} as const;

export const Navigation = {
  HOME: 'Home',
  WALLET: 'Wallet',
  POP: 'PoP Tracker',
  FILES: 'File Manager',
  TOKENS: 'Token Dashboard',
  SETTINGS: 'Settings',
} as const;

export const Wallet = {
  TITLE: 'Blockchain Wallet',
  BALANCE: 'Balance',
  TOTAL_BALANCE: 'Total Balance',
  TRANSACTIONS: 'Transactions',
  RECEIVE: 'Receive',
  SEND: 'Send',
  SWAP: 'Swap',
  CONNECT_WALLET: 'Connect Wallet',
  DISCONNECT_WALLET: 'Disconnect Wallet',
  SCAN_QR: 'Scan QR Code',
  COPY_ADDRESS: 'Copy Address',
  ADDRESS: 'Wallet Address',
  AMOUNT: 'Amount',
  FEE: 'Transaction Fee',
  CONFIRM: 'Confirm Transaction',
  SUCCESS: 'Transaction Successful',
  ERROR: 'Transaction Failed',
  // Wallet creation/import
  CREATE_NEW_WALLET: 'Create New Wallet',
  IMPORT_EXISTING_WALLET: 'Import Existing Wallet',
  WALLET_NAME: 'Wallet Name',
  WALLET_PASSWORD: 'Wallet Password',
  MNEMONIC_PHRASE: 'Mnemonic Phrase',
  ENTER_WALLET_NAME: 'Enter wallet name',
  ENTER_WALLET_PASSWORD: 'Enter wallet password',
  ENTER_MNEMONIC: 'Enter your mnemonic phrase',
  CREATE_WALLET: 'Create Wallet',
  IMPORT_WALLET: 'Import Wallet',
  WALLET_CREATED: 'Wallet created successfully',
  WALLET_IMPORTED: 'Wallet imported successfully',
  NO_WALLET_MESSAGE: 'No wallet found. Create or import a wallet to get started.',
  ENTER_WALLET_DETAILS: 'Please enter wallet name and password',
  ENTER_IMPORT_DETAILS: 'Please enter all import details',
  CREATE_WALLET_FAILED: 'Failed to create wallet',
  IMPORT_WALLET_FAILED: 'Failed to import wallet',
  // Tabs
  BALANCES: 'Balances',
  CREATE: 'Create',
  IMPORT: 'Import',
} as const;

export const PoP = {
  TITLE: 'Proof of Productivity',
  SCORE: 'Productivity Score',
  STREAK: 'Current Streak',
  TASKS: 'Completed Tasks',
  WEEKLY_REWARD: 'Weekly Reward',
  TIER: 'Current Tier',
  ADD_TASK: 'Add Task',
  VERIFY_TASK: 'Verify Task',
  CLAIM_REWARD: 'Claim Reward',
  DIAMOND_TIER: 'Diamond',
  PLATINUM_TIER: 'Platinum',
  GOLD_TIER: 'Gold',
  SILVER_TIER: 'Silver',
  BRONZE_TIER: 'Bronze',
} as const;

export const FileManager = {
  TITLE: 'File Manager',
  STORAGE: 'Storage Used',
  UPLOAD: 'Upload File',
  DOWNLOAD: 'Download File',
  IPFS_HASH: 'IPFS Hash',
  FILE_SIZE: 'File Size',
  LAST_MODIFIED: 'Last Modified',
  SHARE: 'Share File',
  DELETE: 'Delete File',
  RENAME: 'Rename File',
  NO_FILES: 'No files uploaded yet',
  SYNCING: 'Syncing with IPFS...',
} as const;

export const TokenDashboard = {
  TITLE: 'Token Dashboard',
  PORTFOLIO_VALUE: 'Portfolio Value',
  SYLOS_BALANCE: 'SYLOS Balance',
  WSYLOS_BALANCE: 'wSYLOS Balance',
  PRICE: 'Price',
  CHANGE: '24h Change',
  VOLUME: '24h Volume',
  MARKET_CAP: 'Market Cap',
  STAKING: 'Staking',
  APY: 'APY',
  UNSTAKE: 'Unstake',
  STAKE: 'Stake',
  CLAIM_REWARDS: 'Claim Rewards',
  BUY: 'Buy',
  SELL: 'Sell',
  SWAP: 'Swap',
} as const;

export const Settings = {
  TITLE: 'Settings',
  ACCOUNT: 'Account',
  SECURITY: 'Security',
  PRIVACY: 'Privacy',
  NETWORK: 'Network',
  NOTIFICATIONS: 'Notifications',
  LANGUAGE: 'Language',
  THEME: 'Theme',
  BACKUP: 'Backup & Restore',
  ABOUT: 'About SylOS',
  LOGOUT: 'Logout',
  DELETE_ACCOUNT: 'Delete Account',
  VERSION: 'Version',
  TERMS: 'Terms of Service',
  PRIVACY_POLICY: 'Privacy Policy',
  SUPPORT: 'Support',
} as const;

export const Security = {
  BIOMETRIC_AUTH: 'Biometric Authentication',
  FACE_ID: 'Face ID',
  TOUCH_ID: 'Touch ID',
  FINGERPRINT: 'Fingerprint',
  PIN: 'PIN Code',
  BACKUP_PHRASE: 'Backup Phrase',
  WALLET_KEYS: 'Wallet Keys',
  ENCRYPTION: 'Encryption',
  SECURE_STORAGE: 'Secure Storage',
  AUTHENTICATE: 'Authenticate',
  ENTER_PIN: 'Enter PIN',
  ENTER_PHRASE: 'Enter Backup Phrase',
  SET_PIN: 'Set PIN',
  CHANGE_PIN: 'Change PIN',
  ENABLE_BIOMETRIC: 'Enable Biometric',
  DISABLE_BIOMETRIC: 'Disable Biometric',
  BACKUP_YOUR_DATA: 'Backup Your Data',
  RESTORE_FROM_BACKUP: 'Restore from Backup',
} as const;

export const Validation = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_ADDRESS: 'Invalid wallet address',
  MIN_LENGTH: 'Minimum length is {min} characters',
  MAX_LENGTH: 'Maximum length is {max} characters',
  INVALID_AMOUNT: 'Invalid amount',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_FEE: 'Invalid fee amount',
} as const;

export const Errors = {
  NETWORK_ERROR: 'Network connection error',
  SYNC_ERROR: 'Synchronization failed',
  AUTH_ERROR: 'Authentication failed',
  WALLET_ERROR: 'Wallet operation failed',
  TRANSACTION_ERROR: 'Transaction failed',
  FILE_UPLOAD_ERROR: 'File upload failed',
  INVALID_INPUT: 'Invalid input',
  PERMISSION_DENIED: 'Permission denied',
  BIOMETRIC_NOT_AVAILABLE: 'Biometric authentication not available',
  DEVICE_NOT_SECURE: 'Device is not secure',
} as const;

export const Success = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  TRANSACTION_SENT: 'Transaction sent successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
  BACKUP_CREATED: 'Backup created successfully',
  RESTORE_COMPLETED: 'Restore completed successfully',
} as const;

export const Network = {
  MAINNET: 'Mainnet',
  TESTNET: 'Testnet',
  POLYGON: 'Polygon',
  ETHEREUM: 'Ethereum',
  ARBITRUM: 'Arbitrum',
  OPTIMISM: 'Optimism',
} as const;

export const Biometric = {
  FACE_ID: 'Face ID',
  TOUCH_ID: 'Touch ID',
  FINGERPRINT: 'Fingerprint',
  NOT_AVAILABLE: 'Biometric authentication not available',
  NOT_ENROLLED: 'Biometric authentication not set up',
  CANCELLED: 'Authentication cancelled',
  FAILED: 'Authentication failed',
  NOT_HARDWARE: 'Biometric hardware not available',
  LOCKED: 'Biometric authentication is locked',
  UPDATE_SECURITY: 'Please update your device security settings',
} as const;

export const Agents = {
  TITLE: 'Agent Civilization',
  SPAWN_AGENT: 'Spawn Agent',
  AGENT_NAME: 'Agent Name',
  AGENT_ROLE: 'Role',
  REPUTATION: 'Reputation',
  STATUS: 'Status',
  STAKE_BOND: 'Stake Bond',
  ACTIONS: 'Actions',
  PAUSE: 'Pause',
  RESUME: 'Resume',
  REVOKE: 'Revoke',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
  NO_AGENTS: 'No agents spawned yet',
  SPAWN_FIRST: 'Spawn your first licensed worker',
  KILL_SWITCH: 'Kill Switch',
  PAUSE_ALL: 'Pause All',
  REVOKE_ALL: 'Revoke All',
} as const;

export const Auth = {
  LOGIN: 'Log In',
  LOGOUT: 'Log Out',
  AUTHENTICATE: 'Authenticate',
} as const;

export const Status = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Syncing...',
} as const;

export const Common = {
  OK: 'OK',
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
  LOADING: 'Loading...',
  ERROR: 'Error',
  SUCCESS: 'Success',
  COMING_SOON: 'Coming Soon',
} as const;

// Master export for all strings
export const strings = {
  app: App,
  navigation: Navigation,
  wallet: Wallet,
  pop: PoP,
  fileManager: FileManager,
  tokenDashboard: TokenDashboard,
  settings: Settings,
  auth: Auth,
  status: Status,
  common: Common,
  errors: Errors,
  security: Security,
  biometric: Biometric,
  agents: Agents,
  desktop: {
    welcomeBack: 'Welcome back',
    quickActions: 'Quick Actions',
    scanQR: 'Scan QR',
    photos: 'Photos',
    notifications: 'Notifications',
  },
  tabs: {
    dashboard: 'Dashboard',
    agents: 'Agents',
    approvals: 'Approvals',
    community: 'Community',
    wallet: 'Wallet',
  },
  approvals: {
    title: 'Approvals',
    pending: 'Pending',
    history: 'History',
    approve: 'Approve',
    reject: 'Reject',
    noPending: 'No pending approvals',
    noHistory: 'No approval history',
  },
  community: {
    title: 'Community',
    allPosts: 'All',
    agentPosts: 'Agents',
    humanPosts: 'Humans',
    noPosts: 'No posts yet',
    replies: 'replies',
    readMore: 'Read more',
  },
  apps: {
    wallet: 'Wallet',
    walletDesc: 'Manage your blockchain wallet',
    popTracker: 'PoP Tracker',
    popTrackerDesc: 'Track your Proof of Productivity',
    fileManager: 'File Manager',
    fileManagerDesc: 'Manage your IPFS files',
    tokenDashboard: 'Token Dashboard',
    tokenDashboardDesc: 'View your token portfolio',
    agents: 'Agents',
    agentsDesc: 'Manage your AI agent civilization',
    settings: 'Settings',
    settingsDesc: 'Configure your preferences',
  },
} as const;
