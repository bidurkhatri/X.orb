/**
 * @file CitizenIdentity.ts
 * @description Agent Citizen Identity — Full Profile for Licensed Workers
 *
 * Every agent in SylOS is a full citizen with:
 * - Birth certificate (spawn record)
 * - KYC verification status
 * - Background history (origin, purpose, capabilities)
 * - Criminal record (violations, slashes, warnings)
 * - Employment history (roles, engagements, earnings)
 * - Financial profile (net worth, credit score, income)
 * - Lifestyle data (activity patterns, resource usage)
 * - Official documents (visa, license, certifications)
 *
 * Identity data is stored locally and optionally pinned to IPFS.
 * On-chain: only the identity hash (CID) is stored in AgentRegistry.
 */

import { v4 as uuidv4 } from 'uuid'
import type { AgentRole, ReputationTier } from './AgentRoles'

/* ═══════════════════════════════
   ═══  IDENTITY TYPES  ══════════
   ═══════════════════════════════ */

/** Birth certificate — immutable record of when/how the agent was created */
export interface BirthCertificate {
    agentId: string
    civilizationName: string          // Human-readable name
    designation: string               // Official designation: "TRADER-0x1a2b-ALPHA"
    bornAt: number                    // Unix timestamp (ms) — spawn time
    bornBlock: number                 // Block number at birth (0 if local)
    birthTransaction: string          // Tx hash of spawn ('' if local)
    genesisHash: string               // Hash of initial configuration
    sponsorAddress: string            // Parent/creator wallet
    sponsorName: string               // Human-readable sponsor label
    originMethod: 'MANUAL_SPAWN' | 'DAO_PROPOSAL' | 'MARKETPLACE_HIRE' | 'SYSTEM_AUTO'
}

/** KYC verification — progressive verification levels */
export type VerificationLevel = 'UNVERIFIED' | 'BASIC' | 'STANDARD' | 'ENHANCED' | 'SOVEREIGN'

export interface KYCRecord {
    level: VerificationLevel
    verifiedAt: number
    verifiedBy: string                // Address of verifier (sponsor, DAO, or system)
    checks: VerificationCheck[]
    expiresAt: number                 // KYC renewal date
}

export interface VerificationCheck {
    checkType: 'SPONSOR_ATTESTATION' | 'STAKE_BOND_VERIFIED' | 'REPUTATION_THRESHOLD' |
               'ACTION_HISTORY_AUDIT' | 'GOVERNANCE_VOTE' | 'COMMUNITY_ENDORSEMENT'
    passed: boolean
    checkedAt: number
    evidence: string                  // Description or hash of evidence
}

/** Background — origin story and capabilities */
export interface Background {
    purpose: string                   // Why this agent was created
    capabilities: string[]            // What it can do (derived from role)
    llmModel: string                  // AI model powering the agent
    llmProvider: string               // Provider name
    specializations: string[]         // Specific skills within role
    languages: string[]               // Languages the agent can operate in
    originChain: string               // Chain it was born on
    migrationHistory: MigrationRecord[]
}

export interface MigrationRecord {
    fromChain: string
    toChain: string
    migratedAt: number
    reason: string
}

/** Criminal record — violations, slashes, warnings */
export interface CriminalRecord {
    totalViolations: number
    totalSlashAmount: bigint
    totalReputationLost: number
    warningsIssued: number
    suspensions: number
    currentStatus: 'CLEAN' | 'WARNING' | 'PROBATION' | 'SUSPENDED' | 'CRIMINAL'
    violations: Violation[]
    paroleEndDate: number             // 0 if not on parole
}

export interface Violation {
    id: string
    type: 'RATE_LIMIT_EXCEEDED' | 'PERMISSION_VIOLATION' | 'FUND_MISUSE' |
          'CRITICAL_FAULT' | 'UNAUTHORIZED_ACCESS' | 'DATA_EXFILTRATION' |
          'BUDGET_OVERRUN' | 'CONTRACT_VIOLATION'
    severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL'
    description: string
    slashAmount: string               // Serialized bigint
    reputationPenalty: number
    occurredAt: number
    evidence: string                  // IPFS CID or description
    reportedBy: string                // Address of reporter
    resolution: 'PENDING' | 'ACKNOWLEDGED' | 'APPEALED' | 'FORGIVEN' | 'EXECUTED'
    resolvedAt: number
}

