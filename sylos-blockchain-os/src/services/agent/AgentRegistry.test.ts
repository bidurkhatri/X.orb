import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── localStorage stub ─── */
let storage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
})

/* ─── Mock heavy dependencies that are not under test ─── */

// Supabase — prevent real network calls
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

// AgentIdentity — we only care that registry calls through
vi.mock('./AgentIdentity', () => ({
  agentIdentity: {
    createProfile: vi.fn(),
    updateStatus: vi.fn(),
    updateReputation: vi.fn(),
    updateFinancials: vi.fn(),
    renewVisa: vi.fn(),
  },
}))

/* ─── Import under test (after mocks are in place) ─── */

// We need a fresh registry for each test, so we re-import dynamically.
// AgentRegistry is a singleton – reset its internal state via storage wipe.

import type { SpawnAgentConfig } from './AgentRegistry'
import type { AgentRole } from './AgentRoles'

function makeConfig(overrides: Partial<SpawnAgentConfig> = {}): SpawnAgentConfig {
  return {
    name: 'TestBot',
    role: 'TRADER' as AgentRole,
    sponsorAddress: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
    llmProvider: { name: 'OpenAI', apiUrl: 'https://api.openai.com', model: 'gpt-4' },
    ...overrides,
  }
}

/*
 * Because AgentRegistryService is a singleton constructed at import time,
 * we re-import the module for each test to get a clean Map.
 */
async function freshRegistry() {
  // Wipe the module cache so the class re-constructs
  vi.resetModules()

  // Re-stub localStorage (resetModules clears stubs on some versions)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
  })

  const mod = await import('./AgentRegistry')
  return mod.agentRegistry
}

beforeEach(() => {
  storage = {}
})

/* ════════════════════════════════════════════ */

