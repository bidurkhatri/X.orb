import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RegisteredAgent } from './AgentRegistry'
import type { SessionWallet } from './AgentSessionWallet'

/* ─── localStorage stub ─── */
let storage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
})

/* ─── Helper: build a minimal RegisteredAgent for wallet creation ─── */

function makeAgent(overrides: Partial<RegisteredAgent> = {}): RegisteredAgent {
  return {
    agentId: 'agent_abc123',
    name: 'TestBot',
    role: 'TRADER',
    sponsorAddress: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
    sessionWalletAddress: '0xabc1230000000000000000000000000000000000',
    stakeBond: '1000000000000000000', // 1 token in wei
    permissionScope: {
      allowedTools: [],
      allowedContracts: ['0xcontract1'],
      allowedIpcTypes: [],
      maxActionsPerHour: 60,
      canPropose: false,
      canVote: false,
      canTransferFunds: true,
      maxFundsPerAction: BigInt('500000000000000000'), // 0.5 token
      fileAccess: 'none' as const,
    },
    reputation: 1000,
    reputationTier: 'NOVICE',
    status: 'active',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    lastActiveAt: Date.now(),
    llmProvider: { name: 'OpenAI', apiUrl: 'https://api.openai.com', model: 'gpt-4' },
    totalActionsExecuted: 0,
    totalValueGenerated: '0',
    slashEvents: 0,
    description: 'Test agent',
    ...overrides,
  }
}

/**
 * Get a fresh AgentWalletManager by resetting module cache.
 * The singleton reconstructs from (empty) localStorage.
 */
async function freshManager() {
  vi.resetModules()

  // Re-stub after resetModules
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
  })

  const mod = await import('./AgentSessionWallet')
  return mod.agentWalletManager
}

beforeEach(() => {
  storage = {}
})

/* ════════════════════════════════════════════ */

