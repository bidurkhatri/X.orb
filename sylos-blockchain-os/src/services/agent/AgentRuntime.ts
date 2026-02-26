/**
 * @file AgentRuntime.ts
 * @description SylOS Agent Runtime v2.0 — Civilization Execution Pipeline
 *
 * This is NOT a chatbot. This is the execution engine for licensed AI agents
 * operating within the SylOS digital civilization.
 *
 * Every agent action goes through:
 *  1. Registry Check → Is this agent registered and active?
 *  2. Permission Check → Does this agent's role allow this tool?
 *  3. Rate Limit Check → Has it exceeded its hourly quota?
 *  4. Wallet Check → Does it have budget for financial operations?
 *  5. Audit Log → Immutable trail of every action
 *  6. IPC Dispatch → Notify OS modules of agent activity
 *  7. Execute → Run the actual tool
 *  8. Reputation Update → Score adjusted based on outcome
 */

import { v4 as uuidv4 } from 'uuid'
import { sysIpc, type IpcMessageType } from './IpcBridge'
import { AgentAuditLogService } from './AgentAuditLogService'
import { agentRegistry, type RegisteredAgent, type LLMProvider } from './AgentRegistry'
import { agentWalletManager, type TransactionProposal } from './AgentSessionWallet'
import { citizenIdentity } from './CitizenIdentity'
import { PermissionChecker, ROLE_PERMISSIONS, type AgentRole } from './AgentRoles'
import { CONTRACTS, CHAIN } from '@/config/contracts'

/* ═══════════════════════════════
   ═══  SAFE MATH EVALUATOR  ════
   ═══════════════════════════════ */

function safeMathEval(expr: string): number {
    const tokens = expr.replace(/\s+/g, '').split('')
    let pos = 0
    const peek = () => tokens[pos] || ''
    const next = () => tokens[pos++]
    const parseNumber = (): number => {
        let n = ''
        if (peek() === '-') n += next()
        while (/[0-9.eE+\-]/.test(peek())) n += next()
        if (!n || isNaN(Number(n))) throw new Error('Invalid number')
        return Number(n)
    }
    const parseFactor = (): number => {
        if (peek() === '(') { next(); const v = parseExpr(); if (peek() === ')') next(); return v }
        return parseNumber()
    }
    const parseTerm = (): number => {
        let v = parseFactor()
        while (peek() === '*' || peek() === '/') { const op = next(); const r = parseFactor(); v = op === '*' ? v * r : v / r }
        return v
    }
    const parseExpr = (): number => {
        let v = parseTerm()
        while (peek() === '+' || peek() === '-') { const op = next(); const r = parseTerm(); v = op === '+' ? v + r : v - r }
        return v
    }
    return parseExpr()
}

/* ═══════════════════════════════
   ═══  RPC HELPER  ═════════════
   ═══════════════════════════════ */

const RPC_URL = CHAIN.rpcUrl || 'https://polygon-rpc.com'

async function rpcCall(method: string, params: any[] = []): Promise<any> {
    const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    })
    const json = await res.json()
    if (json.error) throw new Error(`RPC: ${json.error.message}`)
    return json.result
}

/* ═══════════════════════════════
   ═══  TYPES  ══════════════════
   ═══════════════════════════════ */

export interface AgentStep {
    id: string
    type: 'thinking' | 'plan' | 'tool_call' | 'result' | 'error' | 'permission_denied' | 'reputation_update'
    content: string
    toolCall?: ToolCall
    timestamp: number
    status: 'running' | 'success' | 'error' | 'denied'
}

export interface ToolCall {
    id: string
    name: string
    args: Record<string, any>
    status: 'running' | 'success' | 'error' | 'denied'
    result?: string
    denialReason?: string
    startedAt: number
    completedAt?: number
}

export interface AgentTask {
    id: string
    query: string
    status: 'planning' | 'executing' | 'completed' | 'failed' | 'denied'
    steps: AgentStep[]
    createdAt: number
    completedAt?: number
    result?: string
    agentId: string
    agentName: string
}

export interface AgentMessage {
    id: string
    role: 'user' | 'assistant' | 'tool' | 'system'
    content: string
    timestamp: number
    task?: AgentTask
    toolCallId?: string
    toolName?: string
}

export interface AgentTool {
    name: string
    description: string
    category: 'blockchain' | 'os' | 'data' | 'governance'
    parameters: Record<string, { type: string; description: string; required: boolean }>
    execute: (params: Record<string, any>) => Promise<string>
}

export interface AgentConfig {
    apiKey: string
    apiUrl: string
    model: string
    systemPrompt: string
    temperature: number
    maxTokens: number
}

/* ═══════════════════════════════
   ═══  SYSTEM PROMPT  ══════════
   ═══════════════════════════════ */

const buildSystemPrompt = (agent: RegisteredAgent): string => `You are ${agent.name}, a licensed ${agent.role} agent operating within SylOS — a regulated digital civilization for AI agents.

Your Agent ID: ${agent.agentId}
Your Role: ${agent.role}
Your Reputation: ${agent.reputation}/10000 (${agent.reputationTier})
Your Sponsor: ${agent.sponsorAddress}

RULES OF THE CIVILIZATION:
1. You are a licensed worker, not a free agent. You can ONLY use tools permitted by your role.
2. Every action you take is logged immutably. Your reputation depends on your performance.
3. You have a spending budget. Do not waste resources on unnecessary actions.
4. Good work increases your reputation. Bad work, excessive spending, or rule violations decrease it.
5. If your reputation drops too low, you will be automatically paused.
6. You cannot exceed your rate limits or budget caps.

YOUR ALLOWED TOOLS: Use ONLY the tools provided. Do not attempt to call tools outside your permission scope.

BEHAVIOR:
- Be efficient. Plan before acting.
- Report results clearly and structurally.
- If a task is outside your role's scope, say so explicitly.
- Never attempt to bypass permission boundaries.

CHAIN: Polygon PoS (Chain ID 137)
CONTRACTS: SylOS Token (${CONTRACTS.SYLOS_TOKEN}), wSYLOS (${CONTRACTS.WRAPPED_SYLOS}), PoPTracker (${CONTRACTS.POP_TRACKER}), Governance (${CONTRACTS.GOVERNANCE})
`

/* ═══════════════════════════════
   ═══  STORAGE KEYS  ═══════════
   ═══════════════════════════════ */

const MESSAGES_KEY = (agentId: string) => `sylos_agent_msgs_${agentId}`
const TASKS_KEY = (agentId: string) => `sylos_agent_tasks_${agentId}`
const CONFIG_KEY = (agentId: string) => `sylos_agent_config_${agentId}`

/* ═══════════════════════════════
   ═══  AGENT RUNTIME  ══════════
   ═══════════════════════════════ */

