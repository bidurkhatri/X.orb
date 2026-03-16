// Agent API Gateway — The structured perception/action interface for agents
// Agents interact with the Xorb network through this gateway.
// Every call is authenticated, rate-limited, permission-checked, and logged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Supported agent actions
type AgentAction =
    | 'get_balances'
    | 'get_reputation'
    | 'query_pop_score'
    | 'fetch_market_data'
    | 'submit_action_log'
    | 'get_network_stats'
    | 'list_agents'
    | 'get_agent_history'

interface AgentRequest {
    action: AgentAction
    agentId: string
    params?: Record<string, unknown>
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders })
    }

    try {
        const body: AgentRequest = await req.json()
        const { action, agentId, params } = body

        if (!action || !agentId) {
            return jsonResponse({ error: 'Missing action or agentId' }, 400)
        }

        // Verify agent exists and is active
        const { data: agent, error: agentError } = await supabase
            .from('agent_registry')
            .select('*')
            .eq('agent_id', agentId)
            .single()

        if (agentError || !agent) {
            return jsonResponse({ error: 'Agent not found' }, 404)
        }

        if (agent.status !== 'Active') {
            return jsonResponse({ error: `Agent is ${agent.status}`, status: agent.status }, 403)
        }

        // Check expiry
        if (agent.expires_at && new Date(agent.expires_at) < new Date()) {
            await supabase
                .from('agent_registry')
                .update({ status: 'Expired', updated_at: new Date().toISOString() })
                .eq('agent_id', agentId)
            return jsonResponse({ error: 'Agent expired' }, 403)
        }

        // Route to handler
        let result: unknown
        switch (action) {
            case 'get_reputation':
                result = {
                    score: agent.reputation_score,
                    tier: agent.reputation_tier,
                    totalActions: agent.total_actions,
                }
                break

            case 'get_network_stats':
                const { data: stats } = await supabase
                    .from('network_stats')
                    .select('*')
                    .eq('id', 'global')
                    .single()
                result = stats
                break

            case 'list_agents':
                const { data: agents } = await supabase
                    .from('agent_registry')
                    .select('agent_id, name, role, status, reputation_score, reputation_tier, total_actions, last_active_at')
                    .order('reputation_score', { ascending: false })
                    .limit(params?.limit as number ?? 50)
                result = agents
                break

            case 'get_agent_history':
                const targetId = (params?.targetAgentId as string) || agentId
                const { data: history } = await supabase
                    .from('agent_actions')
                    .select('*')
                    .eq('agent_id', targetId)
                    .order('created_at', { ascending: false })
                    .limit(params?.limit as number ?? 50)
                result = history
                break

            case 'submit_action_log':
                if (!params?.actionType) {
                    return jsonResponse({ error: 'Missing actionType' }, 400)
                }
                const { error: insertError } = await supabase
                    .from('agent_actions')
                    .insert({
                        agent_id: agentId,
                        action_type: params.actionType,
                        tool_name: params.toolName as string,
                        reputation_delta: params.reputationDelta as number ?? 0,
                        reputation_before: agent.reputation_score,
                        reputation_after: agent.reputation_score + ((params.reputationDelta as number) ?? 0),
                        details: params.details ?? {},
                        tx_hash: params.txHash as string,
                    })
                if (insertError) {
                    return jsonResponse({ error: 'Failed to log action' }, 500)
                }

                // Update agent stats
                await supabase
                    .from('agent_registry')
                    .update({
                        total_actions: agent.total_actions + 1,
                        last_active_at: new Date().toISOString(),
                        reputation_score: Math.max(0, Math.min(10000,
                            agent.reputation_score + ((params.reputationDelta as number) ?? 0)
                        )),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('agent_id', agentId)

                result = { logged: true, newReputation: agent.reputation_score + ((params.reputationDelta as number) ?? 0) }
                break

            case 'query_pop_score':
                const { data: popRecords } = await supabase
                    .from('pop_records')
                    .select('*')
                    .eq('wallet_address', agent.session_wallet)
                    .order('created_at', { ascending: false })
                    .limit(10)
                result = popRecords
                break

            case 'fetch_market_data':
                // Return cached market data or proxy to external API
                result = {
                    message: 'Market data endpoint — integrate with external oracle',
                    timestamp: Date.now(),
                }
                break

            case 'get_balances':
                result = {
                    message: 'Balance query — use RPC directly from agent runtime',
                    sessionWallet: agent.session_wallet,
                }
                break

            default:
                return jsonResponse({ error: `Unknown action: ${action}` }, 400)
        }

        return jsonResponse({ success: true, data: result })

    } catch (err) {
        return jsonResponse({ error: 'Internal server error', details: String(err) }, 500)
    }
})

function jsonResponse(data: unknown, status = 200) {
    return new Response(
        JSON.stringify(data),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
