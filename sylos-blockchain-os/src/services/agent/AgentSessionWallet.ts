/**
 * @file AgentSessionWallet.ts
 * @description Agent Session Wallet — Bank Account for Licensed Workers
 *
 * Each agent has its own sub-wallet:
 * - Funded by the sponsor (human/DAO)
 * - Spending caps enforced per-action and per-session
 * - Contract interaction restricted to allowlist
 * - Rate-limited transactions per hour
 * - Auto-expires with the agent's visa
 *
 * The agent CANNOT exceed these limits — enforced before tx submission.
 * In production, this uses ERC-4337 session keys.
 * For now, enforced in the frontend runtime.
 */

import type { RegisteredAgent } from './AgentRegistry'

/* ═══════════════════════════════
   ═══  SESSION WALLET  ═════════
   ═══════════════════════════════ */

export interface SessionWallet {
    agentId: string
    walletAddress: string
    /** Total budget allocated by sponsor (in wei) */
    totalBudget: bigint
    /** Amount spent so far this session */
    spent: bigint
    /** Max allowed per single transaction (in wei) */
    maxPerTransaction: bigint
    /** Only these contract addresses can be called */
    allowedContracts: string[]
    /** Max transactions per hour */
    maxTxPerHour: number
    /** Transaction count this hour */
    txCountThisHour: number
    /** Hour window start */
    hourWindowStart: number
    /** When this wallet auto-expires */
    expiresAt: number
    /** Is wallet active */
    active: boolean
}

export interface TransactionProposal {
    to: string
    value: bigint
    data?: string
    description: string
    toolName: string
    agentId: string
}

export interface WalletCheckResult {
    approved: boolean
    reason?: string
    remainingBudget?: bigint
    txCountRemaining?: number
}

/* ═══════════════════════════════
   ═══  WALLET MANAGER  ═════════
   ═══════════════════════════════ */

const WALLETS_KEY = 'xorb_agent_wallets'

class AgentWalletManager {
    private wallets: Map<string, SessionWallet> = new Map()