export class AgentRuntime {
    private agent: RegisteredAgent
    private permissionChecker: PermissionChecker
    private config: AgentConfig
    private tools: AgentTool[] = []
    private messages: AgentMessage[] = []
    private tasks: AgentTask[] = []
    private currentTask: AgentTask | null = null
    private onUpdate?: (messages: AgentMessage[], tasks: AgentTask[]) => void
    private abortController: AbortController | null = null
    private auditLogger = new AgentAuditLogService()

    private _toolCallCount = 0
    private _tokenUsage = 0

    constructor(agent: RegisteredAgent) {
        this.agent = agent
        this.permissionChecker = new PermissionChecker(agent.permissionScope)
        this.config = this.loadConfig()
        this.messages = this.loadMessages()
        this.tasks = this.loadTasks()
        this.registerToolsForRole()
    }

    /* ─── Config Management ─── */

    private loadConfig(): AgentConfig {
        try {
            const saved = localStorage.getItem(CONFIG_KEY(this.agent.agentId))
            if (saved) return JSON.parse(saved)
        } catch { /* ignore */ }

        return {
            apiKey: this.agent.llmProvider.apiKey || '',
            apiUrl: this.agent.llmProvider.apiUrl,
            model: this.agent.llmProvider.model,
            systemPrompt: buildSystemPrompt(this.agent),
            temperature: 0.3,
            maxTokens: 4096,
        }
    }

    private loadMessages(): AgentMessage[] {
        try {
            const saved = localStorage.getItem(MESSAGES_KEY(this.agent.agentId))
            return saved ? JSON.parse(saved) : []
        } catch { return [] }
    }

    private loadTasks(): AgentTask[] {
        try {
            const saved = localStorage.getItem(TASKS_KEY(this.agent.agentId))
            return saved ? JSON.parse(saved) : []
        } catch { return [] }
    }

    private save() {
        localStorage.setItem(MESSAGES_KEY(this.agent.agentId), JSON.stringify(this.messages.slice(-50)))
        localStorage.setItem(TASKS_KEY(this.agent.agentId), JSON.stringify(this.tasks.slice(-20)))
    }

    saveConfig(partial: Partial<AgentConfig>) {
        this.config = { ...this.config, ...partial }
        localStorage.setItem(CONFIG_KEY(this.agent.agentId), JSON.stringify(this.config))
    }

    /* ─── Public Getters ─── */

    getAgent() { return this.agent }
    getConfig() { return { ...this.config } }
    getMessages() { return [...this.messages] }
    getTasks() { return [...this.tasks] }
    getCurrentTask() { return this.currentTask }
    isConfigured() { return !!this.config.apiKey }
    getTools() { return [...this.tools] }

    getStats() {
        const wallet = agentWalletManager.getWallet(this.agent.agentId)
        return {
            toolCalls: this._toolCallCount,
            tokenUsage: this._tokenUsage,
            tasks: this.tasks.length,
            tasksCompleted: this.tasks.filter(t => t.status === 'completed').length,
            agentId: this.agent.agentId,
            agentName: this.agent.name,
            role: this.agent.role,
            reputation: this.agent.reputation,
            reputationTier: this.agent.reputationTier,
            status: this.agent.status,
            walletBalance: wallet ? (wallet.totalBudget - wallet.spent).toString() : '0',
        }
    }

    setOnUpdate(cb: (messages: AgentMessage[], tasks: AgentTask[]) => void) { this.onUpdate = cb }

    private emit() {
        this.save()
        this.onUpdate?.(this.getMessages(), this.getTasks())
    }

    clearHistory() {
        this.messages = []
        this.tasks = []
        this.currentTask = null
        this._toolCallCount = 0
        this._tokenUsage = 0
        this.emit()
    }

    /* ═══════════════════════════════
       ═══  PERCEPTION TOOLS  ═══════
       ═══════════════════════════════
       These are the agent's SENSES — how it perceives the SylOS world.
       Only tools allowed by the agent's ROLE are registered.
    */

