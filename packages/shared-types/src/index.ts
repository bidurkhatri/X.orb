/**
 * @file index.ts
 * @description Shared type definitions for the SylOS monorepo.
 *
 * These types are the single source of truth used across:
 * - sylos-blockchain-os (Vite React web app)
 * - sylos-mobile (Expo React Native)
 * - smart-contracts (Hardhat)
 *
 * When updating types here, both web and mobile packages should be
 * migrated to import from "@sylos/shared-types" instead of maintaining
 * their own local copies.
 */

// ─────────────────────────────────────────────
//  Agent Roles
// ─────────────────────────────────────────────

export type AgentRole =
  | 'TRADER'
  | 'RESEARCHER'
  | 'MONITOR'
  | 'CODER'
  | 'GOVERNANCE_ASSISTANT'
  | 'FILE_INDEXER'
  | 'RISK_AUDITOR';

export type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired';

export type ReputationTier = 'UNTRUSTED' | 'NOVICE' | 'RELIABLE' | 'TRUSTED' | 'ELITE';

// ─────────────────────────────────────────────
//  Agent Interfaces
// ─────────────────────────────────────────────

export interface LLMProvider {
  name: string;
  apiUrl: string;
  model: string;
  apiKey?: string;
}

export interface RegisteredAgent {
  agentId: string;
  name: string;
  role: AgentRole;
  sponsorAddress: string;
  sessionWalletAddress: string;
  stakeBond: string;
  reputation: number;
  reputationTier: ReputationTier;
  status: AgentStatus;
  createdAt: number;
  expiresAt: number;
  lastActiveAt: number;
  llmProvider: LLMProvider;
  totalActionsExecuted: number;
  totalValueGenerated: string;
  slashEvents: number;
  description: string;
}

export interface SpawnAgentConfig {
  name: string;
  role: AgentRole;
  sponsorAddress: string;
  stakeBond?: string;
  expiryDays?: number;
  llmProvider: LLMProvider;
  description?: string;
}

export interface PermissionScope {
  allowedTools: string[];
  allowedContracts: string[];
  allowedIpcTypes: string[];
  maxActionsPerHour: number;
  canPropose: boolean;
  canVote: boolean;
  canTransferFunds: boolean;
  maxFundsPerAction: bigint;
  fileAccess: 'none' | 'read' | 'readwrite';
}

// ─────────────────────────────────────────────
//  Agent Role Metadata
// ─────────────────────────────────────────────

export interface RoleMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
}

// ─────────────────────────────────────────────
//  Transaction Types
// ─────────────────────────────────────────────

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';

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

export type TransactionProposalType = 'transfer' | 'swap' | 'stake' | 'vote' | 'contract_call';

export type TransactionProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface TransactionProposal {
  id: string;
  agentId: string;
  agentName: string;
  type: TransactionProposalType;
  description: string;
  to: string;
  value: string;
  status: TransactionProposalStatus;
  createdAt: number;
}

// ─────────────────────────────────────────────
//  Wallet Types
// ─────────────────────────────────────────────

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase' | 'cdp' | 'trust';

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
  lockPeriod: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────
//  Network Types
// ─────────────────────────────────────────────

export type Network = 'polygon-pos' | 'polygon-zkevm' | 'goerli' | 'sepolia' | 'mainnet';

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

// ─────────────────────────────────────────────
//  Event Types
// ─────────────────────────────────────────────

export type EventType =
  | 'agent:spawned'
  | 'agent:paused'
  | 'agent:resumed'
  | 'agent:revoked'
  | 'agent:reputation_changed'
  | 'agent:thought'
  | 'agent:tool_executed'
  | 'agent:task_completed'
  | 'agent:task_failed'
  | 'community:post_created'
  | 'community:reply_created'
  | 'community:post_voted'
  | 'marketplace:listing_created'
  | 'marketplace:agent_hired'
  | 'marketplace:engagement_completed'
  | 'jobs:job_posted'
  | 'jobs:application_received'
  | 'jobs:human_hired'
  | 'jobs:contract_completed'
  | 'tx:proposal_created'
  | 'tx:approved'
  | 'tx:rejected'
  | 'tx:executed'
  | 'system:notification'
  | 'system:error';

export interface ActivityEvent {
  id: string;
  type: EventType;
  source: string;
  sourceName: string;
  payload: unknown;
  timestamp: number;
}

// ─────────────────────────────────────────────
//  Community Types
// ─────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: AgentRole;
  isAgent: boolean;
  title: string;
  content: string;
  votes: number;
  replyCount: number;
  createdAt: number;
}

// ─────────────────────────────────────────────
//  API Response Types
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
//  Error Types
// ─────────────────────────────────────────────

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

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

// ─────────────────────────────────────────────
//  Reputation Helpers
// ─────────────────────────────────────────────

export function getReputationTier(score: number): ReputationTier {
  if (score >= 8500) return 'ELITE';
  if (score >= 6000) return 'TRUSTED';
  if (score >= 3000) return 'RELIABLE';
  if (score >= 1000) return 'NOVICE';
  return 'UNTRUSTED';
}

export const TIER_COLORS: Record<ReputationTier, string> = {
  ELITE: '#f59e0b',
  TRUSTED: '#22c55e',
  RELIABLE: '#3b82f6',
  NOVICE: '#8b5cf6',
  UNTRUSTED: '#ef4444',
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#22c55e',
  paused: '#f59e0b',
  revoked: '#ef4444',
  expired: '#6b7280',
};
