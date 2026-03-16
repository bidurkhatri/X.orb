import type { AgentRole, PermissionScope, ReputationTier } from './types'

const BASE_TOOLS = [
  'get_balance',
  'get_gas_price',
  'get_block_number',
  'get_token_balance',
  'system_info',
]

const CHAIN_QUERY_TOOLS = [
  ...BASE_TOOLS,
  'get_transaction',
  'get_contract_state',
  'query_action_score',
]

export const ROLE_PERMISSIONS: Record<AgentRole, PermissionScope> = {
  TRADER: {
    allowedTools: [...CHAIN_QUERY_TOOLS, 'fetch_market_data', 'submit_transaction_proposal', 'get_token_price'],
    allowedContracts: [],
    maxActionsPerHour: 60,
    canTransferFunds: true,
    maxFundsPerAction: '1000000', // 1 USDC (6 decimals)
    fileAccess: 'read',
  },
  RESEARCHER: {
    allowedTools: [...CHAIN_QUERY_TOOLS, 'fetch_market_data', 'read_notes', 'search_files'],
    allowedContracts: [],
    maxActionsPerHour: 120,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'read',
  },
  MONITOR: {
    allowedTools: [...CHAIN_QUERY_TOOLS, 'alert_user', 'fetch_market_data'],
    allowedContracts: [],
    maxActionsPerHour: 300,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'none',
  },
  CODER: {
    allowedTools: [...BASE_TOOLS, 'read_notes', 'write_note', 'search_files'],
    allowedContracts: [],
    maxActionsPerHour: 60,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'readwrite',
  },
  GOVERNANCE_ASSISTANT: {
    allowedTools: [...CHAIN_QUERY_TOOLS, 'read_proposals', 'draft_proposal', 'read_notes'],
    allowedContracts: [],
    maxActionsPerHour: 30,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'read',
  },
  FILE_INDEXER: {
    allowedTools: ['read_notes', 'search_files', 'write_file_metadata', 'system_info'],
    allowedContracts: [],
    maxActionsPerHour: 200,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'readwrite',
  },
  RISK_AUDITOR: {
    allowedTools: [...CHAIN_QUERY_TOOLS, 'read_audit_logs', 'read_notes', 'alert_user'],
    allowedContracts: [],
    maxActionsPerHour: 120,
    canTransferFunds: false,
    maxFundsPerAction: '0',
    fileAccess: 'read',
  },
}

export function getReputationTier(score: number): ReputationTier {
  if (score >= 8500) return 'ELITE'
  if (score >= 6000) return 'TRUSTED'
  if (score >= 3000) return 'RELIABLE'
  if (score >= 1000) return 'NOVICE'
  return 'UNTRUSTED'
}

export class PermissionChecker {
  private scope: PermissionScope
  private actionCountThisHour = 0
  private hourStart = Date.now()

  constructor(scope: PermissionScope) {
    this.scope = scope
  }

  canUseTool(toolName: string): boolean {
    return this.scope.allowedTools.includes(toolName)
  }

  canTouchContract(address: string): boolean {
    if (this.scope.allowedContracts.length === 0) return false
    return this.scope.allowedContracts.includes(address.toLowerCase()) ||
      this.scope.allowedContracts.includes(address)
  }

  checkRateLimit(): boolean {
    const now = Date.now()
    if (now - this.hourStart > 3600000) {
      this.hourStart = now
      this.actionCountThisHour = 0
    }
    return this.actionCountThisHour < this.scope.maxActionsPerHour
  }

  recordAction(): void {
    this.actionCountThisHour++
  }

  canTransfer(amountStr: string): boolean {
    if (!this.scope.canTransferFunds) return false
    return BigInt(amountStr) <= BigInt(this.scope.maxFundsPerAction)
  }

  getDenialReason(toolName: string): string {
    if (!this.canUseTool(toolName)) return `Role does not permit tool: ${toolName}`
    if (!this.checkRateLimit()) return `Rate limit exceeded: ${this.scope.maxActionsPerHour}/hr`
    return 'Permission denied'
  }
}