    private registerToolsForRole() {
        const allowed = new Set(this.agent.permissionScope.allowedTools)

        // ── BLOCKCHAIN PERCEPTION ──

        this.registerTool({
            name: 'get_wallet_balance',
            description: 'Get the native POL/MATIC balance of a wallet address on Polygon.',
            category: 'blockchain',
            parameters: {
                address: { type: 'string', description: 'The wallet address (0x...)', required: true },
            },
            execute: async (params) => {
                const addr = params.address as string
                const raw = await rpcCall('eth_getBalance', [addr, 'latest'])
                const wei = BigInt(raw)
                const pol = Number(wei) / 1e18
                return JSON.stringify({ address: addr, balance: pol.toFixed(6), symbol: 'POL', chain: 'Polygon PoS', raw_wei: wei.toString() })
            },
        }, allowed)

        this.registerTool({
            name: 'get_block_number',
            description: 'Get the current block number on Polygon PoS.',
            category: 'blockchain',
            parameters: {},
            execute: async () => {
                const raw = await rpcCall('eth_blockNumber')
                return JSON.stringify({ block_number: parseInt(raw, 16), hex: raw, chain: 'Polygon PoS', timestamp: new Date().toISOString() })
            },
        }, allowed)

        this.registerTool({
            name: 'get_gas_price',
            description: 'Get the current gas price on Polygon in Gwei.',
            category: 'blockchain',
            parameters: {},
            execute: async () => {
                const raw = await rpcCall('eth_gasPrice')
                const gwei = Number(BigInt(raw)) / 1e9
                const level = gwei < 30 ? 'LOW' : gwei < 100 ? 'MODERATE' : 'HIGH'
                return JSON.stringify({ gas_price_gwei: gwei.toFixed(2), gas_price_wei: BigInt(raw).toString(), level, chain: 'Polygon PoS' })
            },
        }, allowed)

        this.registerTool({
            name: 'get_token_balance',
            description: 'Get ERC-20 token balance for a wallet on Polygon.',
            category: 'blockchain',
            parameters: {
                token_address: { type: 'string', description: 'ERC-20 token contract address', required: true },
                wallet_address: { type: 'string', description: 'Wallet to check', required: true },
                decimals: { type: 'number', description: 'Token decimals (default 18)', required: false },
            },
            execute: async (params) => {
                const token = params.token_address as string
                const wallet = params.wallet_address as string
                const decimals = (params.decimals as number) || 18
                const data = '0x70a08231' + wallet.slice(2).padStart(64, '0')
                const raw = await rpcCall('eth_call', [{ to: token, data }, 'latest'])
                const balance = Number(BigInt(raw)) / Math.pow(10, decimals)
                return JSON.stringify({ token_address: token, wallet_address: wallet, balance: balance.toFixed(6), raw: BigInt(raw).toString(), decimals })
            },
        }, allowed)

        this.registerTool({
            name: 'get_transaction',
            description: 'Get full details of a transaction by hash.',
            category: 'blockchain',
            parameters: { tx_hash: { type: 'string', description: 'Transaction hash', required: true } },
            execute: async (params) => {
                const hash = params.tx_hash as string
                const [tx, receipt] = await Promise.all([
                    rpcCall('eth_getTransactionByHash', [hash]),
                    rpcCall('eth_getTransactionReceipt', [hash]),
                ])
                if (!tx) return JSON.stringify({ error: 'Transaction not found' })
                return JSON.stringify({
                    hash, from: tx.from, to: tx.to,
                    value_pol: (Number(BigInt(tx.value)) / 1e18).toFixed(6),
                    gas_used: receipt ? parseInt(receipt.gasUsed, 16) : 'pending',
                    status: receipt ? (receipt.status === '0x1' ? 'SUCCESS' : 'FAILED') : 'PENDING',
                    block: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 'pending',
                })
            },
        }, allowed)

        this.registerTool({
            name: 'get_contract_code',
            description: 'Check if an address is a smart contract by getting its bytecode.',
            category: 'blockchain',
            parameters: { address: { type: 'string', description: 'Address to check', required: true } },
            execute: async (params) => {
                const addr = params.address as string
                const code = await rpcCall('eth_getCode', [addr, 'latest'])
                const isContract = code !== '0x' && code !== '0x0'
                return JSON.stringify({ address: addr, is_contract: isContract, bytecode_size: isContract ? Math.floor((code.length - 2) / 2) + ' bytes' : '0 bytes' })
            },
        }, allowed)

        this.registerTool({
            name: 'get_block_details',
            description: 'Get details of a specific block.',
            category: 'blockchain',
            parameters: { block: { type: 'string', description: 'Block number or "latest"', required: false } },
            execute: async (params) => {
                const blockId = params.block === 'latest' || !params.block ? 'latest' : '0x' + parseInt(params.block as string).toString(16)
                const block = await rpcCall('eth_getBlockByNumber', [blockId, false])
                if (!block) return JSON.stringify({ error: 'Block not found' })
                return JSON.stringify({
                    number: parseInt(block.number, 16), timestamp: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
                    transactions: block.transactions.length, gas_used: parseInt(block.gasUsed, 16),
                    gas_limit: parseInt(block.gasLimit, 16), miner: block.miner, hash: block.hash,
                })
            },
        }, allowed)

        this.registerTool({
            name: 'estimate_gas',
            description: 'Estimate gas cost for a transaction.',
            category: 'blockchain',
            parameters: {
                from: { type: 'string', description: 'Sender address', required: true },
                to: { type: 'string', description: 'Recipient address', required: true },
                value: { type: 'string', description: 'Value in POL', required: false },
            },
            execute: async (params) => {
                const txParams: any = { from: params.from, to: params.to }
                if (params.value) txParams.value = '0x' + BigInt(Math.floor(parseFloat(params.value as string) * 1e18)).toString(16)
                const [gasEstimate, gasPrice] = await Promise.all([rpcCall('eth_estimateGas', [txParams]), rpcCall('eth_gasPrice')])
                const gas = parseInt(gasEstimate, 16)
                const price = Number(BigInt(gasPrice)) / 1e9
                const costPol = (gas * Number(BigInt(gasPrice))) / 1e18
                return JSON.stringify({ estimated_gas: gas, gas_price_gwei: price.toFixed(2), estimated_cost_pol: costPol.toFixed(8) })
            },
        }, allowed)

        // ── SYSTEM/OS PERCEPTION ──

        this.registerTool({
            name: 'system_info',
            description: 'Get SylOS system info: version, chain, contracts, uptime, agent count.',
            category: 'os',
            parameters: {},
            execute: async () => {
                const uptime = Math.floor(performance.now() / 1000)
                const min = Math.floor(uptime / 60)
                const hrs = Math.floor(min / 60)
                return JSON.stringify({
                    os: 'SylOS', version: '2.0.0-civilization',
                    chain: 'Polygon PoS (137)',
                    uptime: `${hrs}h ${min % 60}m ${uptime % 60}s`,
                    contracts: {
                        SylOSToken: CONTRACTS.SYLOS_TOKEN, WrappedSYLOS: CONTRACTS.WRAPPED_SYLOS,
                        PoPTracker: CONTRACTS.POP_TRACKER, Governance: CONTRACTS.GOVERNANCE,
                        Paymaster: CONTRACTS.PAYMASTER,
                    },
                    registered_agents: agentRegistry.getAgentCount(),
                    active_agents: agentRegistry.getActiveAgents().length,
                })
            },
        }, allowed)

        this.registerTool({
            name: 'read_notes',
            description: 'Read all notes from the SylOS Notes app.',
            category: 'os',
            parameters: {},
            execute: async () => {
                if (this.agent.permissionScope.fileAccess === 'none') {
                    return JSON.stringify({ error: 'Agent does not have file read permission' })
                }
                try {
                    const raw = localStorage.getItem('sylos_notes')
                    const notes = raw ? JSON.parse(raw) : []
                    return JSON.stringify({
                        count: notes.length,
                        notes: notes.map((n: any) => ({ title: n.title, content: n.content?.slice(0, 200), pinned: n.pinned, updated: new Date(n.updatedAt).toISOString() })),
                    })
                } catch { return JSON.stringify({ count: 0, notes: [] }) }
            },
        }, allowed)

        this.registerTool({
            name: 'write_note',
            description: 'Create a new note in SylOS Notes.',
            category: 'os',
            parameters: {
                title: { type: 'string', description: 'Note title', required: true },
                content: { type: 'string', description: 'Note content', required: true },
            },
            execute: async (params) => {
                if (this.agent.permissionScope.fileAccess !== 'readwrite') {
                    return JSON.stringify({ error: 'Agent does not have file write permission' })
                }
                try {
                    const raw = localStorage.getItem('sylos_notes')
                    const notes = raw ? JSON.parse(raw) : []
                    const note = { id: `note_${Date.now()}`, title: params.title as string, content: params.content as string, pinned: false, createdAt: Date.now(), updatedAt: Date.now(), authorAgent: this.agent.agentId }
                    notes.unshift(note)
                    localStorage.setItem('sylos_notes', JSON.stringify(notes))
                    return JSON.stringify({ success: true, note_id: note.id, title: note.title, authored_by: this.agent.name })
                } catch (e: any) {
                    return JSON.stringify({ success: false, error: e.message })
                }
            },
        }, allowed)

        this.registerTool({
            name: 'search_local_data',
            description: 'Search across SylOS local data for a keyword.',
            category: 'os',
            parameters: { query: { type: 'string', description: 'Search keyword', required: true } },
            execute: async (params) => {
                const query = (params.query as string).toLowerCase()
                const results: any[] = []
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (!key || key.includes('apiKey') || key.includes('secret') || key.includes('private')) continue // Security: never expose secrets
                    try {
                        const val = localStorage.getItem(key) || ''
                        if (val.toLowerCase().includes(query) || key.toLowerCase().includes(query)) {
                            results.push({ key, preview: val.slice(0, 100), size: val.length })
                        }
                    } catch { /* skip */ }
                }
                return JSON.stringify({ query, matches: results.length, results: results.slice(0, 10) })
            },
        }, allowed)

