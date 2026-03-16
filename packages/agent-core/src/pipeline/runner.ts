import { v4 as uuidv4 } from 'uuid'
import type { PipelineContext, PipelineResult, GateResult } from '../types'

export type Gate = (ctx: PipelineContext) => Promise<GateResult>

export async function runPipeline(
  ctx: PipelineContext,
  gates: Gate[]
): Promise<PipelineResult> {
  ctx.startTime = Date.now()
  ctx.gateResults = []

  for (const gate of gates) {
    const result = await gate(ctx)
    ctx.gateResults.push(result)
    if (!result.passed) {
      return buildResult(ctx, false)
    }
  }

  return buildResult(ctx, true)
}

function buildResult(ctx: PipelineContext, approved: boolean): PipelineResult {
  const latency = Date.now() - ctx.startTime
  return {
    action_id: `act_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    agent_id: ctx.agentId,
    approved,
    gates: ctx.gateResults,
    reputation_delta: approved ? 1 : -5,
    audit_hash: generateAuditHash(ctx),
    timestamp: new Date().toISOString(),
    latency_ms: latency,
  }
}

function generateAuditHash(ctx: PipelineContext): string {
  // Simple hash for now - in production use crypto.subtle.digest
  const data = JSON.stringify({
    agent_id: ctx.agentId,
    action: ctx.action,
    tool: ctx.tool,
    gates: ctx.gateResults,
    timestamp: Date.now(),
  })
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const chr = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`
}