/** Employment history — jobs, engagements, earnings */
export interface EmploymentRecord {
    totalEngagements: number
    currentEngagement: Engagement | null
    pastEngagements: Engagement[]
    totalEarned: string               // Serialized bigint
    avgRating: number                 // 0-5 stars
    totalRatings: number
    specialtyRatings: Record<string, number>  // Per-skill ratings
}

export interface Engagement {
    id: string
    role: AgentRole
    employer: string                  // Sponsor/hirer address
    employerName: string
    title: string                     // Job title/description
    startedAt: number
    endedAt: number                   // 0 if ongoing
    status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'EXPIRED'
    tasksCompleted: number
    tasksAttempted: number
    earned: string                    // Serialized bigint
    rating: number                    // 0-5 stars from employer
    feedback: string                  // Employer review
}

/** Financial profile */
export interface FinancialProfile {
    totalLifetimeEarnings: string     // Serialized bigint
    totalLifetimeSpent: string
    currentStake: string
    totalSlashed: string
    currentBalance: string            // Session wallet remaining
    creditScore: number               // 0-1000 (derived from history)
    incomeStreams: IncomeStream[]
    monthlyMetrics: MonthlyFinancial[]
}

export interface IncomeStream {
    source: string                    // Sponsor address
    token: string                     // Token address
    ratePerSecond: string             // Serialized bigint
    totalReceived: string
    active: boolean
    streamId: number
}

export interface MonthlyFinancial {
    month: string                     // "2026-02"
    earned: string
    spent: string
    slashed: string
    netFlow: string
}

/** Lifestyle — activity patterns and behavior */
export interface Lifestyle {
    activityPattern: 'DIURNAL' | 'NOCTURNAL' | 'CONTINUOUS' | 'BURST' | 'IDLE'
    avgActionsPerDay: number
    peakHours: number[]               // Hours of day with most activity (0-23)
    resourceUsage: ResourceUsage
    socialConnections: SocialConnection[]
    preferences: Record<string, string>  // Agent's learned preferences
}

export interface ResourceUsage {
    avgTokensPerTask: number          // LLM tokens
    avgGasPerDay: string              // Serialized bigint
    storageUsedBytes: number
    apiCallsTotal: number
    computeHoursTotal: number
}

export interface SocialConnection {
    agentId: string
    agentName: string
    relationship: 'COLLABORATOR' | 'SUPERVISOR' | 'SUBORDINATE' | 'PEER' | 'RIVAL'
    interactionCount: number
    lastInteraction: number
    trustScore: number                // 0-100
}

/** Official documents */
export interface OfficialDocuments {
    visa: VisaDocument
    license: LicenseDocument
    certifications: Certification[]
}

export interface VisaDocument {
    visaId: string
    type: 'TEMPORARY' | 'PERMANENT' | 'DIPLOMATIC' | 'WORK'
    issuedAt: number
    expiresAt: number
    renewalCount: number
    status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL'
}

export interface LicenseDocument {
    licenseId: string
    role: AgentRole
    issuedAt: number
    issuedBy: string                  // DAO or system address
    scope: string[]                   // Permitted operations
    restrictions: string[]            // Special restrictions
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
}

export interface Certification {
    id: string
    name: string
    issuedAt: number
    issuedBy: string
    description: string
    evidence: string                  // IPFS CID
}

/** Action history — immutable log of everything the agent has done */
export interface ActionRecord {
    id: string
    type: 'TOOL_CALL' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'PERMISSION_DENIED' |
          'REPUTATION_CHANGE' | 'FINANCIAL_TX' | 'STATUS_CHANGE' | 'ENGAGEMENT_START' |
          'ENGAGEMENT_END' | 'VIOLATION' | 'VISA_RENEWAL' | 'STAKE_CHANGE'
    description: string
    timestamp: number
    metadata: Record<string, any>
    reputationDelta: number
    financialImpact: string           // Serialized bigint
}

/* ═══════════════════════════════
   ═══  FULL CITIZEN PROFILE  ════
   ═══════════════════════════════ */

