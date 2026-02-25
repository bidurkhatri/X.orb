/**
 * Agent types — matches the desktop's AgentRegistry + AgentRoles definitions.
 * This is the single source of truth for mobile agent data structures.
 */

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

export interface LLMProvider {
  name: string;
  apiUrl: string;
  model: string;
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

export interface TransactionProposal {
  id: string;
  agentId: string;
  agentName: string;
  type: 'transfer' | 'swap' | 'stake' | 'vote' | 'contract_call';
  description: string;
  to: string;
  value: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: number;
}

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

export interface ActivityEvent {
  id: string;
  type: EventType;
  source: string;
  sourceName: string;
  payload: any;
  timestamp: number;
}

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

/* ─── Role Metadata ─── */

export const ROLE_META: Record<AgentRole, { label: string; icon: string; color: string; description: string }> = {
  TRADER: { label: 'Trading Agent', icon: 'trending-up', color: '#f59e0b', description: 'Executes trades within spending caps' },
  RESEARCHER: { label: 'Research Agent', icon: 'flask', color: '#3b82f6', description: 'Queries chain data, produces analysis' },
  MONITOR: { label: 'Monitor', icon: 'eye', color: '#22c55e', description: 'Watches chain state, triggers alerts' },
  CODER: { label: 'Coder', icon: 'code-slash', color: '#8b5cf6', description: 'Reads/writes files, assists development' },
  GOVERNANCE_ASSISTANT: { label: 'Governance', icon: 'library', color: '#ec4899', description: 'Drafts proposals, votes on governance' },
  FILE_INDEXER: { label: 'File Indexer', icon: 'folder-open', color: '#06b6d4', description: 'Indexes decentralized file storage' },
  RISK_AUDITOR: { label: 'Risk Auditor', icon: 'shield-checkmark', color: '#ef4444', description: 'Audits contracts, flags anomalies' },
};

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

export function getReputationTier(score: number): ReputationTier {
  if (score >= 8500) return 'ELITE';
  if (score >= 6000) return 'TRUSTED';
  if (score >= 3000) return 'RELIABLE';
  if (score >= 1000) return 'NOVICE';
  return 'UNTRUSTED';
}
