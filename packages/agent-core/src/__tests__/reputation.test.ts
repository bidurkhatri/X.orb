import { describe, it, expect, beforeEach } from 'vitest'
import { ReputationEngine } from '../reputation'

describe('ReputationEngine', () => {
  let engine: ReputationEngine

  beforeEach(() => {
    engine = new ReputationEngine()
  })

  it('initializes agent with default score of 1000 (NOVICE)', () => {
    engine.initAgent('agent_001')
    const snap = engine.getSnapshot('agent_001')
    expect(snap).toBeDefined()
    expect(snap!.score).toBe(1000)
    expect(snap!.tier).toBe('NOVICE')
    expect(snap!.streakCount).toBe(0)
  })

  it('records success and increases score', () => {
    engine.initAgent('agent_001')
    const event = engine.recordSuccess('agent_001')
    expect(event.pointsDelta).toBe(2)
    expect(event.newScore).toBe(1002)
    expect(event.eventType).toBe('action_success')
  })

  it('records failure and decreases score', () => {
    engine.initAgent('agent_001')
    const event = engine.recordFailure('agent_001')
    expect(event.pointsDelta).toBe(-5)
    expect(event.newScore).toBe(995)
  })

  it('tracks streak and gives bonus at 10', () => {
    engine.initAgent('agent_001')
    let lastEvent
    for (let i = 0; i < 10; i++) {
      lastEvent = engine.recordSuccess('agent_001')
    }
    // 10th success: 2 base + 10 streak bonus = 12
    expect(lastEvent!.pointsDelta).toBe(12)
    const snap = engine.getSnapshot('agent_001')
    expect(snap!.streakCount).toBe(10)
  })

  it('breaks streak on failure', () => {
    engine.initAgent('agent_001')
    for (let i = 0; i < 5; i++) engine.recordSuccess('agent_001')
    engine.recordFailure('agent_001')
    const snap = engine.getSnapshot('agent_001')
    expect(snap!.streakCount).toBe(0)
  })

  it('records violations with correct severity penalties', () => {
    engine.initAgent('agent_001', 5000)
    const minor = engine.recordViolation('agent_001', 'minor')
    expect(minor.pointsDelta).toBe(-50)

    const moderate = engine.recordViolation('agent_001', 'moderate')
    expect(moderate.pointsDelta).toBe(-200)
  })

  it('clamps score between 0 and 10000', () => {
    engine.initAgent('agent_001', 10)
    const event = engine.recordViolation('agent_001', 'critical')
    expect(event.newScore).toBe(0)
    expect(event.newTier).toBe('UNTRUSTED')
  })

  it('tier transitions correctly', () => {
    engine.initAgent('agent_001', 2999)
    expect(engine.getSnapshot('agent_001')!.tier).toBe('NOVICE')

    engine.recordSuccess('agent_001') // 3001
    expect(engine.getSnapshot('agent_001')!.tier).toBe('RELIABLE')
  })

  it('meetsMinimumTier checks correctly', () => {
    engine.initAgent('agent_001', 6000)
    expect(engine.meetsMinimumTier('agent_001', 'TRUSTED')).toBe(true)
    expect(engine.meetsMinimumTier('agent_001', 'ELITE')).toBe(false)
  })

  it('returns history', () => {
    engine.initAgent('agent_001')
    engine.recordSuccess('agent_001')
    engine.recordFailure('agent_001')
    const history = engine.getHistory('agent_001')
    expect(history).toHaveLength(2)
  })

  it('does not apply decay within 7-day grace period', () => {
    engine.initAgent('agent_001')
    const result = engine.applyDecay('agent_001', 5)
    expect(result).toBeNull()
  })

  it('applies decay after grace period', () => {
    engine.initAgent('agent_001')
    const result = engine.applyDecay('agent_001', 10)
    expect(result).not.toBeNull()
    expect(result!.pointsDelta).toBe(-3) // (10-7) * -1
  })
})
