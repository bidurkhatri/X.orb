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
    // Tank reputation below threshold
    registry.updateReputation(agent.agentId, -950) // 1000 - 950 = 50

    const gates: Gate[] = [
      createGateRegistry(registry),
      createGateReputation(registry),
    ]

    const result = await runPipeline(makeContext(agent.agentId), gates)
    expect(result.approved).toBe(false)
    expect(result.gates[1].gate).toBe('reputation')
  })

  it('returns audit_hash and latency_ms', async () => {
    const agent = await spawnTestAgent()
    const result = await runPipeline(makeContext(agent.agentId), [createGateRegistry(registry)])
    expect(result.audit_hash).toBeDefined()
    expect(result.audit_hash.startsWith('0x')).toBe(true)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
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