    constructor() {
        this.loadFromStorage()
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(WALLETS_KEY)
            if (!raw) return
            const parsed: Record<string, any>[] = JSON.parse(raw)
            parsed.forEach(w => {
                this.wallets.set(w['agentId'], {
                    ...w,
                    totalBudget: BigInt(w['totalBudget'] || '0'),
                    spent: BigInt(w['spent'] || '0'),
                    maxPerTransaction: BigInt(w['maxPerTransaction'] || '0'),
                } as any)
            })
        } catch { /* fresh start */ }
    }

    private saveToStorage(): void {
        try {
            const data = Array.from(this.wallets.values()).map(w => ({
                ...w,
                totalBudget: w.totalBudget.toString(),
                spent: w.spent.toString(),
                maxPerTransaction: w.maxPerTransaction.toString(),
            }))
            localStorage.setItem(WALLETS_KEY, JSON.stringify(data))
        } catch { /* ignore */ }
    }

    /**
     * Create a session wallet for a newly spawned agent.
     */
    createWallet(agent: RegisteredAgent): SessionWallet {
        const wallet: SessionWallet = {
            agentId: agent.agentId,
            walletAddress: agent.sessionWalletAddress,
            totalBudget: BigInt(agent.stakeBond),
            spent: BigInt(0),
            maxPerTransaction: agent.permissionScope.maxFundsPerAction,
            allowedContracts: [...agent.permissionScope.allowedContracts],
            maxTxPerHour: agent.permissionScope.maxActionsPerHour,
            txCountThisHour: 0,
            hourWindowStart: Date.now(),
            expiresAt: agent.expiresAt,
            active: true,
        }

        this.wallets.set(agent.agentId, wallet)
        this.saveToStorage()

        console.log(`[AgentWallet] 💳 Wallet created for ${agent.name}: budget ${wallet.totalBudget} wei`)
        return wallet
    }

    /**
     * Check if a proposed transaction is allowed.
     * Returns approval status with reason.
     */
    checkTransaction(proposal: TransactionProposal): WalletCheckResult {
        const wallet = this.wallets.get(proposal.agentId)

        if (!wallet) {
            return { approved: false, reason: 'No session wallet found for this agent' }
        }

        if (!wallet.active) {
            return { approved: false, reason: 'Session wallet is deactivated' }
        }

        // Check expiry
        if (wallet.expiresAt > 0 && Date.now() > wallet.expiresAt) {
            wallet.active = false
            this.saveToStorage()
            return { approved: false, reason: 'Session wallet expired' }
        }

        // Check contract allowlist
        if (proposal.to && wallet.allowedContracts.length > 0) {
            const targetLower = proposal.to.toLowerCase()
            const allowed = wallet.allowedContracts.some(c => c.toLowerCase() === targetLower)
            if (!allowed) {
                return {
                    approved: false,
                    reason: `Contract ${proposal.to} is not in agent's allowlist. Allowed: ${wallet.allowedContracts.join(', ')}`,
                }
            }
        }

        // Check per-transaction limit
        if (proposal.value > wallet.maxPerTransaction) {
            return {
                approved: false,
                reason: `Transaction value ${proposal.value} exceeds per-tx limit of ${wallet.maxPerTransaction}`,
            }
        }

        // Check total budget
        if (wallet.spent + proposal.value > wallet.totalBudget) {
            return {
                approved: false,
                reason: `Would exceed total budget. Spent: ${wallet.spent}, Proposed: ${proposal.value}, Budget: ${wallet.totalBudget}`,
                remainingBudget: wallet.totalBudget - wallet.spent,
            }
        }

        // Check rate limit
        const now = Date.now()
        if (now - wallet.hourWindowStart > 3600000) {
            // Reset hourly window
            wallet.hourWindowStart = now
            wallet.txCountThisHour = 0
        }
        if (wallet.txCountThisHour >= wallet.maxTxPerHour) {
            return {
                approved: false,
                reason: `Rate limit exceeded: ${wallet.maxTxPerHour} transactions per hour`,
                txCountRemaining: 0,
            }
        }

        return {
            approved: true,
            remainingBudget: wallet.totalBudget - wallet.spent - proposal.value,
            txCountRemaining: wallet.maxTxPerHour - wallet.txCountThisHour - 1,
        }
    }

    /**
     * Record a completed transaction — deducts from budget.
     */
    recordTransaction(agentId: string, value: bigint): void {
        const wallet = this.wallets.get(agentId)
        if (!wallet) return

        wallet.spent += value
        wallet.txCountThisHour++
        this.saveToStorage()
    }

    /**
     * Top up an agent's session wallet (sponsor adds more funds).
     */
    topUp(agentId: string, additionalBudget: bigint): void {
        const wallet = this.wallets.get(agentId)
        if (!wallet) throw new Error('Wallet not found')

        wallet.totalBudget += additionalBudget
        this.saveToStorage()

        console.log(`[AgentWallet] 💰 Topped up ${agentId}: +${additionalBudget} wei`)
    }

    /**
     * Deactivate a wallet (on agent pause/revoke).
     */
    deactivateWallet(agentId: string): void {
        const wallet = this.wallets.get(agentId)
        if (!wallet) return

        wallet.active = false
        this.saveToStorage()
    }

    /**
     * Reactivate a wallet (on agent resume).
     */
    activateWallet(agentId: string): void {
        const wallet = this.wallets.get(agentId)
        if (!wallet) return

        wallet.active = true
        this.saveToStorage()
    }

    /**
     * Slash wallet balance (on misbehavior).
     */
    slash(agentId: string, slashAmount: bigint): void {
        const wallet = this.wallets.get(agentId)
        if (!wallet) return

        const currentRemaining = wallet.totalBudget - wallet.spent
        const actualSlash = slashAmount > currentRemaining ? currentRemaining : slashAmount
        wallet.totalBudget -= actualSlash
        this.saveToStorage()

        console.warn(`[AgentWallet] 🔪 Slashed ${agentId}: -${actualSlash} wei`)
    }

    /**
     * Get wallet info for an agent.
     */
    getWallet(agentId: string): SessionWallet | undefined {
        return this.wallets.get(agentId)
    }

    /**
     * Get remaining budget.
     */
    getRemainingBudget(agentId: string): bigint {
        const wallet = this.wallets.get(agentId)
        if (!wallet) return BigInt(0)
        return wallet.totalBudget - wallet.spent
    }
}

/* ═══════════════════════════════
   ═══  SINGLETON EXPORT  ═══════
   ═══════════════════════════════ */

export const agentWalletManager = new AgentWalletManager()
