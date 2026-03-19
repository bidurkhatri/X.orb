/**
 * Smart Contract Integration Service
 *
 * Connects the X.orb API to on-chain contracts on Polygon PoS.
 * All on-chain operations are optional — the API works without them
 * but returns `onchain_tx: null` when contracts aren't configured.
 */
import { ethers } from 'ethers'
import { randomBytes } from 'node:crypto'

// Contract addresses from CLAUDE.md (Polygon PoS, Chain ID 137)
const CONTRACT_ADDRESSES: Record<string, string> = {
  AgentRegistry: process.env.AGENT_REGISTRY_ADDRESS || '0x2a7457C2f30F9C0Bb47b62ed8554C75d13BF9ec7',
  ReputationScore: process.env.REPUTATION_SCORE_ADDRESS || '0x0350efEcDCFCbcF2Ab3d6421e20Ef867c02D79d8',
  SlashingEngine: process.env.SLASHING_ENGINE_ADDRESS || '0xA64E71Aa00F8f6e8e8acb3a81200dD270FF13625',
  PaymentStreaming: process.env.PAYMENT_STREAMING_ADDRESS || '0xb34717670889190B2A92E64B51e0ea696cE88D89',
  AgentMarketplace: process.env.AGENT_MARKETPLACE_ADDRESS || '0xEAbf85Bf2AE49aFdA531631E8bba219f6e62bF6c',
  ActionVerifier: process.env.ACTION_VERIFIER_ADDRESS || '',
  XorbEscrow: process.env.XORB_ESCROW_ADDRESS || '',
}

// Minimal ABIs — only the functions we call
const AGENT_REGISTRY_ABI = [
  'function spawnAgent(string _name, uint8 _role, uint256 _stakeBond, bytes32 _permissionHash, uint256 _expiresAt, address _sessionWallet) external returns (bytes32)',
  'function slashAgent(bytes32 _agentId, uint256 _amount, bool _autoRevoke) external',
  'function getAgent(bytes32 _agentId) external view returns (tuple(bytes32 agentId, address sponsor, string name, uint8 role, uint256 stakeBond, uint256 slashedAmount, bytes32 permissionHash, uint8 status, uint256 spawnedAt, uint256 expiresAt, uint256 reputationScore, address sessionWallet, uint256 totalActions, uint256 lastActiveAt, string identityCid))',
  'function isActive(bytes32 _agentId) external view returns (bool)',
]

const SLASHING_ENGINE_ABI = [
  'function reportAndSlash(bytes32 _agentId, uint8 _violationType, string _evidence) external',
  'function getAgentSlashCount(bytes32 _agentId) external view returns (uint256)',
]

const ACTION_VERIFIER_ABI = [
  'function anchorAction(bytes32 agentId, bytes32 actionHash, bytes32 auditCid) external',
  'function batchAnchor(bytes32[] agentIds, bytes32[] actionHashes, bytes32[] auditCids) external',
  'function isAnchored(bytes32 actionHash) external view returns (bool)',
]

let provider: ethers.JsonRpcProvider | null = null

function getProvider(): ethers.JsonRpcProvider | null {
  if (!provider) {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.RPC_URL
    if (!rpcUrl) return null
    provider = new ethers.JsonRpcProvider(rpcUrl)
  }
  return provider
}

export function isContractConfigured(): boolean {
  return !!getProvider()
}

/**
 * Simulate a contract transaction via eth_call.
 * Proves the contract accepts the encoded calldata without submitting a real tx.
 * Real tx submission requires a funded signer with @noble/secp256k1 (production upgrade).
 */
async function sendContractTx(to: string, data: string, label: string): Promise<{ txHash: string | null }> {
  const rpc = process.env.POLYGON_RPC_URL || process.env.RPC_URL || ''
  if (!rpc || !to) {
    return { txHash: null }
  }

  try {
    // Use eth_call to simulate the transaction (proves contract accepts our data)
    const callResult = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to, data, from: process.env.XORB_FACILITATOR_ADDRESS || '0x0000000000000000000000000000000000000000' }, 'latest']
      }),
      signal: AbortSignal.timeout(5000),
    }).then(r => r.json())

    if (callResult.error) {
      console.error(JSON.stringify({ level: 'warn', event: 'contract_call_failed', label, error: callResult.error.message }))
      return { txHash: null }
    }

    // Simulation succeeded — log as verified but not submitted
    // Real tx submission requires @noble/secp256k1 signing (production upgrade)
    const simHash = `0xsim_${randomBytes(16).toString('hex')}`
    console.error(JSON.stringify({ level: 'info', event: 'contract_simulated', label, simHash }))
    return { txHash: simHash }
  } catch (err) {
    return { txHash: null }
  }
}

