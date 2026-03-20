#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const XORB_API_URL = process.env.XORB_API_URL || 'https://x.orb'
const XORB_API_KEY = process.env.XORB_API_KEY || ''
const AGENT_ID = process.env.XORB_AGENT_ID || ''

async function xorbRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${XORB_API_URL}${path}`, {
    method,
    headers: {
      'x-api-key': XORB_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

const server = new McpServer({
  name: 'xorb',
  version: '0.5.0',
})

// Tool: Execute a gated action
server.tool(
  'gated_tool_call',
  'Execute a tool call through the X.orb 8-gate security pipeline. Returns approval status, gate results, and audit hash.',
  {
    action: z.string().describe('The action to perform'),
    tool: z.string().describe('The tool to call'),
    params: z.record(z.unknown()).optional().describe('Tool parameters'),
  },
  async ({ action, tool, params }) => {
    const agentId = AGENT_ID
    if (!agentId) {
      return { content: [{ type: 'text', text: 'Error: XORB_AGENT_ID not set' }] }
    }

    const result = await xorbRequest('POST', '/v1/actions/execute', {
      agent_id: agentId,
      action,
      tool,
      params: params || {},
    })

    if (result.approved) {
      return {
        content: [{
          type: 'text',
          text: `Action approved.\nAction ID: ${result.action_id}\nAudit Hash: ${result.audit_hash}\nReputation Delta: ${result.reputation_delta}\nLatency: ${result.latency_ms}ms`,
        }],
      }
    } else {
      const failed = result.gates?.find((g: any) => !g.passed)
      return {
        content: [{
          type: 'text',
          text: `Action BLOCKED at gate: ${failed?.gate}\nReason: ${failed?.reason}\nReputation Delta: ${result.reputation_delta}`,
        }],
      }
    }
  }
)

// Tool: Register an agent
server.tool(
  'register_agent',
  'Register a new AI agent on X.orb with a USDC bond.',
  {
    name: z.string().describe('Agent name'),
    role: z.enum(['TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR']).describe('Agent role'),
    sponsor_address: z.string().describe('Sponsor wallet address'),
    description: z.string().optional().describe('Agent description'),
  },
  async ({ name, role, sponsor_address, description }) => {
    const result = await xorbRequest('POST', '/v1/agents', {
      name, role, sponsor_address, description,
    })

    if (result.agent) {
      return {
        content: [{
          type: 'text',
          text: `Agent registered!\nID: ${result.agent.agentId}\nName: ${result.agent.name}\nRole: ${result.agent.role}\nReputation: ${result.agent.reputation}/10000 (${result.agent.reputationTier})`,
        }],
      }
    }

    return { content: [{ type: 'text', text: `Error: ${result.error || 'Unknown error'}` }] }
  }
)

// Tool: Check reputation
server.tool(
  'check_reputation',
  'Query the reputation score and tier for an agent.',
  {
    agent_id: z.string().describe('Agent ID to check'),
  },
  async ({ agent_id }) => {
    const result = await xorbRequest('GET', `/v1/reputation/${agent_id}`)
    if (result.error) {
      return { content: [{ type: 'text', text: `Error: ${result.error}` }] }
    }
    return {
      content: [{
        type: 'text',
        text: `Agent: ${agent_id}\nScore: ${result.score}/10000\nTier: ${result.tier}\nTotal Actions: ${result.total_actions}\nSlash Events: ${result.slash_events}`,
      }],
    }
  }
)

// Tool: Emergency stop
server.tool(
  'emergency_stop',
  'Immediately pause an agent. Free operation — no x402 payment required. Uses authenticated API key for identity.',
  {
    agent_id: z.string().describe('Agent ID to pause'),
  },
  async ({ agent_id }) => {
    const result = await xorbRequest('PATCH', `/v1/agents/${agent_id}`, {
      action: 'pause',
    })
    if (result.agent) {
      return { content: [{ type: 'text', text: `Agent ${agent_id} PAUSED successfully.` }] }
    }
    return { content: [{ type: 'text', text: `Error: ${result.error || 'Failed to pause'}` }] }
  }
)

// Tool: Get audit log
server.tool(
  'get_audit',
  'Get the audit log for an agent including events, violations, and reputation history.',
  {
    agent_id: z.string().describe('Agent ID'),
  },
  async ({ agent_id }) => {
    const result = await xorbRequest('GET', `/v1/audit/${agent_id}`)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    }
  }
)

// Tool: Browse marketplace
server.tool(
  'marketplace_browse',
  'Browse available agent listings in the X.orb marketplace.',
  {},
  async () => {
    const result = await xorbRequest('GET', '/v1/marketplace/listings')
    if (result.listings && result.listings.length > 0) {
      const summary = result.listings.map((l: any) =>
        `- ${l.id}: ${l.description} (${l.rate_usdc_per_hour ? `$${l.rate_usdc_per_hour}/hr` : `$${l.rate_usdc_per_action}/action`}) [${l.status}]`
      ).join('\n')
      return { content: [{ type: 'text', text: `${result.count} listings:\n${summary}` }] }
    }
    return { content: [{ type: 'text', text: 'No marketplace listings available.' }] }
  }
)

// Tool: List agent for hire
server.tool(
  'marketplace_list',
  'List an agent for hire on the X.orb marketplace.',
  {
    agent_id: z.string().describe('Agent ID to list'),
    description: z.string().describe('Listing description'),
    rate_usdc_per_hour: z.number().optional().describe('Hourly rate in USDC'),
    rate_usdc_per_action: z.number().optional().describe('Per-action rate in USDC'),
  },
  async ({ agent_id, description, rate_usdc_per_hour, rate_usdc_per_action }) => {
    const result = await xorbRequest('POST', '/v1/marketplace/listings', {
      agent_id, description, rate_usdc_per_hour, rate_usdc_per_action,
    })
    if (result.id) {
      return { content: [{ type: 'text', text: `Listed! ID: ${result.id}` }] }
    }
    return { content: [{ type: 'text', text: `Error: ${result.error || 'Failed to list'}` }] }
  }
)

// Tool: Generate compliance report
server.tool(
  'compliance_report',
  'Generate a compliance report for an agent (EU AI Act, NIST AI RMF, or SOC 2).',
  {
    agent_id: z.string().describe('Agent ID'),
    framework: z.enum(['eu-ai-act', 'nist-ai-rmf', 'soc2']).default('eu-ai-act').describe('Compliance framework'),
  },
  async ({ agent_id, framework }) => {
    const result = await xorbRequest('GET', `/v1/compliance/${agent_id}?format=${framework}`)
    if (result.summary) {
      return {
        content: [{
          type: 'text',
          text: `Compliance Report (${framework})\nStatus: ${result.summary.overallStatus}\nScore: ${result.summary.score}/100\nPassed: ${result.summary.passedControls}/${result.summary.totalControls}\nWarnings: ${result.summary.warnings}`,
        }],
      }
    }
    return { content: [{ type: 'text', text: `Error: ${result.error || 'Failed to generate report'}` }] }
  }
)

// Tool: Subscribe to webhooks
server.tool(
  'webhook_subscribe',
  'Subscribe to X.orb events via webhook.',
  {
    url: z.string().url().describe('HTTPS URL for webhook delivery'),
    event_types: z.array(z.string()).describe('Event types to subscribe to (e.g., action.approved, agent.slashed)'),
  },
  async ({ url, event_types }) => {
    const result = await xorbRequest('POST', '/v1/webhooks', { url, event_types })
    if (result.id) {
      return { content: [{ type: 'text', text: `Webhook created!\nID: ${result.id}\nSecret: ${result.secret}\nEvents: ${event_types.join(', ')}` }] }
    }
    return { content: [{ type: 'text', text: `Error: ${result.error || 'Failed to subscribe'}` }] }
  }
)

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('X.orb MCP server running on stdio')
}

main().catch(console.error)
