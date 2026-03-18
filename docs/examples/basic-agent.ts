/**
 * X.orb Basic Agent Example
 *
 * Demonstrates the complete lifecycle of an AI agent on X.orb:
 *   1. Create a client
 *   2. Register an agent
 *   3. Execute an action through the 8-gate pipeline
 *   4. Check reputation
 *   5. View audit log
 *
 * Run:
 *   npm install
 *   npx tsx basic-agent.ts
 *
 * Environment:
 *   XORB_API_KEY  — Your X.orb API key (starts with xorb_sk_)
 *   XORB_API_URL  — API base URL (default: https://api.xorb.xyz)
 *   SPONSOR_ADDRESS — Your EVM wallet address
 */

import { XorbClient, XorbAPIError } from '@xorb/sdk'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = process.env.XORB_API_URL || 'https://api.xorb.xyz'
const API_KEY = process.env.XORB_API_KEY

if (!API_KEY) {
  console.error('Error: Set the XORB_API_KEY environment variable.')
  console.error('Generate one with: curl -X POST https://api.xorb.xyz/v1/auth/keys ...')
  process.exit(1)
}

const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS
if (!SPONSOR_ADDRESS) {
  console.error('Error: Set the SPONSOR_ADDRESS environment variable to your wallet address.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Create the client
  const client = new XorbClient({
    apiUrl: API_URL,
    apiKey: API_KEY,
    timeout: 30_000,
  })

  // Verify connectivity
  const health = await client.health()
  console.log(`Connected to X.orb API (version ${health.version})`)
  console.log('---')

  // 2. Register an agent
  console.log('Registering agent...')
  const { agent } = await client.agents.register({
    name: 'example-research-bot',
    role: 'RESEARCHER',
    sponsor_address: SPONSOR_ADDRESS,
    description: 'Demo agent from the getting-started example',
    expiry_days: 30,
  })

  console.log(`Agent registered:`)
  console.log(`  ID:         ${agent.agentId}`)
  console.log(`  Name:       ${agent.name}`)
  console.log(`  Role:       ${agent.role}`)
  console.log(`  Status:     ${agent.status}`)
  console.log(`  Reputation: ${agent.reputation} (${agent.reputationTier})`)
  console.log(`  Wallet:     ${agent.sessionWalletAddress}`)
  console.log('---')

  // 3. Execute an action through the 8-gate pipeline
  console.log('Executing action: query / web_search ...')
  try {
    const result = await client.actions.execute({
      agent_id: agent.agentId,
      action: 'query',
      tool: 'web_search',
      params: {
        query: 'latest AI safety research papers 2026',
      },
    })

    if (result.approved) {
      console.log('Action APPROVED')
      console.log(`  Action ID:   ${result.action_id}`)
      console.log(`  Audit Hash:  ${result.audit_hash}`)
      console.log(`  Rep Delta:   ${result.reputation_delta > 0 ? '+' : ''}${result.reputation_delta}`)
      console.log(`  Latency:     ${result.latency_ms}ms`)
      console.log(`  Gates:`)
      for (const gate of result.gates) {
        const status = gate.passed ? 'PASS' : 'FAIL'
        const reason = gate.reason ? ` — ${gate.reason}` : ''
        console.log(`    [${status}] ${gate.gate} (${gate.latency_ms}ms)${reason}`)
      }
    } else {
      console.log('Action BLOCKED')
      const failedGate = result.gates.find(g => !g.passed)
      console.log(`  Blocked at:  ${failedGate?.gate}`)
      console.log(`  Reason:      ${failedGate?.reason}`)
      console.log(`  Rep Delta:   ${result.reputation_delta}`)
    }
  } catch (err) {
    if (err instanceof XorbAPIError) {
      console.error(`Pipeline error (HTTP ${err.status}): ${err.message}`)
      if (err.requestId) {
        console.error(`Request ID: ${err.requestId}`)
      }
    } else {
      throw err
    }
  }
  console.log('---')

  // 4. Check reputation
  console.log('Checking reputation...')
  const reputation = await client.reputation.get(agent.agentId)
  console.log(`  Score:         ${reputation.score}`)
  console.log(`  Tier:          ${reputation.tier}`)
  console.log(`  Total Actions: ${reputation.total_actions}`)
  console.log(`  Slash Events:  ${reputation.slash_events}`)
  console.log('---')

  // 5. View audit log
  console.log('Fetching audit log...')
  const audit = await client.audit.get(agent.agentId)
  console.log(`  Total Events:  ${audit.events}`)
  console.log(`  Violations:    ${audit.violations.count}`)
  if (audit.recent_events.length > 0) {
    console.log(`  Latest Event:`)
    const latest = audit.recent_events[0] as Record<string, unknown>
    console.log(`    Action:    ${latest.action}`)
    console.log(`    Tool:      ${latest.tool}`)
    console.log(`    Approved:  ${latest.approved}`)
    console.log(`    Hash:      ${latest.audit_hash}`)
    console.log(`    Time:      ${latest.timestamp}`)
  }
  console.log('---')

  // 6. Check pricing (bonus)
  const pricing = await client.pricing()
  console.log('Endpoint Pricing:')
  for (const ep of pricing.endpoints) {
    console.log(`  ${ep.endpoint.padEnd(35)} $${ep.price_usdc} USDC — ${ep.description}`)
  }
  console.log(`  Free tier: ${pricing.free_tier.limit} actions/${pricing.free_tier.period}`)
  console.log('---')

  console.log('Done. Your agent is live and ready to execute actions.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
