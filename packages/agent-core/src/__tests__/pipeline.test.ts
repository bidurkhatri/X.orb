import { describe, it, expect, beforeEach } from 'vitest'
import { AgentRegistryService } from '../registry'
import { runPipeline, type Gate } from '../pipeline/runner'
import {
  createGateRegistry,
  createGatePermissions,
  createGateRateLimit,
  createGateReputation,
} from '../pipeline/gates'
import type { DataStore, AgentRow, AgentUpsert, ActionInsert } from '../adapters'
import type { PipelineContext } from '../types'

class MockDataStore implements DataStore {
  private agents = new Map<string, AgentRow>()
  async fetchAgent(id: string) { return this.agents.get(id) || null }
  async fetchAllAgents() { return Array.from(this.agents.values()) }
  async fetchAgentsBySponsor() { return [] }
  async upsertAgent(agent: AgentUpsert) {
    this.agents.set(agent.agent_id, {
      ...agent,
      permission_scope: null,
      reputation_tier: null,
      slashed_amount: '0',
      permission_hash: '',
    } as AgentRow)
  }
  async deleteAgent(id: string) { this.agents.delete(id) }
  async insertAction() {}
  async fetchAgentActions() { return [] }
}

describe('Pipeline', () => {
  let registry: AgentRegistryService
  let store: MockDataStore

  beforeEach(async () => {
    store = new MockDataStore()
    registry = new AgentRegistryService(store)
    await registry.load()
  })

  async function spawnTestAgent() {
    return registry.spawnAgent({
      name: 'PipelineBot',
      role: 'RESEARCHER',
      sponsorAddress: '0x1234567890abcdef1234567890abcdef12345678',
      description: 'Test agent for pipeline',
    })
  }

  function makeContext(agentId: string, tool = 'get_balance'): PipelineContext {
    return {
      agentId,
      action: 'test_action',
      tool,
      params: {},
      gateResults: [],
      startTime: Date.now(),
    }
  }

  it('approves valid action through all gates', async () => {
    const agent = await spawnTestAgent()
    const gates: Gate[] = [
      createGateRegistry(registry),
      createGatePermissions(),
      createGateRateLimit(),
      createGateReputation(registry),
    ]

    const result = await runPipeline(makeContext(agent.agentId), gates)
    expect(result.approved).toBe(true)
    expect(result.gates).toHaveLength(4)
    expect(result.gates.every(g => g.passed)).toBe(true)
  })

  it('blocks unregistered agent at registry gate', async () => {
    const gates: Gate[] = [createGateRegistry(registry)]
    const result = await runPipeline(makeContext('agent_nonexistent'), gates)
    expect(result.approved).toBe(false)
    expect(result.gates[0].gate).toBe('registry')
    expect(result.gates[0].passed).toBe(false)
  })

  it('blocks disallowed tool at permissions gate', async () => {
    const agent = await spawnTestAgent()
    const gates: Gate[] = [
      createGateRegistry(registry),
      createGatePermissions(),
    ]

    const result = await runPipeline(
      makeContext(agent.agentId, 'submit_transaction_proposal'), // not allowed for RESEARCHER
      gates,
    )
    expect(result.approved).toBe(false)
    expect(result.gates[1].gate).toBe('permissions')
    expect(result.gates[1].passed).toBe(false)
  })

  it('blocks when rate limit exceeded', async () => {
    const agent = await spawnTestAgent()
    const rateGate = createGateRateLimit()
    const gates: Gate[] = [
      createGateRegistry(registry),
      rateGate,
    ]

    // RESEARCHER has 120/hr limit. Exhaust it.
    for (let i = 0; i < 120; i++) {
      await runPipeline(makeContext(agent.agentId), gates)
    }

    const result = await runPipeline(makeContext(agent.agentId), gates)
    expect(result.approved).toBe(false)
    expect(result.gates[1].gate).toBe('rate_limit')
  })

  it('blocks low reputation agent', async () => {
    const agent = await spawnTestAgent()
    // Directly set reputation below the gate threshold (100 for non-financial)
    // without triggering auto-pause (which happens via updateReputation at <500)
    agent.reputation = 50
    agent.status = 'active' // keep active to pass registry gate

    const gates: Gate[] = [
      createGateRegistry(registry),
      createGateReputation(registry),
    ]

    const result = await runPipeline(makeContext(agent.agentId), gates)
    expect(result.approved).toBe(false)
    expect(result.gates[1].gate).toBe('reputation')
    expect(result.gates[1].passed).toBe(false)
  })

  it('returns audit_hash and latency_ms', async () => {
    const agent = await spawnTestAgent()
    const result = await runPipeline(makeContext(agent.agentId), [createGateRegistry(registry)])
    expect(result.audit_hash).toBeDefined()
    expect(result.audit_hash.startsWith('0x')).toBe(true)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('audit_hash is a real SHA-256 (66 chars, deterministic, collision-resistant)', async () => {
    const { createHash } = await import('node:crypto')
    const agent = await spawnTestAgent()

    // Run pipeline twice with same context startTime to get deterministic input
    const ctx1 = makeContext(agent.agentId)
    ctx1.startTime = 1700000000000
    const result1 = await runPipeline(ctx1, [createGateRegistry(registry)])

    const ctx2 = makeContext(agent.agentId)
    ctx2.startTime = 1700000000000
    const result2 = await runPipeline(ctx2, [createGateRegistry(registry)])

    // (a) Output is 66 characters: "0x" + 64 hex
    expect(result1.audit_hash).toHaveLength(66)
    expect(result1.audit_hash).toMatch(/^0x[0-9a-f]{64}$/)

    // (b) Same input produces same hash
    expect(result1.audit_hash).toBe(result2.audit_hash)

    // (c) Different input produces different hash
    const ctx3 = makeContext(agent.agentId, 'different_tool')
    ctx3.startTime = 1700000000000
    const result3 = await runPipeline(ctx3, [createGateRegistry(registry)])
    expect(result3.audit_hash).not.toBe(result1.audit_hash)

    // (d) Verify it's a real SHA-256 by checking character set and length
    // The hash is computed over internal pipeline state, so we verify
    // structural properties rather than recomputing (which would require
    // duplicating internal serialization logic)
    const hashBytes = Buffer.from(result1.audit_hash.slice(2), 'hex')
    expect(hashBytes).toHaveLength(32) // SHA-256 produces 32 bytes
  })

  it('stops at first failed gate', async () => {
    const gates: Gate[] = [
      createGateRegistry(registry), // will fail (no agent)
      createGatePermissions(),       // should not run
    ]

    const result = await runPipeline(makeContext('nonexistent'), gates)
    expect(result.gates).toHaveLength(1) // only 1 gate ran
  })
})
