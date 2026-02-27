/**
 * SylOS Agent Civilization Dashboard v2.0
 *
 * NOT a chatbot. This is the control center for the digital civilization:
 * - Spawn agents (immigration)
 * - Monitor running agents (real-time status)
 * - View agent actions, reputation, and tool calls
 * - Interact with individual agents
 * - Pause/resume/revoke agents
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Send, Trash2, Wrench, Loader2, Square,
    Plus, X, Users
} from 'lucide-react'
import { agentRegistry, type RegisteredAgent, type SpawnAgentConfig, type LLMProvider } from '@/services/agent/AgentRegistry'
import { agentWalletManager } from '@/services/agent/AgentSessionWallet'
import { getAgentRuntime, destroyAgentRuntime, type AgentRuntime, type AgentStep, type AgentTask, type AgentMessage } from '@/services/agent/AgentRuntime'
import { autonomyEngine } from '@/services/agent/AgentAutonomyEngine'
import { ROLE_META, type AgentRole, getReputationColor, getReputationTier } from '@/services/agent/AgentRoles'
import { useAgentRegistry } from '@/hooks/useAgentContracts'
import { useAccount } from 'wagmi'

// Singleton autonomy engine is imported

/* ═══════════════════════════════
   ═══  LLM PRESETS  ════════════
   ═══════════════════════════════ */