describe('AgentSessionWallet', () => {
  /* ─── createWallet ─── */

  it('creates a wallet for an agent with correct initial values', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    const wallet = mgr.createWallet(agent)

    expect(wallet.agentId).toBe(agent.agentId)
    expect(wallet.walletAddress).toBe(agent.sessionWalletAddress)
    expect(wallet.totalBudget).toBe(BigInt(agent.stakeBond))
    expect(wallet.spent).toBe(BigInt(0))
    expect(wallet.active).toBe(true)
    expect(wallet.txCountThisHour).toBe(0)
    expect(wallet.maxTxPerHour).toBe(agent.permissionScope.maxActionsPerHour)
    expect(wallet.allowedContracts).toEqual(agent.permissionScope.allowedContracts)
  })

  it('persists the wallet to localStorage', async () => {
    const mgr = await freshManager()
    mgr.createWallet(makeAgent())

    const raw = storage['xorb_agent_wallets']
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].agentId).toBe('agent_abc123')
  })

  /* ─── budget tracking ─── */

  it('recordTransaction increases spent amount', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    mgr.recordTransaction(agent.agentId, BigInt('100000000000000000'))

    const wallet = mgr.getWallet(agent.agentId)!
    expect(wallet.spent).toBe(BigInt('100000000000000000'))
    expect(wallet.txCountThisHour).toBe(1)
  })

  it('getRemainingBudget reflects spent amount', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    mgr.recordTransaction(agent.agentId, BigInt('300000000000000000'))

    const remaining = mgr.getRemainingBudget(agent.agentId)
    // 1e18 - 3e17 = 7e17
    expect(remaining).toBe(BigInt('700000000000000000'))
  })

  it('getRemainingBudget returns 0 for unknown agent', async () => {
    const mgr = await freshManager()
    expect(mgr.getRemainingBudget('nonexistent')).toBe(BigInt(0))
  })

  it('checkTransaction rejects when budget would be exceeded', async () => {
    const mgr = await freshManager()
    // Set a small budget but a high per-tx limit so the budget check fires first
    const agent = makeAgent({
      stakeBond: '500000000000000000', // 0.5 token budget
      permissionScope: {
        ...makeAgent().permissionScope,
        maxFundsPerAction: BigInt('1000000000000000000'), // 1 token per-tx limit (higher than budget)
      },
    })
    mgr.createWallet(agent)

    const result = mgr.checkTransaction({
      to: '0xcontract1',
      value: BigInt('600000000000000000'), // 0.6 token > 0.5 budget
      description: 'big tx',
      toolName: 'test',
      agentId: agent.agentId,
    })

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('exceed total budget')
  })

  it('checkTransaction rejects when per-tx limit is exceeded', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    // maxFundsPerAction is 0.5 token — try to send 0.6
    const result = mgr.checkTransaction({
      to: '0xcontract1',
      value: BigInt('600000000000000000'),
      description: 'over limit',
      toolName: 'test',
      agentId: agent.agentId,
    })

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('exceeds per-tx limit')
  })

  it('checkTransaction approves a valid transaction', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    const result = mgr.checkTransaction({
      to: '0xcontract1',
      value: BigInt('100000000000000000'), // 0.1 token, well within limits
      description: 'small tx',
      toolName: 'test',
      agentId: agent.agentId,
    })

    expect(result.approved).toBe(true)
    expect(result.remainingBudget).toBeDefined()
  })

  /* ─── topUp ─── */

  it('topUp increases the total budget', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    mgr.topUp(agent.agentId, BigInt('2000000000000000000'))

    const wallet = mgr.getWallet(agent.agentId)!
    // original 1e18 + 2e18 = 3e18
    expect(wallet.totalBudget).toBe(BigInt('3000000000000000000'))
  })

  it('topUp throws for an unknown wallet', async () => {
    const mgr = await freshManager()
    expect(() => mgr.topUp('nonexistent', BigInt(1))).toThrowError(/Wallet not found/)
  })

  /* ─── activation / deactivation ─── */

  it('deactivateWallet sets active to false', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    mgr.deactivateWallet(agent.agentId)

    const wallet = mgr.getWallet(agent.agentId)!
    expect(wallet.active).toBe(false)
  })

  it('checkTransaction rejects when wallet is deactivated', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)
    mgr.deactivateWallet(agent.agentId)

    const result = mgr.checkTransaction({
      to: '0xcontract1',
      value: BigInt(1),
      description: 'test',
      toolName: 'test',
      agentId: agent.agentId,
    })

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('deactivated')
  })

  it('activateWallet re-enables a deactivated wallet', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)
    mgr.deactivateWallet(agent.agentId)
    mgr.activateWallet(agent.agentId)

    const wallet = mgr.getWallet(agent.agentId)!
    expect(wallet.active).toBe(true)
  })

  /* ─── getWallet ─── */

  it('getWallet returns the wallet for a known agent', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    const wallet = mgr.getWallet(agent.agentId)
    expect(wallet).toBeDefined()
    expect(wallet!.agentId).toBe(agent.agentId)
  })

  it('getWallet returns undefined for unknown agent', async () => {
    const mgr = await freshManager()
    expect(mgr.getWallet('nonexistent')).toBeUndefined()
  })

  /* ─── slash ─── */

  it('slash reduces the total budget', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    mgr.slash(agent.agentId, BigInt('200000000000000000'))

    const wallet = mgr.getWallet(agent.agentId)!
    // 1e18 - 2e17 = 8e17
    expect(wallet.totalBudget).toBe(BigInt('800000000000000000'))
  })

  it('slash does not reduce budget below spent', async () => {
    const mgr = await freshManager()
    const agent = makeAgent({ stakeBond: '500000000000000000' })
    mgr.createWallet(agent)
    // Spend 3e17
    mgr.recordTransaction(agent.agentId, BigInt('300000000000000000'))
    // Try to slash 4e17 (only 2e17 remaining after spend)
    mgr.slash(agent.agentId, BigInt('400000000000000000'))

    const wallet = mgr.getWallet(agent.agentId)!
    // remaining was 2e17, so budget = 5e17 - 2e17 = 3e17
    expect(wallet.totalBudget).toBe(BigInt('300000000000000000'))
  })

  /* ─── contract allowlist ─── */

  it('checkTransaction rejects calls to non-allowed contracts', async () => {
    const mgr = await freshManager()
    const agent = makeAgent()
    mgr.createWallet(agent)

    const result = mgr.checkTransaction({
      to: '0xunknownContract',
      value: BigInt(1),
      description: 'test',
      toolName: 'test',
      agentId: agent.agentId,
    })

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('not in agent\'s allowlist')
  })
})
