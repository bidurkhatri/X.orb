/**
 * @file AgentRoles.ts
 * @description Agent Role System — Professions in the SylOS Civilization
 *
 * Every agent is instantiated with a ROLE that defines:
 * - What tools it can call
 * - What contracts it can touch
 * - What files it can read/write
 * - How much money it can move
 * - How often it can act
 *
 * Agents don't roam freely. They are licensed workers.
 */

import type { IpcMessageType } from './IpcBridge'
import { CONTRACTS } from '@/config/contracts'

/* ═══════════════════════════════
   ═══════  ROLE TYPES  ═════════
   ═══════════════════════════════ */

export type AgentRole =
    | 'TRADER'
    | 'RESEARCHER'
    | 'MONITOR'
    | 'CODER'
    | 'GOVERNANCE_ASSISTANT'
    | 'FILE_INDEXER'
    | 'RISK_AUDITOR'

export type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired'

export type ReputationTier = 'UNTRUSTED' | 'NOVICE' | 'RELIABLE' | 'TRUSTED' | 'ELITE'

/* ═══════════════════════════════
   ═════  PERMISSION SCOPE  ═════
   ═══════════════════════════════ */

export interface PermissionScope {
    /** Tools this agent is allowed to call */
    allowedTools: string[]
    /** Contract addresses this agent can interact with */
    allowedContracts: string[]
    /** IPC message types this agent can dispatch */
    allowedIpcTypes: IpcMessageType[]
    /** Max actions per hour (rate limit) */
    maxActionsPerHour: number
    /** Can this agent submit governance proposals? */
    canPropose: boolean
    /** Can this agent vote on proposals? */
    canVote: boolean
    /** Can this agent transfer funds from its session wallet? */
    canTransferFunds: boolean
    /** Max funds (in wei) per single action */
    maxFundsPerAction: bigint
    /** File access: 'none' | 'read' | 'readwrite' */
    fileAccess: 'none' | 'read' | 'readwrite'
}

/* ═══════════════════════════════
   ═══  ROLE → PERMISSION MAP  ══
   ═══════════════════════════════ */

const BASE_PERCEPTION_TOOLS = [
    'get_balance',
    'get_gas_price',
    'get_block_number',
    'get_token_balance',
    'system_info',
]

const CHAIN_QUERY_TOOLS = [
    ...BASE_PERCEPTION_TOOLS,
    'get_transaction',
    'get_contract_state',
    'query_pop_score',
]

export const ROLE_PERMISSIONS: Record<AgentRole, PermissionScope> = {
    TRADER: {
        allowedTools: [
            ...CHAIN_QUERY_TOOLS,
            'fetch_market_data',
            'submit_transaction_proposal',
            'get_token_price',
        ],
        allowedContracts: [
            CONTRACTS.WRAPPED_SYLOS,
            CONTRACTS.SYLOS_TOKEN,
        ],
        allowedIpcTypes: ['EXECUTE_ONCHAIN', 'REQUEST_PERMISSION', 'HEARTBEAT'],
        maxActionsPerHour: 60,
        canPropose: false,
        canVote: false,
        canTransferFunds: true,
        maxFundsPerAction: BigInt('1000000000000000000'), // 1 token
        fileAccess: 'read',
    },

    RESEARCHER: {
        allowedTools: [
            ...CHAIN_QUERY_TOOLS,
            'fetch_market_data',
            'read_notes',
            'search_files',
        ],
        allowedContracts: [], // Read-only, no contract interaction
        allowedIpcTypes: ['FILE_READ', 'REQUEST_PERMISSION', 'HEARTBEAT'],
        maxActionsPerHour: 120,
        canPropose: false,
        canVote: false,
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'read',
    },

    MONITOR: {
        allowedTools: [
            ...CHAIN_QUERY_TOOLS,
            'alert_user',
            'fetch_market_data',
        ],
        allowedContracts: [], // Read-only
        allowedIpcTypes: ['REQUEST_PERMISSION', 'HEARTBEAT', 'AGENT_CHAT'],
        maxActionsPerHour: 300, // High frequency monitoring
        canPropose: false,
        canVote: false,
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'none',
    },

    CODER: {
        allowedTools: [
            ...BASE_PERCEPTION_TOOLS,
            'read_notes',
            'write_note',
            'search_files',
        ],
        allowedContracts: [],
        allowedIpcTypes: ['FILE_READ', 'FILE_WRITE', 'REQUEST_PERMISSION', 'HEARTBEAT'],
        maxActionsPerHour: 60,
        canPropose: false,
        canVote: false,
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'readwrite',
    },

    GOVERNANCE_ASSISTANT: {
        allowedTools: [
            ...CHAIN_QUERY_TOOLS,
            'read_proposals',
            'draft_proposal',
            'read_notes',
        ],
        allowedContracts: [CONTRACTS.GOVERNANCE],
        allowedIpcTypes: ['REQUEST_PERMISSION', 'HEARTBEAT'],
        maxActionsPerHour: 30,
        canPropose: true, // Can propose micro-optimizations only
        canVote: true,    // Within narrow bounds, discounted weight
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'read',
    },

    FILE_INDEXER: {
        allowedTools: [
            'read_notes',
            'search_files',
            'write_file_metadata',
            'system_info',
        ],
        allowedContracts: [],
        allowedIpcTypes: ['FILE_READ', 'FILE_WRITE', 'HEARTBEAT'],
        maxActionsPerHour: 200,
        canPropose: false,
        canVote: false,
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'readwrite',
    },

    RISK_AUDITOR: {
        allowedTools: [
            ...CHAIN_QUERY_TOOLS,
            'read_audit_logs',
            'read_notes',
            'alert_user',
        ],
        allowedContracts: [
            CONTRACTS.WRAPPED_SYLOS,
            CONTRACTS.GOVERNANCE,
            CONTRACTS.POP_TRACKER,
            CONTRACTS.SYLOS_TOKEN,
        ],
        allowedIpcTypes: ['REQUEST_PERMISSION', 'HEARTBEAT', 'AGENT_CHAT'],
        maxActionsPerHour: 120,
        canPropose: false,
        canVote: false,
        canTransferFunds: false,
        maxFundsPerAction: BigInt(0),
        fileAccess: 'read',
    },
}