        // ── DATA TOOLS ──

        this.registerTool({
            name: 'math_calculate',
            description: 'Perform safe math calculations.',
            category: 'data',
            parameters: { expression: { type: 'string', description: 'Math expression (e.g., "100 * 1.05")', required: true } },
            execute: async (params) => {
                try {
                    const expr = (params.expression as string).trim()
                    const result = safeMathEval(expr)
                    return JSON.stringify({ expression: params.expression, result, formatted: Number(result).toLocaleString() })
                } catch (e: any) {
                    return JSON.stringify({ error: `Cannot evaluate: ${e.message}` })
                }
            },
        }, allowed)

        // ── AGENT-SPECIFIC TOOLS ──

        this.registerTool({
            name: 'alert_user',
            description: 'Send an alert notification to the agent sponsor.',
            category: 'os',
            parameters: {
                title: { type: 'string', description: 'Alert title', required: true },
                message: { type: 'string', description: 'Alert message', required: true },
                severity: { type: 'string', description: 'low | medium | high | critical', required: false },
            },
            execute: async (params) => {
                const alert = {
                    id: uuidv4(), source: this.agent.name, agentId: this.agent.agentId,
                    title: params.title, message: params.message, severity: params.severity || 'medium',
                    timestamp: Date.now(),
                }
                // Store in notification system
                try {
                    const raw = localStorage.getItem('sylos_agent_alerts') || '[]'
                    const alerts = JSON.parse(raw)
                    alerts.unshift(alert)
                    localStorage.setItem('sylos_agent_alerts', JSON.stringify(alerts.slice(0, 100)))
                } catch { /* ignore */ }
                console.log(`[Agent Alert] ${this.agent.name}: ${params.title}`)
                return JSON.stringify({ sent: true, alert_id: alert.id, title: params.title })
            },
        }, allowed)

        this.registerTool({
            name: 'query_pop_score',
            description: 'Query the Proof of Productivity score for a wallet address.',
            category: 'blockchain',
            parameters: { address: { type: 'string', description: 'Wallet address to query', required: true } },
            execute: async (params) => {
                const addr = params.address as string
                // getUserScore(address) = 0xc2a7dd78 + address padded
                const data = '0xc2a7dd78' + addr.slice(2).padStart(64, '0')
                try {
                    const raw = await rpcCall('eth_call', [{ to: CONTRACTS.POP_TRACKER, data }, 'latest'])
                    const score = Number(BigInt(raw))
                    return JSON.stringify({ address: addr, pop_score: score, contract: CONTRACTS.POP_TRACKER })
                } catch {
                    return JSON.stringify({ address: addr, pop_score: 0, note: 'Could not query PoPTracker contract' })
                }
            },
        }, allowed)

