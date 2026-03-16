import type { ReputationTier } from './types'
import { getReputationTier } from './roles'

export interface ReputationEvent {
  id: string
  agentId: string
  eventType: 'action_success' | 'action_failure' | 'violation' | 'engagement_rating' | 'decay'
  pointsDelta: number
  newScore: number
  newTier: ReputationTier
  sourceId?: string
  timestamp: string
}

export interface ReputationSnapshot {
  agentId: string
  score: number
  tier: ReputationTier
  totalEvents: number
  positiveEvents: number
  negativeEvents: number
  streakCount: number      // consecutive successes
  lastEventAt: string
  decayAppliedAt?: string
}

// Scoring constants
const POINTS = {
  ACTION_SUCCESS: 2,
  ACTION_FAILURE: -5,
  VIOLATION_MINOR: -50,
  VIOLATION_MODERATE: -200,
  VIOLATION_SEVERE: -500,
  VIOLATION_CRITICAL: -1000,
  ENGAGEMENT_RATING_1: -100,
  ENGAGEMENT_RATING_2: -50,
  ENGAGEMENT_RATING_3: 0,
  ENGAGEMENT_RATING_4: 25,
  ENGAGEMENT_RATING_5: 50,
  STREAK_BONUS_10: 10,     // bonus at 10 consecutive successes
  STREAK_BONUS_50: 25,     // bonus at 50
  STREAK_BONUS_100: 50,    // bonus at 100
  DECAY_PER_DAY: -1,       // inactive agents lose 1 point/day
} as const

export class ReputationEngine {
  private snapshots = new Map<string, ReputationSnapshot>()
  private history = new Map<string, ReputationEvent[]>()

  getSnapshot(agentId: string): ReputationSnapshot | undefined {
    return this.snapshots.get(agentId)
  }

  getHistory(agentId: string, limit = 100): ReputationEvent[] {
    return (this.history.get(agentId) || []).slice(-limit)
  }

  initAgent(agentId: string, initialScore = 1000): void {
    this.snapshots.set(agentId, {
      agentId,
      score: initialScore,
      tier: getReputationTier(initialScore),
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      streakCount: 0,
      lastEventAt: new Date().toISOString(),
    })
    this.history.set(agentId, [])
  }

  recordSuccess(agentId: string, sourceId?: string): ReputationEvent {
    const snap = this.getOrInit(agentId)
    snap.streakCount++

    let delta = POINTS.ACTION_SUCCESS
    // Streak bonuses
    if (snap.streakCount === 10) delta += POINTS.STREAK_BONUS_10
    if (snap.streakCount === 50) delta += POINTS.STREAK_BONUS_50
    if (snap.streakCount === 100) delta += POINTS.STREAK_BONUS_100

    return this.applyDelta(agentId, delta, 'action_success', sourceId)
  }

  recordFailure(agentId: string, sourceId?: string): ReputationEvent {
    const snap = this.getOrInit(agentId)
    snap.streakCount = 0 // break streak
    return this.applyDelta(agentId, POINTS.ACTION_FAILURE, 'action_failure', sourceId)
  }

  recordViolation(
    agentId: string,
    severity: 'minor' | 'moderate' | 'severe' | 'critical',
    sourceId?: string
  ): ReputationEvent {
    const snap = this.getOrInit(agentId)
    snap.streakCount = 0

    const deltaMap = {
      minor: POINTS.VIOLATION_MINOR,
      moderate: POINTS.VIOLATION_MODERATE,
      severe: POINTS.VIOLATION_SEVERE,
      critical: POINTS.VIOLATION_CRITICAL,
    }

    return this.applyDelta(agentId, deltaMap[severity], 'violation', sourceId)
  }

  recordEngagementRating(agentId: string, rating: 1 | 2 | 3 | 4 | 5, sourceId?: string): ReputationEvent {
    const ratingMap = {
      1: POINTS.ENGAGEMENT_RATING_1,
      2: POINTS.ENGAGEMENT_RATING_2,
      3: POINTS.ENGAGEMENT_RATING_3,
      4: POINTS.ENGAGEMENT_RATING_4,
      5: POINTS.ENGAGEMENT_RATING_5,
    }
    return this.applyDelta(agentId, ratingMap[rating], 'engagement_rating', sourceId)
  }

  /**
   * Apply time-based reputation decay for inactive agents.
   * Call periodically (e.g., daily cron).
   */
  applyDecay(agentId: string, inactiveDays: number): ReputationEvent | null {
    if (inactiveDays <= 7) return null // 7-day grace period
    const decayDays = inactiveDays - 7
    const delta = POINTS.DECAY_PER_DAY * decayDays
    if (delta === 0) return null

    const snap = this.getOrInit(agentId)
    snap.decayAppliedAt = new Date().toISOString()
    return this.applyDelta(agentId, delta, 'decay')
  }

  /**
   * Check if agent meets minimum tier for an action.
   */
  meetsMinimumTier(agentId: string, requiredTier: ReputationTier): boolean {
    const snap = this.snapshots.get(agentId)
    if (!snap) return false
    const tierOrder: ReputationTier[] = ['UNTRUSTED', 'NOVICE', 'RELIABLE', 'TRUSTED', 'ELITE']
    return tierOrder.indexOf(snap.tier) >= tierOrder.indexOf(requiredTier)
  }

  private getOrInit(agentId: string): ReputationSnapshot {
    let snap = this.snapshots.get(agentId)
    if (!snap) {
      this.initAgent(agentId)
      snap = this.snapshots.get(agentId)!
    }
    return snap
  }

  private applyDelta(
    agentId: string,
    delta: number,
    eventType: ReputationEvent['eventType'],
    sourceId?: string
  ): ReputationEvent {
    const snap = this.getOrInit(agentId)

    snap.score = Math.max(0, Math.min(10000, snap.score + delta))
    snap.tier = getReputationTier(snap.score)
    snap.totalEvents++
    if (delta > 0) snap.positiveEvents++
    if (delta < 0) snap.negativeEvents++
    snap.lastEventAt = new Date().toISOString()

    const event: ReputationEvent = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      eventType,
      pointsDelta: delta,
      newScore: snap.score,
      newTier: snap.tier,
      sourceId,
      timestamp: snap.lastEventAt,
    }

    const hist = this.history.get(agentId) || []
    hist.push(event)
    // Keep last 1000 events per agent
    if (hist.length > 1000) hist.splice(0, hist.length - 1000)
    this.history.set(agentId, hist)

    return event
  }
}