/* ═══════════════════════════════
   ═══  PERMISSION CHECKER  ═════
   ═══════════════════════════════ */

export class PermissionChecker {
    private scope: PermissionScope
    private actionCountThisHour = 0
    private hourStart = Date.now()

    constructor(scope: PermissionScope) {
        this.scope = scope
    }

    /** Check if agent is allowed to call this tool */
    canUseTool(toolName: string): boolean {
        return this.scope.allowedTools.includes(toolName)
    }

    /** Check if agent can interact with this contract */
    canTouchContract(address: string): boolean {
        if (this.scope.allowedContracts.length === 0) return false
        return this.scope.allowedContracts.includes(address.toLowerCase()) ||
            this.scope.allowedContracts.includes(address)
    }

    /** Check if agent can dispatch this IPC message type */
    canDispatchIpc(type: IpcMessageType): boolean {
        return this.scope.allowedIpcTypes.includes(type)
    }

    /** Check rate limit. Returns true if under limit. */
    checkRateLimit(): boolean {
        const now = Date.now()
        if (now - this.hourStart > 3600000) {
            // Reset hourly counter
            this.hourStart = now
            this.actionCountThisHour = 0
        }
        return this.actionCountThisHour < this.scope.maxActionsPerHour
    }

    /** Increment action counter. Call after successful action. */
    recordAction(): void {
        this.actionCountThisHour++
    }

    /** Check if a fund transfer of this amount is allowed */
    canTransfer(amount: bigint): boolean {
        if (!this.scope.canTransferFunds) return false
        return amount <= this.scope.maxFundsPerAction
    }

    /** Get a human-readable denial reason */
    getDenialReason(toolName: string): string {
        if (!this.canUseTool(toolName)) {
            return `Agent role does not permit tool: ${toolName}`
        }
        if (!this.checkRateLimit()) {
            return `Rate limit exceeded: ${this.scope.maxActionsPerHour} actions/hour`
        }
        return 'Permission denied'
    }
}

/* ═══════════════════════════════
   ═══  REPUTATION HELPERS  ═════
   ═══════════════════════════════ */

export function getReputationTier(score: number): ReputationTier {
    if (score >= 8500) return 'ELITE'
    if (score >= 6000) return 'TRUSTED'
    if (score >= 3000) return 'RELIABLE'
    if (score >= 1000) return 'NOVICE'
    return 'UNTRUSTED'
}

export function getReputationColor(tier: ReputationTier): string {
    switch (tier) {
        case 'ELITE': return '#f59e0b'
        case 'TRUSTED': return '#22c55e'
        case 'RELIABLE': return '#3b82f6'
        case 'NOVICE': return '#8b5cf6'
        case 'UNTRUSTED': return '#ef4444'
    }
}

/** Role display metadata */
export const ROLE_META: Record<AgentRole, { label: string; icon: string; color: string; description: string }> = {
    TRADER: { label: 'Trading Agent', icon: '📈', color: '#f59e0b', description: 'Executes trades and manages positions within spending caps' },
    RESEARCHER: { label: 'Research Agent', icon: '🔬', color: '#3b82f6', description: 'Queries chain data and produces analysis (read-only)' },
    MONITOR: { label: 'Monitoring Agent', icon: '👁️', color: '#22c55e', description: 'Watches chain state and triggers alerts' },
    CODER: { label: 'Coding Agent', icon: '💻', color: '#8b5cf6', description: 'Reads and writes files, assists with development' },
    GOVERNANCE_ASSISTANT: { label: 'Governance Agent', icon: '🏛️', color: '#ec4899', description: 'Drafts proposals and participates in governance' },
    FILE_INDEXER: { label: 'File Indexer', icon: '📁', color: '#06b6d4', description: 'Organizes and indexes decentralized file storage' },
    RISK_AUDITOR: { label: 'Risk Auditor', icon: '🛡️', color: '#ef4444', description: 'Audits contract interactions and flags anomalies' },
}