const LLM_PRESETS: LLMProvider[] = [
    { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { name: 'Groq', apiUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    { name: 'OpenRouter', apiUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
    { name: 'Ollama', apiUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
]

const ALL_ROLES: AgentRole[] = ['TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR']

/* ═══════════════════════════════
   ═══  STYLES  ═════════════════
   ═══════════════════════════════ */

const S: Record<string, React.CSSProperties> = {
    root: { height: '100%', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0', background: '#0a0e1a', overflow: 'hidden' },
    sidebar: { width: '260px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' },
    chat: { flex: 1, overflowY: 'auto' as any, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    inputBar: { padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' },
}

/* ═══════════════════════════════
   ═══  MINI COMPONENTS  ════════
   ═══════════════════════════════ */

function Badge({ text, color }: { text: string; color: string }) {
    return <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '100px', background: `${color}15`, color, fontWeight: 600, textTransform: 'uppercase' as any }}>{text}</span>
}

function RepBar({ score }: { score: number }) {
    const pct = Math.min(100, score / 100)
    const tier = getReputationTier(score)
    const color = getReputationColor(tier)
    return (
        <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: color, transition: 'width 0.3s ease' }} />
        </div>
    )
}

function StepView({ step }: { step: AgentStep }) {
    const [expanded, setExpanded] = useState(false)
    const icons: Record<string, any> = { thinking: '🧠', plan: '📋', tool_call: '🔧', result: '📊', error: '❌', permission_denied: '🚫', reputation_update: '⭐' }
    const bgColors: Record<string, string> = { success: 'rgba(34,197,94,0.05)', error: 'rgba(239,68,68,0.05)', denied: 'rgba(239,68,68,0.08)', running: 'rgba(99,102,241,0.05)' }

    return (
        <div style={{ padding: '8px 10px', borderRadius: '8px', background: bgColors[step.status] || 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: step.toolCall ? 'pointer' : 'default' }} onClick={() => step.toolCall && setExpanded(!expanded)}>
                <span>{icons[step.type] || '•'}</span>
                <div style={{ flex: 1, color: step.status === 'denied' ? '#f87171' : 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    {step.type === 'tool_call' && step.toolCall ? (
                        <span><code style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>{step.toolCall.name}</code> {step.toolCall.status === 'denied' ? `— ${step.toolCall.denialReason}` : ''}</span>
                    ) : (
                        step.content.slice(0, 200)
                    )}
                </div>
                {step.toolCall && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>{expanded ? '▼' : '▶'}</span>}
            </div>
            {expanded && step.toolCall?.result && (
                <pre style={{ marginTop: '6px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', overflow: 'auto', maxHeight: '150px', whiteSpace: 'pre-wrap' as any, wordBreak: 'break-all' as any }}>
                    {(() => { try { return JSON.stringify(JSON.parse(step.toolCall.result), null, 2) } catch { return step.toolCall.result } })()}
                </pre>
            )}
        </div>
    )
}

/* ═══════════════════════════════
   ═══  SPAWN DIALOG  ═══════════
   ═══════════════════════════════ */

function SpawnDialog({ onSpawn, onClose, sponsorAddress }: {
    onSpawn: (cfg: SpawnAgentConfig) => void;
    onClose: () => void;
    sponsorAddress: string;
}) {
    const [name, setName] = useState('')
    const [role, setRole] = useState<AgentRole>('TRADER')
    const [provider, setProvider] = useState<LLMProvider>(LLM_PRESETS[0] as LLMProvider)
    const [apiKey, setApiKey] = useState('')
    const [expiryDays, setExpiryDays] = useState(7)
    const [error, setError] = useState('')
    const [tab, setTab] = useState<'spawn' | 'import'>('spawn')
    const [callbackUrl, setCallbackUrl] = useState('')
    const [importedKey, setImportedKey] = useState<{ id: string, key: string } | null>(null)

    const handleSpawn = () => {
        if (!name.trim()) { setError('Name is required'); return }

        if (tab === 'spawn') {
            if (!apiKey.trim()) { setError('API key is required — this powers the agent\'s LLM brain'); return }
            setError('')
            onSpawn({
                name: name.trim(),
                role,
                sponsorAddress,
                llmProvider: { ...provider, apiKey },
                expiryDays,
                description: `${ROLE_META[role].label} spawned by ${sponsorAddress.slice(0, 8)}...`,
            })
        } else {
            // Import path
            if (!callbackUrl.trim() || !callbackUrl.startsWith('http')) {
                setError('Valid webhook/callback URL is required for imported agents')
                return
            }
            setError('')

            // Generate deterministic keys for the demo
            const importId = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            const importKey = `syl_live_${Math.random().toString(36).slice(2, 18)}`

            // Still register in the registry so it appears in the UI
            onSpawn({
                name: name.trim(),
                role,
                sponsorAddress,
                llmProvider: { name: 'External', apiUrl: callbackUrl, model: 'external' }, // Placeholder for external
                expiryDays,
                description: `Imported ${ROLE_META[role].label} agent via Gateway`,
            })
            // Important: we don't close the dialog yet so they can copy the credentials
            setImportedKey({ id: importId, key: importKey })
        }
    }

    const meta = ROLE_META[role]

    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Spawn New Agent" onKeyDown={e => { if (e.key === 'Escape') onClose() }} onClick={e => e.stopPropagation()} style={{ width: '440px', maxHeight: '90%', overflowY: 'auto', background: '#141829', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Create Citizen</h2>
                    <button onClick={onClose} aria-label="Close dialog" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Tabs */}
                {!importedKey && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <button onClick={() => setTab('spawn')} style={{
                            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: tab === 'spawn' ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === 'spawn' ? '#fff' : 'rgba(255,255,255,0.5)',
                        }}>🌐 Spawn Native</button>
                        <button onClick={() => setTab('import')} style={{
                            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: tab === 'import' ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === 'import' ? '#fff' : 'rgba(255,255,255,0.5)',
                        }}>🛬 Import External</button>
                    </div>
                )}

                {!importedKey ? (
                    <>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', lineHeight: 1.5 }}>
                            {tab === 'spawn'
                                ? "Spawn a licensed worker. It runs natively in SylOS, bound by its role, budget, and permissions. You are its sponsor."
                                : "Bring an existing agent (MoltBot, OpenClaw, etc.) into SylOS via the Agent Gateway API. It receives a visa and operates under SylOS law."}
                        </div>

                        {/* Name */}
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>AGENT NAME</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder={tab === 'spawn' ? "e.g. MyTrader, ResearchBot" : "e.g. MoltBot_Trading"} maxLength={64}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />

                        {/* Role */}
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>ROLE (Profession)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '14px' }}>
                            {ALL_ROLES.map(r => {
                                const m = ROLE_META[r]
                                return (
                                    <button key={r} onClick={() => setRole(r)} style={{
                                        padding: '8px 10px', borderRadius: '8px', border: `1px solid ${role === r ? m.color + '40' : 'rgba(255,255,255,0.06)'}`,
                                        background: role === r ? m.color + '12' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                    }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: role === r ? m.color : 'rgba(255,255,255,0.5)' }}>{m.icon} {m.label}</div>
                                    </button>
                                )
                            })}
                        </div>
                        <div style={{ fontSize: '11px', color: meta.color, marginBottom: '14px', padding: '8px 10px', borderRadius: '6px', background: meta.color + '08', border: `1px solid ${meta.color}20` }}>
                            {meta.description}
                        </div>

                        {/* Mode-Specific Fields */}
                        {tab === 'spawn' ? (
                            <>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>LLM BRAIN</label>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                    {LLM_PRESETS.map(p => (
                                        <button key={p.name} onClick={() => setProvider(p)} style={{
                                            padding: '5px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                            background: provider.name === p.name ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', color: provider.name === p.name ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                                        }}>{p.name}</button>
                                    ))}
                                </div>
                                {provider.name === 'OpenRouter' && (
                                    <input
                                        value={provider.model}
                                        onChange={e => setProvider({ ...provider, model: e.target.value })}
                                        placeholder="Model ID (e.g. anthropic/claude-3.5-sonnet)"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px', boxSizing: 'border-box', outline: 'none' }}
                                    />
                                )}
                                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={`${provider.name} API Key`} type="password"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", marginBottom: '14px', boxSizing: 'border-box', outline: 'none' }} />
                            </>
                        ) : (
                            <>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', display: 'block', marginBottom: '6px' }}>GATEWAY CALLBACK URL</label>
                                <input value={callbackUrl} onChange={e => setCallbackUrl(e.target.value)} placeholder="https://your-agent.com/webhook"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", marginBottom: '14px', boxSizing: 'border-box', outline: 'none' }} />
                            </>
                        )}

                        {/* Expiry */}
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>VISA DURATION</label>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                            {[7, 30, 90, 365].map(d => (
                                <button key={d} onClick={() => setExpiryDays(d)} style={{
                                    padding: '5px 10px', borderRadius: '6px', border: `1px solid ${expiryDays === d ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    background: expiryDays === d ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', color: expiryDays === d ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                }}>{d}d</button>
                            ))}
                        </div>

                        {error && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px', padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)' }}>{error}</div>}

                        <button onClick={handleSpawn} style={{
                            width: '100%', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: tab === 'spawn' ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                        }}>
                            {tab === 'spawn' ? '🌐 Spawn Native Agent' : '🛬 Generate Import Visa'}
                        </button>
                    </>
                ) : (
                    // Success View for Imported Agents
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                            <h3 style={{ margin: '0 0 12px 0', color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Visa Granted 🛂
                            </h3>
                            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                                Your external agent is now registered in the SylOS Civilization. Use these credentials to connect via the Agent Gateway.
                            </p>

                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>x-agent-id header</label>
                            <code style={{ display: 'block', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff', marginBottom: '12px' }}>
                                {importedKey.id}
                            </code>

                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>authorization: Bearer header (COPY NOW)</label>
                            <code style={{ display: 'block', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#f59e0b', marginBottom: '16px' }}>
                                {importedKey.key}
                            </code>

                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>GATEWAY ENDPOINT</label>
                            <code style={{ display: 'block', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#a5b4fc', marginBottom: '0' }}>
                                POST https://rinzqwqzrtxfgizgpkmn.supabase.co/functions/v1/agent-gateway
                            </code>
                        </div>
                        <button onClick={onClose} style={{
                            width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                            background: 'transparent', color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
                        }}>
                            Done, I've copied the key
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════
   ═══  AGENT SIDEBAR CARD  ═════
   ═══════════════════════════════ */

function AgentCard({ agent, selected, onClick, onPause, onResume, onRevoke }: {
    agent: RegisteredAgent; selected: boolean; onClick: () => void;
    onPause: () => void; onResume: () => void; onRevoke: () => void;
}) {
    const meta = ROLE_META[agent.role]
    const tierColor = getReputationColor(agent.reputationTier)
    const statusColors: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', revoked: '#ef4444', expired: '#6b7280' }

    return (
        <div role="option" aria-selected={selected} aria-label={`${agent.name} - ${meta.label} - ${agent.status}`} onClick={onClick} style={{
            padding: '10px 12px', cursor: 'pointer', borderLeft: `3px solid ${selected ? meta.color : 'transparent'}`,
            background: selected ? `${meta.color}10` : 'transparent', transition: 'all 0.15s ease',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: selected ? '#fff' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{meta.icon}</span>{agent.name}
                </div>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColors[agent.status] || '#6b7280' }} title={agent.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: meta.color, fontWeight: 600, textTransform: 'uppercase' }}>{meta.label}</span>
                <span style={{ fontSize: '9px', color: tierColor, fontWeight: 600 }}>{agent.reputationTier} ({agent.reputation})</span>
            </div>
            <RepBar score={agent.reputation} />
            {selected && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {agent.status === 'active' && <button onClick={e => { e.stopPropagation(); onPause() }} aria-label={`Pause ${agent.name}`} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>⏸ Pause</button>}
                    {agent.status === 'paused' && <button onClick={e => { e.stopPropagation(); onResume() }} aria-label={`Resume ${agent.name}`} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>▶ Resume</button>}
                    {agent.status !== 'revoked' && <button onClick={e => { e.stopPropagation(); if (confirm('Revoke this agent? This is permanent and will slash its stake.')) onRevoke() }} aria-label={`Revoke ${agent.name}`} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>☠ Revoke</button>}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════
   ═══  MAIN DASHBOARD  ═════════
   ═══════════════════════════════ */

export default function AgentDashboardApp() {
    const { address } = useAccount()
    const { myAgents, pauseAgent: hookPause, resumeAgent: hookResume, revokeAgent: hookRevoke } = useAgentRegistry()
    const [agents, setAgents] = useState<RegisteredAgent[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
    const [showSpawn, setShowSpawn] = useState(false)
    const [showTools, setShowTools] = useState(false)

    const [messages, setMessages] = useState<AgentMessage[]>([])
    const [tasks, setTasks] = useState<AgentTask[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [isAutonomous, setIsAutonomous] = useState(false)
    const runtimeRef = useRef<AgentRuntime | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const sponsorAddr = address || '0xUnconnected'

    // Reload agent list — uses localStorage for the LLM runtime data,
    // but lifecycle operations go through the hook (on-chain when deployed)
    const refreshAgents = useCallback(() => {
        const all = address ? agentRegistry.getAgentsBySponsor(address) : agentRegistry.getAllAgents()
        setAgents(all)
    }, [address])

    useEffect(() => { refreshAgents() }, [refreshAgents])

    // When selected agent changes, wire up runtime
    useEffect(() => {
        if (!selectedAgentId) {
            runtimeRef.current = null
            setMessages([])
            setTasks([])
            setIsAutonomous(false)
            return
        }
        const rt = getAgentRuntime(selectedAgentId)
        if (rt) {
            runtimeRef.current = rt
            setMessages(rt.getMessages())
            setTasks(rt.getTasks())
            setIsAutonomous(autonomyEngine.isAgentActive(selectedAgentId))
            rt.setOnUpdate((msgs, tsks) => { setMessages(msgs); setTasks(tsks) })
        }
        return () => { rt?.setOnUpdate(() => { }) }
    }, [selectedAgentId])

    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, tasks])

    const handleSpawn = useCallback((config: SpawnAgentConfig) => {
        try {
            const agent = agentRegistry.spawnAgent(config)
            agentWalletManager.createWallet(agent)
            refreshAgents()
            setSelectedAgentId(agent.agentId)
            setShowSpawn(false)
        } catch (e: any) {
            alert(e.message)
        }
    }, [refreshAgents])

    const handleSend = useCallback(async () => {
        if (!input.trim() || sending || !runtimeRef.current) return
        const msg = input.trim()
        setInput('')
        setSending(true)
        try { await runtimeRef.current.send(msg) }
        catch (e: any) { console.error('[Agent]', e) }
        finally { setSending(false); refreshAgents() }
    }, [input, sending, refreshAgents])

    const handlePause = (id: string) => {
        try {
            agentRegistry.pauseAgent(id, sponsorAddr)
            hookPause(id) // Also call on-chain when deployed
            agentWalletManager.deactivateWallet(id)
            destroyAgentRuntime(id)
            refreshAgents()
        } catch (e: any) { alert(e.message) }
    }
    const handleResume = (id: string) => {
        try {
            agentRegistry.resumeAgent(id, sponsorAddr)
            hookResume(id) // Also call on-chain when deployed
            agentWalletManager.activateWallet(id)
            refreshAgents()
        } catch (e: any) { alert(e.message) }
    }
    const handleRevoke = (id: string) => {
        try {
            agentRegistry.revokeAgent(id, sponsorAddr)
            hookRevoke(id) // Also call on-chain when deployed
            agentWalletManager.deactivateWallet(id)
            destroyAgentRuntime(id)
            refreshAgents()
            if (selectedAgentId === id) setSelectedAgentId(null)
        } catch (e: any) { alert(e.message) }
    }

    const selectedAgent = agents.find(a => a.agentId === selectedAgentId)
    const selectedMeta = selectedAgent ? ROLE_META[selectedAgent.role] : null
    const stats = runtimeRef.current?.getStats()
    const tools = runtimeRef.current?.getTools() || []

    // Build display items from tasks
    const displayItems: Array<{ type: 'message' | 'task'; message?: AgentMessage; task?: AgentTask }> = []
    const shownTasks = new Set<string>()
    messages.forEach(m => {
        if (m.role === 'tool') return
        if (m.task && !shownTasks.has(m.task.id)) {
            shownTasks.add(m.task.id)
            if (m.role === 'user') {
                displayItems.push({ type: 'message', message: m })
                displayItems.push({ type: 'task', task: m.task })
            } else {
                displayItems.push({ type: 'message', message: m })
            }
        } else {
            displayItems.push({ type: 'message', message: m })
        }
    })

    return (
        <div style={S['root']}>
            {showSpawn && <SpawnDialog onSpawn={handleSpawn} onClose={() => setShowSpawn(false)} sponsorAddress={sponsorAddr} />}

            {/* ── Sidebar: Agent Registry ── */}
            <div style={S['sidebar']}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Registry</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>{agents.length}</span>
                    </div>
                    <button onClick={() => setShowSpawn(true)} style={{
                        width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed rgba(99,102,241,0.3)',
                        background: 'rgba(99,102,241,0.05)', color: '#818cf8', fontSize: '11px', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                        <Plus size={12} /> Spawn Agent
                    </button>
                </div>

                <div role="listbox" aria-label="Agent list" style={{ flex: 1, overflowY: 'auto' }}>
                    {agents.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>
                            No agents yet.<br />Spawn your first licensed worker.
                        </div>
                    )}
                    {agents.map(a => (
                        <AgentCard
                            key={a.agentId} agent={a}
                            selected={selectedAgentId === a.agentId}
                            onClick={() => setSelectedAgentId(a.agentId)}
                            onPause={() => handlePause(a.agentId)}
                            onResume={() => handleResume(a.agentId)}
                            onRevoke={() => handleRevoke(a.agentId)}
                        />
                    ))}
                </div>

                {/* Civilization Stats */}
                <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active</span><span style={{ color: '#22c55e' }}>{agents.filter(a => a.status === 'active').length}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paused</span><span style={{ color: '#f59e0b' }}>{agents.filter(a => a.status === 'paused').length}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Revoked</span><span style={{ color: '#ef4444' }}>{agents.filter(a => a.status === 'revoked').length}</span></div>
                </div>
            </div>

            {/* ── Main Panel ── */}
            <div style={S['main']}>
                {!selectedAgent ? (
                    /* No agent selected — welcome screen */
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '40px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.15)' }}>
                            <Users size={32} color="#818cf8" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Agent Civilization</h2>
                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: '450px', lineHeight: 1.6 }}>
                                SylOS is a regulated digital civilization. Spawn licensed AI agents that work within defined roles, budgets, and permissions. Every action is audited. Reputation determines trust.
                            </p>
                        </div>
                        <button onClick={() => setShowSpawn(true)} style={{
                            padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                        }}>
                            🌐 Spawn Your First Agent
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={S['header']}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `linear-gradient(135deg, ${selectedMeta!.color}40, ${selectedMeta!.color}20)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                    {selectedMeta!.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {selectedAgent.name} <Badge text={selectedAgent.status} color={selectedAgent.status === 'active' ? '#22c55e' : selectedAgent.status === 'paused' ? '#f59e0b' : '#ef4444'} />
                                        <Badge text={selectedAgent.reputationTier} color={getReputationColor(selectedAgent.reputationTier)} />
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                                        {selectedMeta!.label} · {stats?.toolCalls || 0} tool calls · Rep {selectedAgent.reputation}/10000
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => setShowTools(!showTools)} title="Tools" style={{ background: showTools ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: showTools ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}><Wrench size={14} /></button>
                                <button onClick={() => { runtimeRef.current?.clearHistory(); setMessages([]); setTasks([]) }} title="Clear" style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><Trash2 size={14} /></button>
                                {sending && <button onClick={() => runtimeRef.current?.cancel()} title="Cancel" style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444' }}><Square size={14} /></button>}
                            </div>
                        </div>

                        {/* Tools Panel */}
                        {showTools && (
                            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)', maxHeight: '160px', overflowY: 'auto' }}>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '6px' }}>{tools.length} Permitted Tools ({selectedMeta!.label})</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                                    {tools.map(t => (
                                        <div key={t.name} style={{ padding: '4px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ fontSize: '9px', fontWeight: 600, color: t.category === 'blockchain' ? '#f59e0b' : t.category === 'os' ? '#22c55e' : '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>{t.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Autonomy Banner */}
                        {selectedAgent.status === 'active' && (
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: isAutonomous ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isAutonomous ? '#8b5cf6' : 'rgba(255,255,255,0.2)', boxShadow: isAutonomous ? '0 0 10px #8b5cf6' : 'none' }} />
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: isAutonomous ? '#a78bfa' : '#e2e8f0' }}>Autonomous Mode {isAutonomous ? 'Active' : 'Off'}</div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                            {isAutonomous ? 'Agent is running background loops and executing tasks independently.' : 'Agent is waiting for manual tasks.'}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => {
                                    if (isAutonomous) {
                                        autonomyEngine.deactivateAgent(selectedAgent.agentId)
                                        setIsAutonomous(false)
                                    } else {
                                        autonomyEngine.activateAgent(selectedAgent.agentId)
                                        setIsAutonomous(true)
                                    }
                                }} style={{
                                    padding: '6px 12px', borderRadius: '6px', border: `1px solid ${isAutonomous ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                    background: isAutonomous ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)', color: isAutonomous ? '#c4b5fd' : '#e2e8f0',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                }}>
                                    {isAutonomous ? 'Deactivate Autonomy' : 'Enable Autonomy'}
                                </button>
                            </div>
                        )}

                        {/* Main Content */}
                        <div ref={scrollRef} style={S['chat']}>
                            {displayItems.length === 0 && !sending && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', height: '100%', padding: '20px' }}>
                                    <span style={{ fontSize: '32px' }}>{selectedMeta!.icon}</span>
                                    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Give {selectedAgent.name} a task</div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
                                            This agent is a <strong style={{ color: selectedMeta!.color }}>{selectedMeta!.label}</strong>. It can only use tools permitted by its role. Every action is audited and affects its reputation.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayItems.map((item, i) => {
                                if (item.type === 'task' && item.task) {
                                    return (
                                        <div key={`task_${item.task.id}`} style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.08)' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                                Task: {item.task.status} · {item.task.agentName}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {item.task.steps.map(s => <StepView key={s.id} step={s} />)}
                                            </div>
                                        </div>
                                    )
                                }
                                if (item.type === 'message' && item.message) {
                                    const m = item.message
                                    const isUser = m.role === 'user'
                                    const isSystem = m.role === 'system'
                                    return (
                                        <div key={m.id || i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
                                            <div style={{
                                                maxWidth: '85%', padding: '10px 14px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                                background: isUser ? 'linear-gradient(135deg, #4f46e5, #6d28d9)' : isSystem ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                                                border: isUser ? 'none' : isSystem ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.06)',
                                                fontSize: '13px', lineHeight: 1.6, color: isSystem ? '#fca5a5' : '#e2e8f0',
                                            }}>
                                                {m.content}
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            })}

                            {sending && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {selectedAgent.name} executing...
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        {selectedAgent.status === 'active' && (
                            <form onSubmit={e => { e.preventDefault(); handleSend() }} style={S['inputBar']}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input value={input} onChange={e => setInput(e.target.value)} placeholder={sending ? `${selectedAgent.name} is executing...` : `Give ${selectedAgent.name} a task...`} disabled={sending} aria-label={`Task input for ${selectedAgent.name}`}
                                        style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', opacity: sending ? 0.5 : 1 }} />
                                    <button type="submit" disabled={sending || !input.trim()} aria-label="Send task" style={{
                                        padding: '0 18px', borderRadius: '12px', border: 'none', cursor: sending ? 'default' : 'pointer',
                                        background: sending ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                        color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                        opacity: !input.trim() || sending ? 0.5 : 1,
                                    }}>
                                        {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                                    </button>
                                </div>
                            </form>
                        )}
                        {selectedAgent.status !== 'active' && (
                            <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(239,68,68,0.05)', textAlign: 'center', fontSize: '12px', color: '#f87171' }}>
                                ⚠️ Agent is {selectedAgent.status}. {selectedAgent.status === 'paused' ? 'Resume to interact.' : 'This agent can no longer execute.'}
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