describe('AgentRegistry', () => {
  /* ─── spawnAgent ─── */

  it('spawns an agent with valid config and returns it', async () => {
    const registry = await freshRegistry()
    const agent = registry.spawnAgent(makeConfig())

    expect(agent.agentId).toMatch(/^agent_/)
    expect(agent.name).toBe('TestBot')
    expect(agent.role).toBe('TRADER')
    expect(agent.status).toBe('active')
    expect(agent.reputation).toBe(1000)
    expect(agent.reputationTier).toBe('NOVICE')
    expect(agent.totalActionsExecuted).toBe(0)
  })

  it('the spawned agent is retrievable from the registry', async () => {
    const registry = await freshRegistry()
    const agent = registry.spawnAgent(makeConfig())

    const retrieved = registry.getAgent(agent.agentId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('TestBot')
    expect(retrieved!.agentId).toBe(agent.agentId)
    expect(registry.getAgentCount()).toBe(1)
  })

  /* ─── validation: sponsor address ─── */

  it('throws when sponsor address is empty', async () => {
    const registry = await freshRegistry()
    expect(() => registry.spawnAgent(makeConfig({ sponsorAddress: '' })))
      .toThrowError(/Invalid sponsor address/)
  })

  it('throws when sponsor address is too short', async () => {
    const registry = await freshRegistry()
    expect(() => registry.spawnAgent(makeConfig({ sponsorAddress: '0xABC' })))
      .toThrowError(/Invalid sponsor address/)
  })

  /* ─── validation: name ─── */

  it('throws when name is too short (< 2 chars)', async () => {
    const registry = await freshRegistry()
    expect(() => registry.spawnAgent(makeConfig({ name: 'A' })))
      .toThrowError(/Name must be 2-64 characters/)
  })

  it('throws when name is too long (> 64 chars)', async () => {
    const registry = await freshRegistry()
    const longName = 'X'.repeat(65)
    expect(() => registry.spawnAgent(makeConfig({ name: longName })))
      .toThrowError(/Name must be 2-64 characters/)
  })

  it('throws when name is empty', async () => {
    const registry = await freshRegistry()
    expect(() => registry.spawnAgent(makeConfig({ name: '' })))
      .toThrowError(/Name must be 2-64 characters/)
  })

  /* ─── max agents per sponsor ─── */

  it('throws when sponsor has 10 active/paused agents', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'

    for (let i = 0; i < 10; i++) {
      registry.spawnAgent(makeConfig({ name: `Bot${i}`, sponsorAddress: sponsor }))
    }

    expect(() => registry.spawnAgent(makeConfig({ name: 'Bot10', sponsorAddress: sponsor })))
      .toThrowError(/Maximum 10 active agents/)
  })

  it('allows spawning after revoking one to go below the limit', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'

    const agents = []
    for (let i = 0; i < 10; i++) {
      agents.push(registry.spawnAgent(makeConfig({ name: `Bot${i}`, sponsorAddress: sponsor })))
    }

    // Revoke one to make room
    registry.revokeAgent(agents[0]!.agentId, sponsor)

    // Now spawning should succeed
    const newAgent = registry.spawnAgent(makeConfig({ name: 'BotNew', sponsorAddress: sponsor }))
    expect(newAgent.status).toBe('active')
  })

  /* ─── duplicate name ─── */

  it('throws when spawning a duplicate name for the same sponsor', async () => {
    const registry = await freshRegistry()
    registry.spawnAgent(makeConfig({ name: 'UniqueBot' }))

    expect(() => registry.spawnAgent(makeConfig({ name: 'UniqueBot' })))
      .toThrowError(/already have an active agent named/)
  })

  /* ─── pauseAgent ─── */

  it('pauses an active agent', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))

    const paused = registry.pauseAgent(agent.agentId, sponsor)

    expect(paused.status).toBe('paused')
  })

  it('pause throws if caller is not the sponsor', async () => {
    const registry = await freshRegistry()
    const agent = registry.spawnAgent(makeConfig())

    expect(() => registry.pauseAgent(agent.agentId, '0x0000000000000000000000000000000000000000'))
      .toThrowError(/Only the sponsor/)
  })

  it('pause throws for a revoked agent', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))
    registry.revokeAgent(agent.agentId, sponsor)

    expect(() => registry.pauseAgent(agent.agentId, sponsor))
      .toThrowError(/Cannot pause a revoked agent/)
  })

  /* ─── resumeAgent ─── */

  it('resumes a paused agent', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))
    registry.pauseAgent(agent.agentId, sponsor)

    const resumed = registry.resumeAgent(agent.agentId, sponsor)

    expect(resumed.status).toBe('active')
  })

  it('resume throws if agent is not paused', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))

    expect(() => registry.resumeAgent(agent.agentId, sponsor))
      .toThrowError(/Agent is not paused/)
  })

  it('resume throws if caller is not the sponsor', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))
    registry.pauseAgent(agent.agentId, sponsor)

    expect(() => registry.resumeAgent(agent.agentId, '0x0000000000000000000000000000000000000000'))
      .toThrowError(/Only the sponsor/)
  })

  /* ─── revokeAgent ─── */

  it('revokes an agent and slashes its stake to 0', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))

    const revoked = registry.revokeAgent(agent.agentId, sponsor)

    expect(revoked.status).toBe('revoked')
    expect(revoked.stakeBond).toBe('0')
  })

  it('revoke throws if already revoked', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))
    registry.revokeAgent(agent.agentId, sponsor)

    expect(() => registry.revokeAgent(agent.agentId, sponsor))
      .toThrowError(/already revoked/)
  })

  it('revoke throws if caller is not the sponsor', async () => {
    const registry = await freshRegistry()
    const agent = registry.spawnAgent(makeConfig())

    expect(() => registry.revokeAgent(agent.agentId, '0x0000000000000000000000000000000000000000'))
      .toThrowError(/Only the sponsor/)
  })

  /* ─── getAgentsBySponsor ─── */

  it('returns only agents belonging to the given sponsor', async () => {
    const registry = await freshRegistry()
    const s1 = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const s2 = '0x1111111111111111111111111111111111111111'

    registry.spawnAgent(makeConfig({ name: 'Bot1', sponsorAddress: s1 }))
    registry.spawnAgent(makeConfig({ name: 'Bot2', sponsorAddress: s1 }))
    registry.spawnAgent(makeConfig({ name: 'Bot3', sponsorAddress: s2 }))

    const s1Agents = registry.getAgentsBySponsor(s1)
    expect(s1Agents).toHaveLength(2)
    s1Agents.forEach(a => expect(a.sponsorAddress).toBe(s1))

    const s2Agents = registry.getAgentsBySponsor(s2)
    expect(s2Agents).toHaveLength(1)
  })

  it('sponsor lookup is case-insensitive', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))

    const results = registry.getAgentsBySponsor(sponsor.toLowerCase())
    expect(results).toHaveLength(1)
  })

  /* ─── getAllAgents ─── */

  it('returns all registered agents', async () => {
    const registry = await freshRegistry()
    registry.spawnAgent(makeConfig({ name: 'AlphaBot' }))
    registry.spawnAgent(makeConfig({ name: 'BetaBot' }))

    expect(registry.getAllAgents()).toHaveLength(2)
    expect(registry.getAgentCount()).toBe(2)
  })

  /* ─── getAgent ─── */

  it('returns undefined for unknown agent ID', async () => {
    const registry = await freshRegistry()
    expect(registry.getAgent('nonexistent')).toBeUndefined()
  })

  /* ─── canExecute ─── */

  it('active agent can execute', async () => {
    const registry = await freshRegistry()
    const agent = registry.spawnAgent(makeConfig())
    const result = registry.canExecute(agent.agentId)

    expect(result.allowed).toBe(true)
  })

  it('paused agent cannot execute', async () => {
    const registry = await freshRegistry()
    const sponsor = '0xABCDEF1234567890abcdef1234567890ABCDEF12'
    const agent = registry.spawnAgent(makeConfig({ sponsorAddress: sponsor }))
    registry.pauseAgent(agent.agentId, sponsor)

    const result = registry.canExecute(agent.agentId)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('paused')
  })

  it('unregistered agent cannot execute', async () => {
    const registry = await freshRegistry()
    const result = registry.canExecute('fake_id')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not registered')
  })
})