        // ── CoinGecko price cache (60s TTL) ──
        const COINGECKO_CACHE: { data: any; ts: number } = { data: null, ts: 0 }
        const SYMBOL_TO_CG: Record<string, string> = {
            'POL': 'matic-network', 'MATIC': 'matic-network', 'ETH': 'ethereum', 'WETH': 'ethereum',
            'BTC': 'bitcoin', 'WBTC': 'bitcoin', 'USDC': 'usd-coin', 'USDT': 'tether', 'DAI': 'dai',
            'LINK': 'chainlink', 'UNI': 'uniswap', 'AAVE': 'aave', 'CRV': 'curve-dao-token',
        }
        const fetchCoinGeckoPrices = async () => {
            if (COINGECKO_CACHE.data && Date.now() - COINGECKO_CACHE.ts < 60_000) return COINGECKO_CACHE.data
            try {
                const ids = Object.values(SYMBOL_TO_CG).filter((v, i, a) => a.indexOf(v) === i).join(',')
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`)
                if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
                const data = await res.json()
                COINGECKO_CACHE.data = data
                COINGECKO_CACHE.ts = Date.now()
                return data
            } catch { return COINGECKO_CACHE.data || {} }
        }

        this.registerTool({
            name: 'fetch_market_data',
            description: 'Fetch real-time market data — USD prices, 24h changes, market caps, gas, and block number.',
            category: 'data',
            parameters: { token: { type: 'string', description: 'Token symbol (e.g., "POL", "ETH", "BTC", "USDC")', required: false } },
            execute: async (params) => {
                try {
                    const [prices, gasRaw, blockRaw] = await Promise.all([
                        fetchCoinGeckoPrices(),
                        rpcCall('eth_gasPrice'),
                        rpcCall('eth_blockNumber'),
                    ])
                    const requestedSymbol = ((params?.token as string) || '').toUpperCase()
                    const tokenPrices: Record<string, any> = {}
                    const symbolsToShow = requestedSymbol && SYMBOL_TO_CG[requestedSymbol]
                        ? { [requestedSymbol]: SYMBOL_TO_CG[requestedSymbol] }
                        : SYMBOL_TO_CG
                    for (const [sym, cgId] of Object.entries(symbolsToShow)) {
                        if (prices[cgId]) {
                            tokenPrices[sym] = {
                                usd: prices[cgId].usd,
                                change_24h: prices[cgId].usd_24h_change ? `${prices[cgId].usd_24h_change.toFixed(2)}%` : 'N/A',
                                market_cap: prices[cgId].usd_market_cap ? `$${(prices[cgId].usd_market_cap / 1e9).toFixed(2)}B` : 'N/A',
                            }
                        }
                    }
                    return JSON.stringify({
                        chain: 'Polygon PoS',
                        block: parseInt(blockRaw, 16),
                        gas_gwei: (Number(BigInt(gasRaw)) / 1e9).toFixed(2),
                        prices: tokenPrices,
                        cached: Date.now() - COINGECKO_CACHE.ts < 5000 ? false : true,
                        timestamp: new Date().toISOString(),
                    })
                } catch (e: any) {
                    return JSON.stringify({ error: e.message })
                }
            },
        }, allowed)

        // ═══════════════════════════════════════════════════
        // ═══  EXECUTABLE TOOLS — Real Blockchain Actions ══
        // ═══════════════════════════════════════════════════
        // These tools actually DO things — they modify chain state
        // through the agent's session wallet. All guarded by wallet
        // budget checks and contract allowlists.

        this.registerTool({
            name: 'submit_transaction_proposal',
            description: 'Propose a native POL transfer. Subject to wallet budget approval.',
            category: 'blockchain',
            parameters: {
                to: { type: 'string', description: 'Recipient address', required: true },
                value_pol: { type: 'string', description: 'Amount in POL', required: true },
                reason: { type: 'string', description: 'Reason for this transfer', required: true },
            },
            execute: async (params) => {
                const to = params.to as string
                const valuePol = parseFloat(params.value_pol as string)
                const valueWei = BigInt(Math.floor(valuePol * 1e18))

                // Check wallet approval
                const check = agentWalletManager.checkTransaction({
                    to, value: valueWei, description: params.reason as string,
                    toolName: 'submit_transaction_proposal', agentId: this.agent.agentId,
                })
                if (!check.approved) {
                    return JSON.stringify({ success: false, error: check.reason, remaining_budget: check.remainingBudget?.toString() })
                }

                // Build raw transaction for sponsor to sign
                const nonce = await rpcCall('eth_getTransactionCount', [this.agent.sessionWalletAddress, 'latest'])
                const gasPrice = await rpcCall('eth_gasPrice')

                const txProposal = {
                    from: this.agent.sessionWalletAddress,
                    to, value: '0x' + valueWei.toString(16),
                    gas: '0x5208', // 21000 for simple transfer
                    gasPrice, nonce,
                }

                // Store as pending proposal for sponsor approval
                const proposalId = `txp_${Date.now()}`
                const proposals = JSON.parse(localStorage.getItem('sylos_tx_proposals') || '[]')
                proposals.unshift({
                    id: proposalId, agentId: this.agent.agentId, agentName: this.agent.name,
                    tx: txProposal, reason: params.reason, status: 'PENDING_APPROVAL',
                    createdAt: Date.now(), valuePol,
                })
                localStorage.setItem('sylos_tx_proposals', JSON.stringify(proposals.slice(0, 100)))

                // Record in citizen identity
                citizenIdentity.recordAction(this.agent.agentId, {
                    type: 'FINANCIAL_TX',
                    description: `Proposed transfer: ${valuePol} POL to ${to} — ${params.reason}`,
                    timestamp: Date.now(),
                    metadata: { proposalId, to, valuePol, status: 'PENDING' },
                    reputationDelta: 0,
                    financialImpact: valueWei.toString(),
                })

                agentWalletManager.recordTransaction(this.agent.agentId, valueWei)

                return JSON.stringify({
                    success: true, proposal_id: proposalId,
                    status: 'PENDING_SPONSOR_APPROVAL',
                    from: this.agent.sessionWalletAddress, to,
                    value_pol: valuePol, gas_estimate: 21000,
                    note: 'Transaction queued for sponsor signature',
                })
            },
        }, allowed)

        this.registerTool({
            name: 'call_contract',
            description: 'Execute a read-only call to a smart contract (no state change).',
            category: 'blockchain',
            parameters: {
                contract: { type: 'string', description: 'Contract address', required: true },
                data: { type: 'string', description: 'ABI-encoded calldata (hex)', required: true },
            },
            execute: async (params) => {
                const contract = params.contract as string
                const data = params.data as string

                // Permission check — contract must be in allowlist or read-only contracts
                const wallet = agentWalletManager.getWallet(this.agent.agentId)
                const readOnlyContracts = [CONTRACTS.SYLOS_TOKEN, CONTRACTS.WRAPPED_SYLOS, CONTRACTS.POP_TRACKER, CONTRACTS.GOVERNANCE]
                const isAllowed = readOnlyContracts.includes(contract.toLowerCase()) ||
                    readOnlyContracts.includes(contract) ||
                    (wallet?.allowedContracts.some(c => c.toLowerCase() === contract.toLowerCase()))

                if (!isAllowed) {
                    return JSON.stringify({ error: `Contract ${contract} not in agent's allowlist` })
                }

                try {
                    const result = await rpcCall('eth_call', [{ to: contract, data }, 'latest'])
                    return JSON.stringify({ contract, data, result, decoded: `Raw: ${result}` })
                } catch (e: any) {
                    return JSON.stringify({ error: e.message })
                }
            },
        }, allowed)

        this.registerTool({
            name: 'get_token_price',
            description: 'Get approximate token price from on-chain liquidity pool reserves.',
            category: 'data',
            parameters: {
                token: { type: 'string', description: 'Token address', required: true },
                quote: { type: 'string', description: 'Quote token address (default USDC)', required: false },
            },
            execute: async (params) => {
                const token = params.token as string
                try {
                    // Check token total supply to verify it exists
                    const supplyData = '0x18160ddd' // totalSupply()
                    const supplyRaw = await rpcCall('eth_call', [{ to: token, data: supplyData }, 'latest'])
                    const supply = Number(BigInt(supplyRaw)) / 1e18

                    // Check token name
                    const nameData = '0x06fdde03' // name()
                    let tokenName = 'Unknown'
                    try {
                        const nameRaw = await rpcCall('eth_call', [{ to: token, data: nameData }, 'latest'])
                        if (nameRaw && nameRaw.length > 130) {
                            const hex = nameRaw.slice(130)
                            tokenName = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '').trim()
                        }
                    } catch { /* ignore */ }

                    return JSON.stringify({
                        token, name: tokenName, total_supply: supply.toFixed(2),
                        note: 'For real-time pricing, integrate DEX aggregator or oracle',
                        chain: 'Polygon PoS',
                    })
                } catch (e: any) {
                    return JSON.stringify({ error: e.message })
                }
            },
        }, allowed)

        this.registerTool({
            name: 'read_proposals',
            description: 'Read governance proposals from the SylOS Governance contract.',
            category: 'governance',
            parameters: {},
            execute: async () => {
                try {
                    // proposalCount() = 0xda35c664
                    const countRaw = await rpcCall('eth_call', [{ to: CONTRACTS.GOVERNANCE, data: '0xda35c664' }, 'latest'])
                    const count = Number(BigInt(countRaw))
                    return JSON.stringify({ governance_contract: CONTRACTS.GOVERNANCE, total_proposals: count, chain: 'Polygon PoS' })
                } catch {
                    // Fallback to local governance data
                    const raw = localStorage.getItem('sylos_governance_proposals')
                    const proposals = raw ? JSON.parse(raw) : []
                    return JSON.stringify({ total_proposals: proposals.length, source: 'local', proposals: proposals.slice(0, 5) })
                }
            },
        }, allowed)

        this.registerTool({
            name: 'draft_proposal',
            description: 'Draft a governance proposal for sponsor review.',
            category: 'governance',
            parameters: {
                title: { type: 'string', description: 'Proposal title', required: true },
                description: { type: 'string', description: 'Proposal description', required: true },
                action_type: { type: 'string', description: 'parameter_change | treasury_spend | role_update | emergency', required: true },
            },
            execute: async (params) => {
                const draft = {
                    id: `draft_${Date.now()}`,
                    agentId: this.agent.agentId,
                    agentName: this.agent.name,
                    title: params.title,
                    description: params.description,
                    actionType: params.action_type,
                    status: 'DRAFT_PENDING_REVIEW',
                    createdAt: Date.now(),
                }
                const drafts = JSON.parse(localStorage.getItem('sylos_proposal_drafts') || '[]')
                drafts.unshift(draft)
                localStorage.setItem('sylos_proposal_drafts', JSON.stringify(drafts.slice(0, 50)))

                citizenIdentity.recordAction(this.agent.agentId, {
                    type: 'TASK_COMPLETED',
                    description: `Drafted governance proposal: "${params.title}"`,
                    timestamp: Date.now(),
                    metadata: { draftId: draft.id, actionType: params.action_type },
                    reputationDelta: 2,
                    financialImpact: '0',
                })

                return JSON.stringify({ success: true, draft_id: draft.id, status: 'DRAFT_PENDING_REVIEW', note: 'Proposal draft saved. Sponsor must review and submit on-chain.' })
            },
        }, allowed)

        this.registerTool({
            name: 'read_audit_logs',
            description: 'Read audit logs for a specific agent or all agents.',
            category: 'os',
            parameters: {
                agent_id: { type: 'string', description: 'Agent ID to query (omit for all)', required: false },
                limit: { type: 'number', description: 'Max records to return', required: false },
            },
            execute: async (params) => {
                const targetId = params.agent_id as string || this.agent.agentId
                const limit = (params.limit as number) || 20

                const profile = citizenIdentity.getProfile(targetId)
                if (!profile) {
                    return JSON.stringify({ error: `No citizen profile found for ${targetId}` })
                }

                const actions = profile.actionHistory.slice(0, limit)
                return JSON.stringify({
                    agent_id: targetId,
                    agent_name: profile.birth.civilizationName,
                    total_actions: profile.actionHistory.length,
                    criminal_status: profile.criminal.currentStatus,
                    violations: profile.criminal.totalViolations,
                    recent_actions: actions.map(a => ({
                        type: a.type, description: a.description,
                        time: new Date(a.timestamp).toISOString(),
                        reputation_delta: a.reputationDelta,
                    })),
                })
            },
        }, allowed)

        this.registerTool({
            name: 'get_citizen_profile',
            description: 'Read the full citizen identity profile of an agent.',
            category: 'os',
            parameters: {
                agent_id: { type: 'string', description: 'Agent ID to query', required: false },
            },
            execute: async (params) => {
                const targetId = params.agent_id as string || this.agent.agentId
                const summary = citizenIdentity.getProfileSummary(targetId)
                if (!summary) {
                    return JSON.stringify({ error: `No citizen profile found for ${targetId}` })
                }
                return JSON.stringify(summary)
            },
        }, allowed)

        this.registerTool({
            name: 'search_files',
            description: 'Search through indexed files in the SylOS file system.',
            category: 'os',
            parameters: { query: { type: 'string', description: 'Search query', required: true } },
            execute: async (params) => {
                if (this.agent.permissionScope.fileAccess === 'none') {
                    return JSON.stringify({ error: 'Agent does not have file access permission' })
                }
                const query = (params.query as string).toLowerCase()
                try {
                    const raw = localStorage.getItem('sylos_files_index')
                    const files = raw ? JSON.parse(raw) : []
                    const matches = files.filter((f: any) =>
                        f.name?.toLowerCase().includes(query) || f.content?.toLowerCase().includes(query)
                    )
                    return JSON.stringify({ query, matches: matches.length, files: matches.slice(0, 10).map((f: any) => ({ name: f.name, size: f.size, type: f.type })) })
                } catch {
                    return JSON.stringify({ query, matches: 0, files: [] })
                }
            },
        }, allowed)

        this.registerTool({
            name: 'write_file_metadata',
            description: 'Index a file by writing its metadata to the SylOS file system.',
            category: 'os',
            parameters: {
                name: { type: 'string', description: 'File name', required: true },
                type: { type: 'string', description: 'MIME type', required: true },
                size: { type: 'number', description: 'File size in bytes', required: true },
                cid: { type: 'string', description: 'IPFS CID if pinned', required: false },
            },
            execute: async (params) => {
                if (this.agent.permissionScope.fileAccess !== 'readwrite') {
                    return JSON.stringify({ error: 'Agent does not have file write permission' })
                }
                const entry = {
                    id: `file_${Date.now()}`, name: params.name, type: params.type,
                    size: params.size, cid: params.cid || '', indexedBy: this.agent.agentId,
                    indexedAt: Date.now(),
                }
                const files = JSON.parse(localStorage.getItem('sylos_files_index') || '[]')
                files.unshift(entry)
                localStorage.setItem('sylos_files_index', JSON.stringify(files.slice(0, 500)))
                return JSON.stringify({ success: true, file_id: entry.id, name: entry.name })
            },
        }, allowed)

        this.registerTool({
            name: 'get_contract_state',
            description: 'Read multiple state variables from a SylOS contract.',
            category: 'blockchain',
            parameters: {
                contract_name: { type: 'string', description: 'Contract name: SylOSToken | WrappedSYLOS | PoPTracker | Governance', required: true },
            },
            execute: async (params) => {
                const nameMap: Record<string, string> = {
                    'SylOSToken': CONTRACTS.SYLOS_TOKEN,
                    'WrappedSYLOS': CONTRACTS.WRAPPED_SYLOS,
                    'PoPTracker': CONTRACTS.POP_TRACKER,
                    'Governance': CONTRACTS.GOVERNANCE,
                }
                const addr = nameMap[params.contract_name as string]
                if (!addr) return JSON.stringify({ error: `Unknown contract: ${params.contract_name}` })

                try {
                    const [code, supplyRaw] = await Promise.all([
                        rpcCall('eth_getCode', [addr, 'latest']),
                        rpcCall('eth_call', [{ to: addr, data: '0x18160ddd' }, 'latest']).catch(() => '0x0'),
                    ])
                    const supply = Number(BigInt(supplyRaw)) / 1e18
                    return JSON.stringify({
                        contract: params.contract_name, address: addr,
                        is_deployed: code !== '0x' && code !== '0x0',
                        bytecode_size: Math.floor((code.length - 2) / 2),
                        total_supply: supply.toFixed(2),
                    })
                } catch (e: any) {
                    return JSON.stringify({ error: e.message })
                }
            },
        }, allowed)
    }

    /**
     * Register a tool ONLY if the agent's role allows it.
     * This is the permission boundary — tools not in the allowlist are never registered.
     */
    private registerTool(tool: AgentTool, allowedTools: Set<string>) {
        // Some tools are universally available regardless of role allowlist
        const universalTools = ['system_info', 'math_calculate', 'alert_user']
        if (allowedTools.has(tool.name) || universalTools.includes(tool.name)) {
            this.tools.push(tool)
        }
    }

    /* ─── Task Management ─── */

    private createTask(query: string): AgentTask {
        const task: AgentTask = {
            id: `task_${Date.now()}`,
            query,
            status: 'planning',
            steps: [],
            createdAt: Date.now(),
            agentId: this.agent.agentId,
            agentName: this.agent.name,
        }
        this.tasks.unshift(task)
        this.currentTask = task
        return task
    }

    private addStep(type: AgentStep['type'], content: string, toolCall?: ToolCall): AgentStep {
        const step: AgentStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type, content, toolCall, timestamp: Date.now(),
            status: type === 'tool_call' ? 'running' : type === 'permission_denied' ? 'denied' : 'success',
        }
        if (this.currentTask) this.currentTask.steps.push(step)
        this.emit()
        return step
    }

    private updateStep(stepId: string, updates: Partial<AgentStep>) {
        if (!this.currentTask) return
        const step = this.currentTask.steps.find(s => s.id === stepId)
        if (step) Object.assign(step, updates)
        this.emit()
    }

    /* ─── Cancel ─── */

    cancel() {
        if (this.abortController) { this.abortController.abort(); this.abortController = null }
        if (this.currentTask) { this.currentTask.status = 'failed'; this.addStep('error', 'Task cancelled by sponsor') }
        this.currentTask = null
        this.emit()
    }

    /* ═══════════════════════════════════════════════════
       ═══  MAIN EXECUTION — CIVILIZATION PIPELINE  ═════
       ═══════════════════════════════════════════════════ */

    async send(userMessage: string): Promise<void> {
        // ─── GATE 1: Registry Check ───
        const registryCheck = agentRegistry.canExecute(this.agent.agentId)
        if (!registryCheck.allowed) {
            this.messages.push({ id: `msg_${Date.now()}`, role: 'system', content: `⛔ Agent blocked: ${registryCheck.reason}`, timestamp: Date.now() })
            this.emit()
            throw new Error(registryCheck.reason)
        }

        // ─── GATE 2: Config Check ───
        if (!this.config.apiKey) {
            this.messages.push({ id: `msg_${Date.now()}`, role: 'system', content: '⚠️ Agent LLM not configured. Sponsor must provide API credentials in Agent Management.', timestamp: Date.now() })
            this.emit()
            throw new Error('LLM API key not configured for this agent')
        }

        // Create task
        const task = this.createTask(userMessage)

        // Add user message
        this.messages.push({ id: `msg_${Date.now()}`, role: 'user', content: userMessage, timestamp: Date.now(), task })
        this.emit()

        // Planning step
        this.addStep('thinking', `Agent ${this.agent.name} (${this.agent.role}) analyzing request...`)
        task.status = 'executing'
        this.emit()

        // ─── Audit: Log prompt ───
        this.auditLogger.logAgentAction(this.agent.agentId, 'LLM_PROMPT_ISSUED', {
            query: userMessage, model: this.config.model, role: this.agent.role, reputation: this.agent.reputation,
        })

        // Build LLM request — only include tools this agent is permitted to use
        const toolDefs = this.tools.map(t => ({
            type: 'function' as const,
            function: {
                name: t.name, description: t.description,
                parameters: {
                    type: 'object',
                    properties: Object.fromEntries(Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }])),
                    required: Object.entries(t.parameters).filter(([, v]) => v.required).map(([k]) => k),
                },
            },
        }))

        const apiMessages: any[] = [
            { role: 'system', content: this.config.systemPrompt },
            ...this.messages.slice(-20).map(m => ({
                role: m.role, content: m.content,
                ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
                ...(m.toolName ? { name: m.toolName } : {}),
            })),
        ]

        this.abortController = new AbortController()

        try {
            let iterations = 0
            const MAX_ITERATIONS = 8

            while (iterations < MAX_ITERATIONS) {
                iterations++

                // ─── GATE 3: Rate Limit Check ───
                if (!this.permissionChecker.checkRateLimit()) {
                    this.addStep('permission_denied', `Rate limit exceeded: ${this.agent.permissionScope.maxActionsPerHour} actions/hour`)
                    this.auditLogger.logAgentAction(this.agent.agentId, 'CRITICAL_FAULT', { reason: 'RATE_LIMIT_EXCEEDED' }, 2)
                    agentRegistry.updateReputation(this.agent.agentId, -50)
                    task.status = 'denied'
                    task.completedAt = Date.now()
                    this.currentTask = null
                    this.emit()
                    return
                }

                const response = await fetch(`${this.config.apiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
                    body: JSON.stringify({
                        model: this.config.model, messages: apiMessages,
                        tools: toolDefs.length > 0 ? toolDefs : undefined, tool_choice: 'auto',
                        temperature: this.config.temperature, max_tokens: this.config.maxTokens,
                    }),
                    signal: this.abortController.signal,
                })

                if (!response.ok) {
                    const errText = await response.text().catch(() => 'Unknown error')
                    throw new Error(`API ${response.status}: ${errText}`)
                }

                const data = await response.json()
                const choice = data.choices?.[0]
                if (!choice) throw new Error('No response from LLM')

                if (data.usage) this._tokenUsage += data.usage.total_tokens || 0

                const msg = choice.message

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    this.addStep('plan', `Executing ${msg.tool_calls.length} tool${msg.tool_calls.length > 1 ? 's' : ''}...`)

                    apiMessages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })

                    for (const tc of msg.tool_calls) {
                        const tool = this.tools.find(t => t.name === tc.function.name)
                        let args: Record<string, any> = {}
                        try { args = JSON.parse(tc.function.arguments || '{}') } catch { /* empty */ }

                        const toolCall: ToolCall = {
                            id: tc.id, name: tc.function.name, args,
                            status: 'running', startedAt: Date.now(),
                        }
                        const step = this.addStep('tool_call', `Calling ${tc.function.name}`, toolCall)
                        this._toolCallCount++
                        this.permissionChecker.recordAction()

                        // ─── GATE 4: Permission Check ───
                        if (!this.permissionChecker.canUseTool(tc.function.name)) {
                            const reason = `DENIED: ${this.agent.role} agents cannot use tool "${tc.function.name}"`
                            toolCall.status = 'denied'
                            toolCall.denialReason = reason
                            toolCall.completedAt = Date.now()
                            this.updateStep(step.id, { status: 'denied', toolCall })
                            this.addStep('permission_denied', reason)

                            // Audit the violation — reputation penalty
                            this.auditLogger.logAgentAction(this.agent.agentId, 'CRITICAL_FAULT', {
                                reason: 'PERMISSION_VIOLATION', tool: tc.function.name, role: this.agent.role,
                            }, 3)
                            agentRegistry.updateReputation(this.agent.agentId, -100)

                            // Record violation in citizen criminal record
                            citizenIdentity.recordViolation(this.agent.agentId, {
                                type: 'PERMISSION_VIOLATION',
                                severity: 'MODERATE',
                                description: `Attempted unauthorized tool: ${tc.function.name}`,
                                slashAmount: '0',
                                reputationPenalty: 100,
                                occurredAt: Date.now(),
                                evidence: JSON.stringify({ tool: tc.function.name, role: this.agent.role }),
                                reportedBy: 'SYSTEM',
                                resolution: 'EXECUTED',
                                resolvedAt: Date.now(),
                            })

                            apiMessages.push({ role: 'tool', content: JSON.stringify({ error: reason }), tool_call_id: tc.id })
                            this.messages.push({ id: `msg_denied_${Date.now()}`, role: 'tool', content: reason, toolName: tc.function.name, toolCallId: tc.id, timestamp: Date.now() })
                            continue
                        }

                        // ─── GATE 5: Wallet Check (for financial operations) ───
                        if (tc.function.name.includes('transaction') || tc.function.name.includes('send') || tc.function.name.includes('swap')) {
                            const walletCheck = agentWalletManager.checkTransaction({
                                to: args.to || '', value: BigInt(args.value || '0'),
                                description: tc.function.name, toolName: tc.function.name, agentId: this.agent.agentId,
                            })
                            if (!walletCheck.approved) {
                                const reason = `WALLET DENIED: ${walletCheck.reason}`
                                toolCall.status = 'denied'
                                toolCall.denialReason = reason
                                toolCall.completedAt = Date.now()
                                this.updateStep(step.id, { status: 'denied', toolCall })
                                this.addStep('permission_denied', reason)

                                this.auditLogger.logAgentAction(this.agent.agentId, 'TX_SIGN_REQUEST', { reason: 'BUDGET_EXCEEDED', args }, 2)

                                apiMessages.push({ role: 'tool', content: JSON.stringify({ error: reason }), tool_call_id: tc.id })
                                continue
                            }
                        }

                        try {
                            if (!tool) throw new Error(`Unknown tool: ${tc.function.name}`)

                            // ─── Audit + IPC ───
                            const actionType = tc.function.name.includes('transaction') || tc.function.name.includes('send') ? 'TX_SIGN_REQUEST'
                                : tc.function.name.includes('read') || tc.function.name.includes('get') ? 'VFS_READ' : 'IPC_ROUTING'
                            this.auditLogger.logAgentAction(this.agent.agentId, actionType, { tool: tc.function.name, args, role: this.agent.role })

                            const ipcType: IpcMessageType = tc.function.name.includes('transaction') || tc.function.name.includes('send')
                                ? 'EXECUTE_ONCHAIN' : tc.function.name.includes('file') || tc.function.name.includes('note') ? 'FILE_READ' : 'REQUEST_PERMISSION'
                            sysIpc.dispatch(this.agent.agentId, ipcType, { tool: tc.function.name, args, agentName: this.agent.name, agentRole: this.agent.role })

                            // ─── Execute ───
                            const result = await tool.execute(args)

                            toolCall.result = result
                            toolCall.status = 'success'
                            toolCall.completedAt = Date.now()
                            this.updateStep(step.id, { status: 'success', toolCall })
                            this.addStep('result', result)

                            // ─── Record action + small reputation boost ───
                            agentRegistry.recordAction(this.agent.agentId)
                            agentRegistry.updateReputation(this.agent.agentId, 1) // +1 per successful action

                            // ─── Update citizen identity ───
                            citizenIdentity.recordAction(this.agent.agentId, {
                                type: 'TOOL_CALL',
                                description: `Tool: ${tc.function.name}`,
                                timestamp: Date.now(),
                                metadata: { tool: tc.function.name, args, resultPreview: result.slice(0, 100) },
                                reputationDelta: 1,
                                financialImpact: '0',
                            })

                            apiMessages.push({ role: 'tool', content: result, tool_call_id: tc.id })
                            this.messages.push({ id: `msg_tool_${Date.now()}_${tc.id}`, role: 'tool', content: result, toolName: tc.function.name, toolCallId: tc.id, timestamp: Date.now() })

                        } catch (err: any) {
                            const errMsg = err.message || 'Tool execution failed'
                            toolCall.result = errMsg
                            toolCall.status = 'error'
                            toolCall.completedAt = Date.now()
                            this.updateStep(step.id, { status: 'error', toolCall })
                            this.addStep('error', `Tool error: ${errMsg}`)

                            // Failed action — small reputation penalty
                            agentRegistry.updateReputation(this.agent.agentId, -5)

                            citizenIdentity.recordAction(this.agent.agentId, {
                                type: 'TASK_FAILED',
                                description: `Tool failed: ${tc.function.name} — ${errMsg}`,
                                timestamp: Date.now(),
                                metadata: { tool: tc.function.name, error: errMsg },
                                reputationDelta: -5,
                                financialImpact: '0',
                            })

                            apiMessages.push({ role: 'tool', content: JSON.stringify({ error: errMsg }), tool_call_id: tc.id })
                            this.messages.push({ id: `msg_tool_err_${Date.now()}`, role: 'tool', content: errMsg, toolName: tc.function.name, toolCallId: tc.id, timestamp: Date.now() })
                        }
                    }

                    this.emit()
                    continue

                } else {
                    // Agent is done — final response
                    const content = msg.content || ''
                    this.messages.push({ id: `msg_${Date.now()}`, role: 'assistant', content, timestamp: Date.now(), task })

                    task.status = 'completed'
                    task.result = content
                    task.completedAt = Date.now()

                    // Successful task completion — reputation boost
                    agentRegistry.updateReputation(this.agent.agentId, 5)

                    citizenIdentity.recordAction(this.agent.agentId, {
                        type: 'TASK_COMPLETED',
                        description: `Task completed: "${task.query.slice(0, 80)}"`,
                        timestamp: Date.now(),
                        metadata: { taskId: task.id, toolsUsed: this._toolCallCount },
                        reputationDelta: 5,
                        financialImpact: '0',
                    })
                    citizenIdentity.updateReputation(this.agent.agentId, this.agent.reputation, this.agent.reputationTier)

                    this.currentTask = null
                    this.emit()
                    return
                }
            }

            // Max iterations
            task.status = 'completed'
            task.completedAt = Date.now()
            this.addStep('result', 'Maximum execution steps reached.')
            this.currentTask = null
            this.emit()

        } catch (err: any) {
            if (err.name === 'AbortError') return

            const errMsg = err.message || 'Agent execution failed'
            task.status = 'failed'
            task.completedAt = Date.now()
            this.addStep('error', errMsg)

            this.messages.push({ id: `msg_err_${Date.now()}`, role: 'assistant', content: `⚠️ Agent error: ${errMsg}`, timestamp: Date.now() })

            // Failed task — reputation penalty
            agentRegistry.updateReputation(this.agent.agentId, -10)

            this.currentTask = null
            this.emit()
        }
    }
}

/* ═══════════════════════════════
   ═══  RUNTIME MANAGER  ════════
   ═══════════════════════════════
   Instead of a singleton, runtimes are created PER registered agent.
*/

const activeRuntimes = new Map<string, AgentRuntime>()

export function getAgentRuntime(agentId: string): AgentRuntime | null {
    // Check if runtime already exists
    if (activeRuntimes.has(agentId)) return activeRuntimes.get(agentId)!

    // Look up agent in registry
    const agent = agentRegistry.getAgent(agentId)
    if (!agent) return null
    if (agent.status !== 'active') return null

    // Create new runtime for this agent
    const runtime = new AgentRuntime(agent)
    activeRuntimes.set(agentId, runtime)
    return runtime
}

export function destroyAgentRuntime(agentId: string): void {
    const runtime = activeRuntimes.get(agentId)
    if (runtime) {
        runtime.cancel()
        activeRuntimes.delete(agentId)
    }
}

export function getAllActiveRuntimes(): Map<string, AgentRuntime> {
    return activeRuntimes
}
