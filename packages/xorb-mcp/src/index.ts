#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const XORB_API_URL = process.env.XORB_API_URL || 'https://api.xorb.xyz'
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
  version: '0.1.0',
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
      name, scope: role, sponsor_address, description,
    })

    if (result.agent) {
      return {
        content: [{
          type: 'text',
          text: `Agent registered!\nID: ${result.agent.agentId}\nName: ${result.agent.name}\nScope: ${result.agent.scope || result.agent.role}\nTrust: ${result.agent.reputation ?? result.agent.trustScore}/100 (${result.agent.reputationTier || 'NOVICE'})`,
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
        text: `Agent: ${agent_id}\nScore: ${result.score ?? result.reputation}/100\nTier: ${result.tier ?? result.reputationTier}\nTotal Actions: ${result.total_actions}\nSlash Events: ${result.slash_events}\nSource: ${result.trust_source || 'local'}`,
      }],
    }
  }
)

// Tool: Emergency stop
server.tool(
  'emergency_stop',
  'Immediately pause an agent. Free operation — no x402 payment required.',
  {
    agent_id: z.string().describe('Agent ID to pause'),
    caller_address: z.string().describe('Sponsor wallet address'),
  },
  async ({ agent_id, caller_address }) => {
    const result = await xorbRequest('PATCH', `/v1/agents/${agent_id}`, {
      action: 'pause', caller_address,
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

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('X.orb MCP server running on stdio')
}

main().catch(console.error)
