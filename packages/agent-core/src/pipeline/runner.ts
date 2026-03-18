import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { PipelineContext, PipelineResult, GateResult } from '../types'

export type Gate = (ctx: PipelineContext) => Promise<GateResult>

/** Zod schema for pipeline context validation (A-1: H-02) */
const pipelineContextSchema = z.object({
  agentId: z.string().min(5, 'agentId must be at least 5 characters'),
  action: z.string().min(1, 'action is required'),
  tool: z.string().min(1, 'tool is required'),
  params: z.record(z.unknown()).optional().default({}),
})

export class PipelineValidationError extends Error {
  readonly fields: Array<{ field: string; message: string }>
  constructor(fields: Array<{ field: string; message: string }>) {
    super('Pipeline context validation failed')
    this.name = 'PipelineValidationError'
    this.fields = fields
  }
}

export async function runPipeline(
  ctx: PipelineContext,
  gates: Gate[]
): Promise<PipelineResult> {
  // A-1: Validate pipeline context before any gate runs
  const validation = pipelineContextSchema.safeParse(ctx)
  if (!validation.success) {
    const fields = validation.error.issues.map(i => ({
      field: i.path.join('.'),
      message: i.message,
    }))
    throw new PipelineValidationError(fields)
  }

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
  // A-2: Don't hardcode reputation_delta — set to 0 here.
  // The actual delta is computed by the ReputationEngine in the API service layer
  // and overwritten before returning to the caller.
  return {
    action_id: `act_${uuidv4().replace(/-/g, '')}`, // A-4: full UUID, no truncation
    agent_id: ctx.agentId,
    approved,
    gates: ctx.gateResults,
    reputation_delta: 0,
    audit_hash: generateAuditHash(ctx),
    timestamp: new Date().toISOString(),
    latency_ms: latency,
  }
}

function generateAuditHash(ctx: PipelineContext): string {
  // Canonical JSON with sorted keys for deterministic hashing
  // Strip non-deterministic fields (latency_ms) from gate results
  const deterministicGates = ctx.gateResults.map(g => ({
    gate: g.gate,
    passed: g.passed,
    reason: g.reason,
  }))
  const data = JSON.stringify({
    action: ctx.action,
    agent_id: ctx.agentId,
    gates: deterministicGates,
    timestamp: ctx.startTime,
    tool: ctx.tool,
  })
  return `0x${createHash('sha256').update(data).digest('hex')}`
}