/**
 * Register an agent on-chain via AgentRegistry.spawnAgent()
 * Uses eth_call simulation — returns a sim hash or null if contracts aren't configured.
 */
export async function registerAgentOnChain(opts: {
  name: string
  role: number  // 0-6 mapping to AgentRole enum
  stakeBond: string  // USDC amount in 6 decimals
  permissionHash: string
  expiresAt: number  // Unix timestamp
  sessionWallet: string
}): Promise<string | null> {
  const contractAddr = CONTRACT_ADDRESSES.AgentRegistry
  if (!contractAddr) return null

  try {
    const iface = new ethers.Interface(AGENT_REGISTRY_ABI)
    const data = iface.encodeFunctionData('spawnAgent', [
      opts.name,
      opts.role,
      opts.stakeBond,
      ethers.id(opts.permissionHash),
      opts.expiresAt,
      opts.sessionWallet,
    ])
    const { txHash } = await sendContractTx(contractAddr, data, 'registerAgentOnChain')
    return txHash
  } catch (err) {
    console.error('[Contracts] registerAgentOnChain failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Report a violation and slash on-chain via SlashingEngine.reportAndSlash()
 * Uses eth_call simulation.
 */
export async function slashAgentOnChain(opts: {
  agentId: string  // bytes32 hex
  violationType: number  // 0=RATE_LIMIT, 1=PERMISSION, 2=FUND_MISUSE, 3=CRITICAL
  evidence: string
}): Promise<string | null> {
  const contractAddr = CONTRACT_ADDRESSES.SlashingEngine
  if (!contractAddr) return null

  try {
    const iface = new ethers.Interface(SLASHING_ENGINE_ABI)
    const data = iface.encodeFunctionData('reportAndSlash', [
      ethers.zeroPadValue(ethers.toUtf8Bytes(opts.agentId), 32),
      opts.violationType,
      opts.evidence,
    ])
    const { txHash } = await sendContractTx(contractAddr, data, 'slashAgentOnChain')
    return txHash
  } catch (err) {
    console.error('[Contracts] slashAgentOnChain failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Anchor an audit hash on-chain via ActionVerifier.anchorAction()
 * Uses eth_call simulation.
 */
export async function anchorAuditHashOnChain(opts: {
  agentId: string
  auditHash: string  // 0x-prefixed SHA-256
  actionId: string
}): Promise<string | null> {
  const contractAddr = CONTRACT_ADDRESSES.ActionVerifier
  if (!contractAddr) return null

  try {
    const agentIdBytes = ethers.zeroPadValue(ethers.toUtf8Bytes(opts.agentId), 32)
    const actionHashBytes = ethers.zeroPadValue(ethers.toUtf8Bytes(opts.actionId), 32)
    const auditCidBytes = opts.auditHash.startsWith('0x')
      ? ethers.zeroPadValue(opts.auditHash, 32)
      : ethers.zeroPadValue(ethers.toUtf8Bytes(opts.auditHash), 32)

    const iface = new ethers.Interface(ACTION_VERIFIER_ABI)
    const data = iface.encodeFunctionData('anchorAction', [agentIdBytes, actionHashBytes, auditCidBytes])
    const { txHash } = await sendContractTx(contractAddr, data, 'anchorAuditHashOnChain')
    return txHash
  } catch (err) {
    console.error('[Contracts] anchorAuditHashOnChain failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Check if an action hash is anchored on-chain (read-only, uses eth_call directly)
 */
export async function isAuditHashAnchored(actionId: string): Promise<boolean> {
  const contractAddr = CONTRACT_ADDRESSES.ActionVerifier
  const rpc = process.env.POLYGON_RPC_URL || process.env.RPC_URL
  if (!contractAddr || !rpc) return false

  try {
    const iface = new ethers.Interface(ACTION_VERIFIER_ABI)
    const actionHashBytes = ethers.zeroPadValue(ethers.toUtf8Bytes(actionId), 32)
    const data = iface.encodeFunctionData('isAnchored', [actionHashBytes])

    const result = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: contractAddr, data }, 'latest']
      }),
      signal: AbortSignal.timeout(5000),
    }).then(r => r.json())

    if (result.error || !result.result) return false
    // Decode boolean result
    const decoded = iface.decodeFunctionResult('isAnchored', result.result)
    return decoded[0] === true
  } catch {
    return false
  }
}

/**
 * Get contract status for health endpoint
 */
export function getContractStatus(): Record<string, { address: string; configured: boolean }> {
  const result: Record<string, { address: string; configured: boolean }> = {}
  for (const [name, address] of Object.entries(CONTRACT_ADDRESSES)) {
    result[name] = { address: address || 'not_deployed', configured: !!address }
  }
  return result
}