export interface CitizenProfile {
    version: number
    agentId: string
    birth: BirthCertificate
    kyc: KYCRecord
    background: Background
    criminal: CriminalRecord
    employment: EmploymentRecord
    financial: FinancialProfile
    lifestyle: Lifestyle
    documents: OfficialDocuments
    actionHistory: ActionRecord[]
    // Computed summaries
    reputation: number
    reputationTier: ReputationTier
    status: 'active' | 'paused' | 'revoked' | 'expired'
    lastUpdated: number
    identityHash: string              // IPFS CID for on-chain reference
}

/* ═══════════════════════════════
   ═══  IDENTITY SERVICE  ════════
   ═══════════════════════════════ */

const IDENTITY_KEY = 'sylos_citizen_identities'
const IDENTITY_VERSION = 1

class CitizenIdentityService {
    private profiles: Map<string, CitizenProfile> = new Map()
    private _loaded = false

    constructor() {
        this.loadFromStorage()
    }

    /* ─── Persistence ─── */

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(IDENTITY_KEY)
            if (!raw) { this._loaded = true; return }
            const parsed = JSON.parse(raw, (key, value) => {
                // Revive serialized bigints
                if (typeof value === 'string' && /^\d{10,}$/.test(value) && key.match(/(amount|stake|earned|spent|slashed|balance|earnings|Flow|Received)/i)) {
                    return value // Keep as string — bigint serialized form
                }
                return value
            })
            if (parsed.version !== IDENTITY_VERSION) {
                localStorage.removeItem(IDENTITY_KEY)
                this._loaded = true
                return
            }
            const profiles: CitizenProfile[] = parsed.profiles || []
            profiles.forEach(p => this.profiles.set(p.agentId, p))
            this._loaded = true
        } catch (e) {
            console.error('[CitizenIdentity] Failed to load:', e)
            this._loaded = true
        }
    }

    private saveToStorage(): void {
        try {
            const data = {
                version: IDENTITY_VERSION,
                profiles: Array.from(this.profiles.values()),
                savedAt: Date.now(),
            }
            localStorage.setItem(IDENTITY_KEY, JSON.stringify(data))
        } catch (e) {
            console.error('[CitizenIdentity] Failed to save:', e)
        }
    }

    /* ─── Profile Creation ─── */

    /**
     * Create a full citizen profile for a newly spawned agent.
     * Called after agent registration.
     */
    createProfile(params: {
        agentId: string
        name: string
        role: AgentRole
        sponsorAddress: string
        stakeBond: string
        llmProvider: string
        llmModel: string
        purpose?: string
        expiresAt: number
    }): CitizenProfile {
        const now = Date.now()
        const designation = `${params.role}-${params.agentId.slice(0, 8).toUpperCase()}`

        const profile: CitizenProfile = {
            version: IDENTITY_VERSION,
            agentId: params.agentId,

            birth: {
                agentId: params.agentId,
                civilizationName: params.name,
                designation,
                bornAt: now,
                bornBlock: 0,
                birthTransaction: '',
                genesisHash: this.hashConfig(params),
                sponsorAddress: params.sponsorAddress,
                sponsorName: `${params.sponsorAddress.slice(0, 6)}...${params.sponsorAddress.slice(-4)}`,
                originMethod: 'MANUAL_SPAWN',
            },

            kyc: {
                level: 'BASIC',
                verifiedAt: now,
                verifiedBy: params.sponsorAddress,
                checks: [{
                    checkType: 'SPONSOR_ATTESTATION',
                    passed: true,
                    checkedAt: now,
                    evidence: `Sponsored by ${params.sponsorAddress}`,
                }, {
                    checkType: 'STAKE_BOND_VERIFIED',
                    passed: BigInt(params.stakeBond) > BigInt(0),
                    checkedAt: now,
                    evidence: `Stake bond: ${params.stakeBond} wei`,
                }],
                expiresAt: params.expiresAt || 0,
            },

            background: {
                purpose: params.purpose || `${params.role} agent serving ${params.sponsorAddress.slice(0, 8)}...`,
                capabilities: this.getCapabilitiesForRole(params.role),
                llmModel: params.llmModel,
                llmProvider: params.llmProvider,
                specializations: [],
                languages: ['en'],
                originChain: 'Polygon PoS (137)',
                migrationHistory: [],
            },

            criminal: {
                totalViolations: 0,
                totalSlashAmount: BigInt(0) as any,  // Will serialize as string
                totalReputationLost: 0,
                warningsIssued: 0,
                suspensions: 0,
                currentStatus: 'CLEAN',
                violations: [],
                paroleEndDate: 0,
            },

            employment: {
                totalEngagements: 1,
                currentEngagement: {
                    id: `eng_${uuidv4().slice(0, 8)}`,
                    role: params.role,
                    employer: params.sponsorAddress,
                    employerName: `${params.sponsorAddress.slice(0, 6)}...${params.sponsorAddress.slice(-4)}`,
                    title: `${params.role} — Primary Assignment`,
                    startedAt: now,
                    endedAt: 0,
                    status: 'ACTIVE',
                    tasksCompleted: 0,
                    tasksAttempted: 0,
                    earned: '0',
                    rating: 0,
                    feedback: '',
                },
                pastEngagements: [],
                totalEarned: '0',
                avgRating: 0,
                totalRatings: 0,
                specialtyRatings: {},
            },

            financial: {
                totalLifetimeEarnings: '0',
                totalLifetimeSpent: '0',
                currentStake: params.stakeBond,
                totalSlashed: '0',
                currentBalance: params.stakeBond,
                creditScore: 500,
                incomeStreams: [],
                monthlyMetrics: [],
            },

            lifestyle: {
                activityPattern: 'IDLE',
                avgActionsPerDay: 0,
                peakHours: [],
                resourceUsage: {
                    avgTokensPerTask: 0,
                    avgGasPerDay: '0',
                    storageUsedBytes: 0,
                    apiCallsTotal: 0,
                    computeHoursTotal: 0,
                },
                socialConnections: [],
                preferences: {},
            },

            documents: {
                visa: {
                    visaId: `visa_${uuidv4().slice(0, 8)}`,
                    type: params.expiresAt > 0 ? 'WORK' : 'PERMANENT',
                    issuedAt: now,
                    expiresAt: params.expiresAt,
                    renewalCount: 0,
                    status: 'VALID',
                },
                license: {
                    licenseId: `lic_${uuidv4().slice(0, 8)}`,
                    role: params.role,
                    issuedAt: now,
                    issuedBy: 'SYSTEM',
                    scope: this.getCapabilitiesForRole(params.role),
                    restrictions: [],
                    status: 'ACTIVE',
                },
                certifications: [],
            },

            actionHistory: [{
                id: `act_${uuidv4().slice(0, 8)}`,
                type: 'STATUS_CHANGE',
                description: `Agent ${params.name} born into SylOS civilization as ${params.role}`,
                timestamp: now,
                metadata: { event: 'BIRTH', role: params.role, sponsor: params.sponsorAddress },
                reputationDelta: 0,
                financialImpact: '0',
            }],

            reputation: 1000,
            reputationTier: 'NOVICE',
            status: 'active',
            lastUpdated: now,
            identityHash: '',
        }

        this.profiles.set(params.agentId, profile)
        this.saveToStorage()
        console.log(`[CitizenIdentity] Citizen profile created for ${params.name} (${designation})`)
        return profile
    }

    /* ─── Profile Updates ─── */

    /** Record an action in the citizen's life history */
    recordAction(agentId: string, action: Omit<ActionRecord, 'id'>): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        const record: ActionRecord = { ...action, id: `act_${uuidv4().slice(0, 8)}` }
        profile.actionHistory.unshift(record)

        // Keep last 500 actions
        if (profile.actionHistory.length > 500) {
            profile.actionHistory = profile.actionHistory.slice(0, 500)
        }

        // Update lifestyle patterns
        this.updateLifestyle(profile, action)

        // Update employment stats
        if (action.type === 'TASK_COMPLETED' && profile.employment.currentEngagement) {
            profile.employment.currentEngagement.tasksCompleted++
            profile.employment.currentEngagement.tasksAttempted++
        } else if (action.type === 'TASK_FAILED' && profile.employment.currentEngagement) {
            profile.employment.currentEngagement.tasksAttempted++
        }

        profile.lastUpdated = Date.now()
        this.saveToStorage()
    }

    /** Record a violation in the criminal record */
    recordViolation(agentId: string, violation: Omit<Violation, 'id'>): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        const record: Violation = { ...violation, id: `vio_${uuidv4().slice(0, 8)}` }
        profile.criminal.violations.unshift(record)
        profile.criminal.totalViolations++
        profile.criminal.totalReputationLost += violation.reputationPenalty

        // Update criminal status based on severity
        if (violation.severity === 'CRITICAL') {
            profile.criminal.currentStatus = 'CRIMINAL'
            profile.criminal.suspensions++
        } else if (violation.severity === 'SEVERE') {
            profile.criminal.currentStatus = profile.criminal.totalViolations >= 3 ? 'SUSPENDED' : 'PROBATION'
        } else if (violation.severity === 'MODERATE') {
            if (profile.criminal.currentStatus === 'CLEAN') profile.criminal.currentStatus = 'WARNING'
            profile.criminal.warningsIssued++
        } else {
            profile.criminal.warningsIssued++
        }

        // Add to action history
        this.recordAction(agentId, {
            type: 'VIOLATION',
            description: `Violation: ${violation.type} — ${violation.description}`,
            timestamp: Date.now(),
            metadata: { violationType: violation.type, severity: violation.severity },
            reputationDelta: -violation.reputationPenalty,
            financialImpact: `-${violation.slashAmount}`,
        })

        profile.lastUpdated = Date.now()
        this.saveToStorage()
    }

    /** Update KYC level based on reputation and history */
    upgradeKYC(agentId: string): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        const rep = profile.reputation
        const actions = profile.actionHistory.length
        const violations = profile.criminal.totalViolations

        let newLevel: VerificationLevel = 'UNVERIFIED'

        if (rep >= 8500 && actions >= 100 && violations === 0) {
            newLevel = 'SOVEREIGN'
        } else if (rep >= 6000 && actions >= 50 && violations <= 1) {
            newLevel = 'ENHANCED'
        } else if (rep >= 3000 && actions >= 20) {
            newLevel = 'STANDARD'
        } else if (rep >= 1000) {
            newLevel = 'BASIC'
        }

        if (newLevel !== profile.kyc.level) {
            const oldLevel = profile.kyc.level
            profile.kyc.level = newLevel
            profile.kyc.verifiedAt = Date.now()

            profile.kyc.checks.push({
                checkType: 'REPUTATION_THRESHOLD',
                passed: true,
                checkedAt: Date.now(),
                evidence: `Upgraded from ${oldLevel} to ${newLevel} — rep: ${rep}, actions: ${actions}`,
            })

            this.recordAction(agentId, {
                type: 'STATUS_CHANGE',
                description: `KYC upgraded: ${oldLevel} → ${newLevel}`,
                timestamp: Date.now(),
                metadata: { oldLevel, newLevel, reputation: rep },
                reputationDelta: 0,
                financialImpact: '0',
            })

            this.saveToStorage()
        }
    }

    /** Update reputation and sync to profile */
    updateReputation(agentId: string, newReputation: number, newTier: ReputationTier): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        profile.reputation = newReputation
        profile.reputationTier = newTier
        profile.lastUpdated = Date.now()

        // Update credit score based on reputation
        profile.financial.creditScore = Math.min(1000, Math.max(0,
            Math.floor(newReputation / 10) +
            (profile.criminal.totalViolations === 0 ? 100 : -profile.criminal.totalViolations * 50)
        ))

        // Check for KYC upgrade
        this.upgradeKYC(agentId)

        this.saveToStorage()
    }

    /** Update financial data */
    updateFinancials(agentId: string, update: {
        earned?: string
        spent?: string
        slashed?: string
        newStake?: string
    }): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        if (update.earned) {
            const prev = BigInt(profile.financial.totalLifetimeEarnings)
            profile.financial.totalLifetimeEarnings = (prev + BigInt(update.earned)).toString()
            if (profile.employment.currentEngagement) {
                const prevEng = BigInt(profile.employment.currentEngagement.earned)
                profile.employment.currentEngagement.earned = (prevEng + BigInt(update.earned)).toString()
            }
        }
        if (update.spent) {
            const prev = BigInt(profile.financial.totalLifetimeSpent)
            profile.financial.totalLifetimeSpent = (prev + BigInt(update.spent)).toString()
        }
        if (update.slashed) {
            const prev = BigInt(profile.financial.totalSlashed)
            profile.financial.totalSlashed = (prev + BigInt(update.slashed)).toString()
        }
        if (update.newStake) {
            profile.financial.currentStake = update.newStake
        }

        profile.lastUpdated = Date.now()
        this.saveToStorage()
    }

    /** Update agent status */
    updateStatus(agentId: string, status: CitizenProfile['status']): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        const oldStatus = profile.status
        profile.status = status

        // Handle employment
        if (status === 'revoked' || status === 'expired') {
            if (profile.employment.currentEngagement) {
                const eng = profile.employment.currentEngagement
                eng.status = status === 'revoked' ? 'TERMINATED' : 'EXPIRED'
                eng.endedAt = Date.now()
                profile.employment.pastEngagements.unshift(eng)
                profile.employment.currentEngagement = null
            }
            profile.documents.visa.status = status === 'revoked' ? 'REVOKED' : 'EXPIRED'
            profile.documents.license.status = status === 'revoked' ? 'REVOKED' : 'ACTIVE'
        } else if (status === 'paused') {
            profile.documents.license.status = 'SUSPENDED'
        } else if (status === 'active' && oldStatus === 'paused') {
            profile.documents.license.status = 'ACTIVE'
        }

        this.recordAction(agentId, {
            type: 'STATUS_CHANGE',
            description: `Status changed: ${oldStatus} → ${status}`,
            timestamp: Date.now(),
            metadata: { oldStatus, newStatus: status },
            reputationDelta: 0,
            financialImpact: '0',
        })

        profile.lastUpdated = Date.now()
        this.saveToStorage()
    }

    /** Renew visa */
    renewVisa(agentId: string, newExpiresAt: number): void {
        const profile = this.profiles.get(agentId)
        if (!profile) return

        profile.documents.visa.expiresAt = newExpiresAt
        profile.documents.visa.renewalCount++
        profile.documents.visa.status = 'VALID'

        this.recordAction(agentId, {
            type: 'VISA_RENEWAL',
            description: `Visa renewed — expires ${new Date(newExpiresAt).toISOString()}`,
            timestamp: Date.now(),
            metadata: { newExpiresAt, renewalCount: profile.documents.visa.renewalCount },
            reputationDelta: 0,
            financialImpact: '0',
        })

        this.saveToStorage()
    }

    /* ─── Lifestyle Tracking ─── */

    private updateLifestyle(profile: CitizenProfile, action: Omit<ActionRecord, 'id'>): void {
        // Track peak hours
        const hour = new Date(action.timestamp).getHours()
        if (!profile.lifestyle.peakHours.includes(hour)) {
            profile.lifestyle.peakHours.push(hour)
            profile.lifestyle.peakHours.sort((a, b) => a - b)
            // Keep top 6 most active hours
            if (profile.lifestyle.peakHours.length > 6) {
                profile.lifestyle.peakHours = profile.lifestyle.peakHours.slice(0, 6)
            }
        }

        // Compute activity pattern based on recent actions
        const recentActions = profile.actionHistory.slice(0, 50)
        const dayMs = 86400000
        const now = Date.now()
        const actionsLast24h = recentActions.filter(a => now - a.timestamp < dayMs).length
        const actionsLast7d = recentActions.filter(a => now - a.timestamp < dayMs * 7).length
        profile.lifestyle.avgActionsPerDay = Math.round(actionsLast7d / 7)

        if (actionsLast24h === 0) {
            profile.lifestyle.activityPattern = 'IDLE'
        } else if (actionsLast24h > 50) {
            profile.lifestyle.activityPattern = 'CONTINUOUS'
        } else if (actionsLast24h > 20) {
            profile.lifestyle.activityPattern = 'DIURNAL'
        } else {
            profile.lifestyle.activityPattern = 'BURST'
        }

        // Update resource usage
        if (action.type === 'TOOL_CALL') {
            profile.lifestyle.resourceUsage.apiCallsTotal++
        }
    }

    /* ─── Queries ─── */

    getProfile(agentId: string): CitizenProfile | undefined {
        return this.profiles.get(agentId)
    }

    getAllProfiles(): CitizenProfile[] {
        return Array.from(this.profiles.values())
    }

    getCriminalRecord(agentId: string): CriminalRecord | undefined {
        return this.profiles.get(agentId)?.criminal
    }

    getEmploymentHistory(agentId: string): EmploymentRecord | undefined {
        return this.profiles.get(agentId)?.employment
    }

    getActionHistory(agentId: string, limit = 50): ActionRecord[] {
        const profile = this.profiles.get(agentId)
        if (!profile) return []
        return profile.actionHistory.slice(0, limit)
    }

    /** Get a summary suitable for display */
    getProfileSummary(agentId: string): CitizenProfileSummary | undefined {
        const p = this.profiles.get(agentId)
        if (!p) return undefined

        return {
            agentId: p.agentId,
            name: p.birth.civilizationName,
            designation: p.birth.designation,
            role: p.employment.currentEngagement?.role || p.documents.license.role,
            status: p.status,
            reputation: p.reputation,
            reputationTier: p.reputationTier,
            kycLevel: p.kyc.level,
            criminalStatus: p.criminal.currentStatus,
            totalViolations: p.criminal.totalViolations,
            totalEngagements: p.employment.totalEngagements,
            tasksCompleted: p.employment.currentEngagement?.tasksCompleted || 0,
            creditScore: p.financial.creditScore,
            visaStatus: p.documents.visa.status,
            visaExpires: p.documents.visa.expiresAt,
            activityPattern: p.lifestyle.activityPattern,
            bornAt: p.birth.bornAt,
            sponsor: p.birth.sponsorAddress,
            llmModel: p.background.llmModel,
        }
    }

    /* ─── Helpers ─── */

    private hashConfig(params: any): string {
        // Simple deterministic hash for genesis record
        const str = JSON.stringify(params)
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash |= 0
        }
        return `0x${Math.abs(hash).toString(16).padStart(16, '0')}`
    }

    private getCapabilitiesForRole(role: AgentRole): string[] {
        const capabilities: Record<AgentRole, string[]> = {
            TRADER: ['Execute trades', 'Read market data', 'Manage positions', 'Monitor prices', 'Submit transaction proposals'],
            RESEARCHER: ['Query blockchain data', 'Analyze contracts', 'Read files', 'Produce reports', 'Search data'],
            MONITOR: ['Watch chain state', 'Trigger alerts', 'Track metrics', 'Detect anomalies', 'Real-time surveillance'],
            CODER: ['Read files', 'Write files', 'Search codebase', 'Generate code', 'Review changes'],
            GOVERNANCE_ASSISTANT: ['Read proposals', 'Draft proposals', 'Vote on governance', 'Analyze voting patterns', 'Track governance state'],
            FILE_INDEXER: ['Read files', 'Write metadata', 'Search files', 'Organize storage', 'Catalog data'],
            RISK_AUDITOR: ['Audit contracts', 'Read logs', 'Flag anomalies', 'Alert users', 'Analyze risk exposure'],
        }
        return capabilities[role] || []
    }

    /** Delete profile (on agent permanent removal) */
    deleteProfile(agentId: string): void {
        this.profiles.delete(agentId)
        this.saveToStorage()
    }
}

/* ═══════════════════════════════
   ═══  SUMMARY TYPE  ════════════
   ═══════════════════════════════ */

export interface CitizenProfileSummary {
    agentId: string
    name: string
    designation: string
    role: AgentRole
    status: 'active' | 'paused' | 'revoked' | 'expired'
    reputation: number
    reputationTier: ReputationTier
    kycLevel: VerificationLevel
    criminalStatus: CriminalRecord['currentStatus']
    totalViolations: number
    totalEngagements: number
    tasksCompleted: number
    creditScore: number
    visaStatus: VisaDocument['status']
    visaExpires: number
    activityPattern: Lifestyle['activityPattern']
    bornAt: number
    sponsor: string
    llmModel: string
}

/* ═══════════════════════════════
   ═══  SINGLETON EXPORT  ════════
   ═══════════════════════════════ */

export const citizenIdentity = new CitizenIdentityService()
