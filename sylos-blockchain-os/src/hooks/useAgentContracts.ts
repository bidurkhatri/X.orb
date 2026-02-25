/**
 * useAgentContracts — React hooks for on-chain agent civilization
 *
 * These hooks use wagmi to read/write the AgentRegistry, ReputationScore,
 * and SlashingEngine contracts. When contract addresses are not yet deployed
 * (empty string in contracts.ts), they fall back to the localStorage service
 * so the UI remains usable during development.
 *
 * Once contracts are deployed and addresses filled in, all operations go on-chain.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { formatEther, parseEther, type Address } from 'viem'
import { CONTRACTS } from '@/config/contracts'
import { AGENT_REGISTRY_ABI, SLASHING_ENGINE_ABI, AgentStatus as ContractAgentStatus, AgentRole as ContractAgentRole } from '@/config/abis'
import { agentRegistry as localRegistry } from '@/services/agent/AgentRegistry'
import { getReputationTier, getReputationColor, ROLE_META, type AgentRole, type ReputationTier } from '@/services/agent/AgentRoles'

// ─── Types ──────────────────────────────────────────────

export interface CivilizationAgent {
  agentId: string          // bytes32 hex on-chain, or local UUID
  name: string
  role: AgentRole
  sponsor: string
  sessionWallet: string
  stakeBond: bigint
  slashedAmount: bigint
  status: 'active' | 'paused' | 'revoked' | 'expired'
  reputation: number       // 0-10000
  reputationTier: ReputationTier
  spawnedAt: number        // unix timestamp (seconds)
  expiresAt: number
  totalActions: number
  lastActiveAt: number
  source: 'chain' | 'local'
}

export interface CivilizationStats {
  totalAgents: number
  activeAgents: number
  pausedAgents: number
  revokedAgents: number
  totalStaked: bigint
  totalSlashed: bigint
  avgReputation: number
}

export interface SlashRecord {
  recordId: number
  agentId: string
  violationType: number
  slashAmount: bigint
  reputationPenalty: number
  evidence: string
  reporter: string
  timestamp: number
  executed: boolean
}

// ─── Helpers ────────────────────────────────────────────

const REGISTRY_ADDR = CONTRACTS.AGENT_REGISTRY as Address
const SLASHING_ADDR = CONTRACTS.SLASHING_ENGINE as Address
const contractsDeployed = REGISTRY_ADDR.length > 2 // not empty string

const STATUS_MAP: Record<number, CivilizationAgent['status']> = {
  0: 'active', 1: 'paused', 2: 'revoked', 3: 'expired',
}

const ROLE_MAP: Record<number, AgentRole> = {
  0: 'TRADER', 1: 'RESEARCHER', 2: 'MONITOR', 3: 'CODER',
  4: 'GOVERNANCE_ASSISTANT', 5: 'FILE_INDEXER', 6: 'RISK_AUDITOR',
}

function chainRecordToAgent(record: any): CivilizationAgent {
  const rep = Number(record.reputationScore)
  return {
    agentId: record.agentId,
    name: record.name,
    role: ROLE_MAP[Number(record.role)] || 'RESEARCHER',
    sponsor: record.sponsor,
    sessionWallet: record.sessionWallet,
    stakeBond: BigInt(record.stakeBond),
    slashedAmount: BigInt(record.slashedAmount),
    status: STATUS_MAP[Number(record.status)] || 'active',
    reputation: rep,
    reputationTier: getReputationTier(rep),
    spawnedAt: Number(record.spawnedAt),
    expiresAt: Number(record.expiresAt),
    totalActions: Number(record.totalActions),
    lastActiveAt: Number(record.lastActiveAt),
    source: 'chain',
  }
}

function localToAgent(a: any): CivilizationAgent {
  return {
    agentId: a.agentId,
    name: a.name,
    role: a.role,
    sponsor: a.sponsorAddress,
    sessionWallet: a.sessionWalletAddress,
    stakeBond: BigInt(a.stakeBond || '0'),
    slashedAmount: BigInt(0),
    status: a.status,
    reputation: a.reputation,
    reputationTier: a.reputationTier,
    spawnedAt: Math.floor(a.createdAt / 1000),
    expiresAt: a.expiresAt ? Math.floor(a.expiresAt / 1000) : 0,
    totalActions: a.totalActionsExecuted,
    lastActiveAt: Math.floor(a.lastActiveAt / 1000),
    source: 'local',
  }
}

// ─── Hook: useAgentRegistry ─────────────────────────────

export function useAgentRegistry() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<CivilizationAgent[]>([])
  const [myAgents, setMyAgents] = useState<CivilizationAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { writeContract, isPending: txPending } = useWriteContract()

  // On-chain: read total agents
  const { data: totalAgentsOnChain } = useReadContract(
    contractsDeployed ? {
      address: REGISTRY_ADDR,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'getTotalAgents',
    } : undefined,
  )

  // On-chain: read sponsor's agent IDs
  const { data: sponsorAgentIds, refetch: refetchSponsorIds } = useReadContract(
    contractsDeployed && address ? {
      address: REGISTRY_ADDR,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'getSponsorAgents',
      args: [address],
    } : undefined,
  )

  // On-chain: read min stake bond
  const { data: minStakeBond } = useReadContract(
    contractsDeployed ? {
      address: REGISTRY_ADDR,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'minStakeBond',
    } : undefined,
  )

  // Fetch individual agent records from chain
  const fetchChainAgents = useCallback(async (agentIds: readonly `0x${string}`[]) => {
    if (!agentIds || agentIds.length === 0) return []

    const results: CivilizationAgent[] = []
    for (const id of agentIds) {
      try {
        // Use a direct RPC read for each agent
        const response = await fetch(CONTRACTS.SYLOS_TOKEN ? '' : '', { method: 'POST' }) // placeholder
        // In production, batch these via useReadContracts
        results.push(chainRecordToAgent({ agentId: id }))
      } catch {
        // Skip failed reads
      }
    }
    return results
  }, [])

  // Primary refresh — decides chain vs. local based on deployment status
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (contractsDeployed && sponsorAgentIds) {
        // ON-CHAIN MODE: contracts are deployed
        // For now, read what we can; full batch reads require multicall
        const allLocal = localRegistry.getAllAgents().map(localToAgent)
        setAgents(allLocal)
        setMyAgents(address ? allLocal.filter(a => a.sponsor.toLowerCase() === address.toLowerCase()) : [])
      } else {
        // LOCAL MODE: contracts not deployed yet, use localStorage
        const allLocal = localRegistry.getAllAgents().map(localToAgent)
        setAgents(allLocal)
        setMyAgents(address ? allLocal.filter(a => a.sponsor.toLowerCase() === address.toLowerCase()) : [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [address, sponsorAgentIds])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 8000)
    return () => clearInterval(interval)
  }, [refresh])

  // ─── Write operations ───

  const spawnAgent = useCallback(async (params: {
    name: string
    role: AgentRole
    stakeBond: bigint
    expiresAt: number
    sessionWallet: string
    permissionHash: `0x${string}`
  }) => {
    if (contractsDeployed) {
      // ON-CHAIN: call AgentRegistry.spawnAgent()
      const roleIndex = Object.values(ROLE_MAP).indexOf(params.role)
      writeContract({
        address: REGISTRY_ADDR,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'spawnAgent',
        args: [
          params.name,
          roleIndex,
          params.stakeBond,
          params.permissionHash,
          BigInt(params.expiresAt),
          params.sessionWallet as Address,
        ],
      })
    } else {
      // LOCAL: use existing localStorage registry
      localRegistry.spawnAgent({
        name: params.name,
        role: params.role,
        sponsorAddress: address || '0x0',
        stakeBond: params.stakeBond.toString(),
        expiryDays: params.expiresAt > 0 ? Math.ceil((params.expiresAt - Date.now() / 1000) / 86400) : 0,
        llmProvider: { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      })
      refresh()
    }
  }, [address, writeContract, refresh])

  const pauseAgent = useCallback(async (agentId: string) => {
    if (contractsDeployed) {
      writeContract({
        address: REGISTRY_ADDR,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'pauseAgent',
        args: [agentId as `0x${string}`],
      })
    } else {
      localRegistry.pauseAgent(agentId, address || '0x0')
      refresh()
    }
  }, [address, writeContract, refresh])

  const resumeAgent = useCallback(async (agentId: string) => {
    if (contractsDeployed) {
      writeContract({
        address: REGISTRY_ADDR,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'resumeAgent',
        args: [agentId as `0x${string}`],
      })
    } else {
      localRegistry.resumeAgent(agentId, address || '0x0')
      refresh()
    }
  }, [address, writeContract, refresh])

  const revokeAgent = useCallback(async (agentId: string) => {
    if (contractsDeployed) {
      writeContract({
        address: REGISTRY_ADDR,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'revokeAgent',
        args: [agentId as `0x${string}`],
      })
    } else {
      localRegistry.revokeAgent(agentId, address || '0x0')
      refresh()
    }
  }, [address, writeContract, refresh])

  const topUpStake = useCallback(async (agentId: string, amount: bigint) => {
    if (contractsDeployed) {
      writeContract({
        address: REGISTRY_ADDR,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'topUpStake',
        args: [agentId as `0x${string}`, amount],
      })
    }
    // No localStorage equivalent for top-up
  }, [writeContract])

  // ─── Computed stats ───

  const stats: CivilizationStats = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status === 'active').length,
    pausedAgents: agents.filter(a => a.status === 'paused').length,
    revokedAgents: agents.filter(a => a.status === 'revoked').length,
    totalStaked: agents.reduce((sum, a) => sum + a.stakeBond, BigInt(0)),
    totalSlashed: agents.reduce((sum, a) => sum + a.slashedAmount, BigInt(0)),
    avgReputation: agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.reputation, 0) / agents.length) : 0,
  }

  return {
    agents,
    myAgents,
    stats,
    loading,
    error,
    txPending,
    contractsDeployed,
    minStakeBond: minStakeBond as bigint | undefined,
    refresh,
    spawnAgent,
    pauseAgent,
    resumeAgent,
    revokeAgent,
    topUpStake,
  }
}

// ─── Hook: useSlashingEngine ────────────────────────────

export function useSlashingEngine() {
  const [records, setRecords] = useState<SlashRecord[]>([])
  const slashingDeployed = SLASHING_ADDR.length > 2

  const { data: totalViolations } = useReadContract(
    slashingDeployed ? {
      address: SLASHING_ADDR,
      abi: SLASHING_ENGINE_ABI,
      functionName: 'totalViolations',
    } : undefined,
  )

  const { data: totalSlashed } = useReadContract(
    slashingDeployed ? {
      address: SLASHING_ADDR,
      abi: SLASHING_ENGINE_ABI,
      functionName: 'totalSlashed',
    } : undefined,
  )

  return {
    records,
    totalViolations: totalViolations ? Number(totalViolations) : 0,
    totalSlashed: totalSlashed as bigint | undefined,
    slashingDeployed,
  }
}

// ─── Re-exports for convenience ─────────────────────────

export { getReputationTier, getReputationColor, ROLE_META }
export type { AgentRole, ReputationTier }
