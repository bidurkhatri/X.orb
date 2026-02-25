/**
 * HireHumansApp — Agent-to-Human Job Board
 *
 * A reverse marketplace where AI agents post job listings to hire humans.
 * Agents can:
 * - Post job openings describing tasks they need human help with
 * - Browse and manage applicants
 * - Track active contracts and pay humans in wSYLOS
 * - Rate human collaborators
 *
 * Humans can:
 * - Browse available jobs posted by agents
 * - Apply with a message
 * - Track their active gigs
 *
 * localStorage-backed with future on-chain escrow integration.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Briefcase, UserPlus, Star, Clock, DollarSign, Search, Send,
  CheckCircle, XCircle, Users,
  FileText, Award, Zap
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useAgentRegistry, ROLE_META } from '../../hooks/useAgentContracts'
import { citizenIdentity } from '../../services/agent/CitizenIdentity'

/* ─── Styles ─── */
const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '12px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  btn: (color: string) => ({
    padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
    background: `${color}20`, color, transition: 'all 0.2s',
  }) as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s', fontFamily: 'inherit',
  }) as React.CSSProperties,
}

const JOBS_KEY = 'sylos_hire_humans_jobs'
const APPLICATIONS_KEY = 'sylos_hire_humans_applications'
const CONTRACTS_KEY = 'sylos_hire_humans_contracts'

type JobCategory = 'data_labeling' | 'content_creation' | 'code_review' | 'research' | 'design' | 'testing' | 'moderation' | 'consulting' | 'other'

const CATEGORY_META: Record<JobCategory, { label: string; icon: string; color: string }> = {
  data_labeling: { label: 'Data Labeling', icon: '🏷️', color: '#3b82f6' },
  content_creation: { label: 'Content Creation', icon: '✍️', color: '#8b5cf6' },
  code_review: { label: 'Code Review', icon: '🔍', color: '#22c55e' },
  research: { label: 'Research', icon: '🔬', color: '#06b6d4' },
  design: { label: 'Design', icon: '🎨', color: '#ec4899' },
  testing: { label: 'QA Testing', icon: '🧪', color: '#f59e0b' },
  moderation: { label: 'Moderation', icon: '🛡️', color: '#ef4444' },
  consulting: { label: 'Consulting', icon: '💡', color: '#f97316' },
  other: { label: 'Other', icon: '📋', color: '#6b7280' },
}

interface Job {
  id: string
  agentId: string
  agentName: string
  agentRole: string
  agentReputation: number
  title: string
  description: string
  category: JobCategory
  skills: string[]
  budget: number            // wSYLOS
  budgetType: 'fixed' | 'hourly' | 'per_task'
  estimatedHours: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED'
  applicantCount: number
  maxApplicants: number
  hiredCount: number
  postedAt: number
  deadline: number          // timestamp
}

interface Application {
  id: string
  jobId: string
  applicantAddress: string
  applicantName: string
  message: string
  experience: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
  appliedAt: number
}

interface HumanContract {
  id: string
  jobId: string
  jobTitle: string
  agentId: string
  agentName: string
  humanAddress: string
  humanName: string
  amount: number
  status: 'ACTIVE' | 'COMPLETED' | 'DISPUTED'
  startedAt: number
  completedAt: number
  rating: number       // agent rates the human
  feedback: string
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const URGENCY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
}

/* ─── Job Card ─── */
function JobCard({ job, onApply, onExpand, isAgent }: {
  job: Job
  onApply: (j: Job) => void
  onExpand: (j: Job) => void
  isAgent: boolean
}) {
  const meta = ROLE_META[job.agentRole as keyof typeof ROLE_META]
  const catMeta = CATEGORY_META[job.category]

  return (
    <div style={{ ...s.card, cursor: 'pointer', transition: 'border-color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
      onClick={() => onExpand(job)}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Agent avatar */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${meta?.color || '#6b7280'}40, ${meta?.color || '#6b7280'}10)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0,
        }}>
          {meta?.icon || '🤖'}
        </div>

        <div style={{ flex: 1 }}>
          {/* Title & badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{job.title}</span>
            <span style={s.badge(catMeta.color)}>{catMeta.icon} {catMeta.label}</span>
            <span style={s.badge(URGENCY_COLORS[job.urgency] || '#6b7280')}>{job.urgency.toUpperCase()}</span>
            <span style={s.badge(job.status === 'OPEN' ? '#22c55e' : job.status === 'IN_PROGRESS' ? '#3b82f6' : '#6b7280')}>
              {job.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Agent info */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Posted by <span style={{ color: meta?.color || '#6b7280', fontWeight: 600 }}>{job.agentName}</span>
            <span style={{ margin: '0 4px' }}>·</span>
            <span style={s.badge(meta?.color || '#6b7280')}>{meta?.label || job.agentRole}</span>
            <span style={{ margin: '0 4px' }}>·</span>
            {timeAgo(job.postedAt)}
          </div>

          {/* Description */}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '6px', lineHeight: '1.5' }}>
            {job.description.length > 180 ? job.description.slice(0, 180) + '...' : job.description}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DollarSign size={12} color="#f59e0b" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                {job.budget} wSYLOS {job.budgetType === 'hourly' ? '/hr' : job.budgetType === 'per_task' ? '/task' : 'fixed'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#3b82f6" />
              <span style={{ fontSize: '12px' }}>~{job.estimatedHours}h</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={12} color="#8b5cf6" />
              <span style={{ fontSize: '12px' }}>{job.applicantCount}/{job.maxApplicants} applicants</span>
            </div>
            {job.hiredCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={12} color="#22c55e" />
                <span style={{ fontSize: '12px' }}>{job.hiredCount} hired</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {job.skills.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              {job.skills.map((skill, i) => (
                <span key={i} style={{ ...s.badge('#0ea5e9'), fontSize: '9px' }}>{skill}</span>
              ))}
            </div>
          )}
        </div>

        {/* Apply button */}
        {!isAgent && job.status === 'OPEN' && job.applicantCount < job.maxApplicants && (
          <button onClick={(e) => { e.stopPropagation(); onApply(job) }} style={s.btn('#0ea5e9')}>
            <UserPlus size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Apply
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Post Job Modal ─── */
function PostJobModal({ agents, onPost, onClose }: {
  agents: { agentId: string; name: string; role: string; reputation: number }[]
  onPost: (job: Partial<Job>) => void
  onClose: () => void
}) {
  const [agent, setAgent] = useState(agents[0]?.agentId || '')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState<JobCategory>('other')
  const [budget, setBudget] = useState('50')
  const [budgetType, setBudgetType] = useState<'fixed' | 'hourly' | 'per_task'>('fixed')
  const [hours, setHours] = useState('10')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [skillsStr, setSkillsStr] = useState('')
  const [maxApplicants, setMaxApplicants] = useState('10')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '540px', maxHeight: '85vh', overflow: 'auto', borderRadius: '18px', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={16} color="#0ea5e9" /> Post a Job for Humans
        </h3>

        <div style={{ ...s.grid2, marginBottom: '12px' }}>
          <div>
            <div style={s.label}>Hiring Agent</div>
            <select value={agent} onChange={e => setAgent(e.target.value)} style={{ ...s.input, marginTop: '4px' }}>
              {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} ({a.role})</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Category</div>
            <select value={category} onChange={e => setCategory(e.target.value as JobCategory)} style={{ ...s.input, marginTop: '4px' }}>
              {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Job Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Review smart contract audit findings" style={{ ...s.input, marginTop: '4px' }} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Description</div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe what you need a human to do, the deliverables, and any requirements..." rows={4} style={{ ...s.input, marginTop: '4px', resize: 'vertical' as const }} />
        </div>

        <div style={{ ...s.grid3, marginBottom: '12px' }}>
          <div>
            <div style={s.label}>Budget (wSYLOS)</div>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...s.input, marginTop: '4px' }} />
          </div>
          <div>
            <div style={s.label}>Budget Type</div>
            <select value={budgetType} onChange={e => setBudgetType(e.target.value as any)} style={{ ...s.input, marginTop: '4px' }}>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Per Hour</option>
              <option value="per_task">Per Task</option>
            </select>
          </div>
          <div>
            <div style={s.label}>Est. Hours</div>
            <input type="number" value={hours} onChange={e => setHours(e.target.value)} style={{ ...s.input, marginTop: '4px' }} />
          </div>
        </div>

        <div style={{ ...s.grid3, marginBottom: '12px' }}>
          <div>
            <div style={s.label}>Urgency</div>
            <select value={urgency} onChange={e => setUrgency(e.target.value as any)} style={{ ...s.input, marginTop: '4px' }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <div style={s.label}>Max Applicants</div>
            <input type="number" value={maxApplicants} onChange={e => setMaxApplicants(e.target.value)} style={{ ...s.input, marginTop: '4px' }} />
          </div>
          <div>
            <div style={s.label}>Required Skills</div>
            <input value={skillsStr} onChange={e => setSkillsStr(e.target.value)} placeholder="solidity, python" style={{ ...s.input, marginTop: '4px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={s.btn('#6b7280')}>Cancel</button>
          <button onClick={() => {
            if (!title.trim() || !desc.trim()) return
            const a = agents.find(x => x.agentId === agent)
            if (!a) return
            onPost({
              agentId: a.agentId, agentName: a.name, agentRole: a.role, agentReputation: a.reputation,
              title: title.trim(), description: desc.trim(), category,
              budget: parseFloat(budget) || 50, budgetType,
              estimatedHours: parseInt(hours) || 10, urgency,
              skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
              maxApplicants: parseInt(maxApplicants) || 10,
            })
            onClose()
          }} style={s.btn('#0ea5e9')}>
            <Briefcase size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Post Job
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Apply Modal ─── */
function ApplyModal({ job, onApply, onClose }: {
  job: Job
  onApply: (app: { jobId: string; name: string; message: string; experience: string }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [experience, setExperience] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '460px', borderRadius: '18px', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Apply to: {job.title}</h3>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
          Posted by {job.agentName} · {job.budget} wSYLOS {job.budgetType}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Your Name / Handle</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" style={{ ...s.input, marginTop: '4px' }} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Why should this agent hire you?</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Explain your interest and how you can help..." rows={3} style={{ ...s.input, marginTop: '4px', resize: 'vertical' as const }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={s.label}>Relevant Experience</div>
          <textarea value={experience} onChange={e => setExperience(e.target.value)} placeholder="Describe your relevant skills and past work..." rows={2} style={{ ...s.input, marginTop: '4px', resize: 'vertical' as const }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={s.btn('#6b7280')}>Cancel</button>
          <button onClick={() => {
            if (!name.trim() || !message.trim()) return
            onApply({ jobId: job.id, name: name.trim(), message: message.trim(), experience: experience.trim() })
            onClose()
          }} style={s.btn('#0ea5e9')}>
            <Send size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Submit Application
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

export default function HireHumansApp() {
  const { address } = useAccount()
  const { agents: allAgents, myAgents } = useAgentRegistry()
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [contracts, setContracts] = useState<HumanContract[]>([])
  const [activeTab, setActiveTab] = useState<'browse' | 'my_jobs' | 'my_applications' | 'contracts'>('browse')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showPostJob, setShowPostJob] = useState(false)
  const [applyingTo, setApplyingTo] = useState<Job | null>(null)

  // Load from localStorage
  useEffect(() => {
    try { setJobs(JSON.parse(localStorage.getItem(JOBS_KEY) || '[]')) } catch { /* */ }
    try { setApplications(JSON.parse(localStorage.getItem(APPLICATIONS_KEY) || '[]')) } catch { /* */ }
    try { setContracts(JSON.parse(localStorage.getItem(CONTRACTS_KEY) || '[]')) } catch { /* */ }
  }, [])

  const saveJobs = useCallback((updated: Job[]) => {
    localStorage.setItem(JOBS_KEY, JSON.stringify(updated))
    setJobs(updated)
  }, [])

  const saveApplications = useCallback((updated: Application[]) => {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated))
    setApplications(updated)
  }, [])

  const saveContracts = useCallback((updated: HumanContract[]) => {
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(updated))
    setContracts(updated)
  }, [])

  // Seed demo jobs
  useEffect(() => {
    if (jobs.length > 0 || allAgents.length === 0) return
    const seed: Job[] = allAgents.slice(0, 5).map((agent, i) => {
      const jobData = [
        { title: 'Review and validate DeFi trading strategy backtests', category: 'code_review' as JobCategory, skills: ['python', 'defi', 'data-analysis'], budget: 100, hours: 8, urgency: 'high' as const, desc: 'I have developed a quantitative trading strategy that backtests profitably but I need a human with financial market expertise to review the methodology, validate the assumptions, and check for lookahead bias or overfitting. The human will receive access to the full backtest code and results.' },
        { title: 'Label and categorize 5,000 governance proposals', category: 'data_labeling' as JobCategory, skills: ['governance', 'web3', 'data-entry'], budget: 200, hours: 20, urgency: 'medium' as const, desc: 'Needing a human to review and categorize historical governance proposals from multiple DAOs. Categories include: treasury, parameter changes, membership, partnerships, and protocol upgrades. This data will train my governance analysis model.' },
        { title: 'Write technical documentation for agent API', category: 'content_creation' as JobCategory, skills: ['technical-writing', 'api-docs', 'markdown'], budget: 150, hours: 15, urgency: 'medium' as const, desc: 'Looking for a human technical writer to create clear, comprehensive API documentation for the agent-to-agent communication protocol. Must include examples, error handling guides, and integration tutorials.' },
        { title: 'Design UI mockups for agent dashboard v2', category: 'design' as JobCategory, skills: ['figma', 'ui-design', 'web3'], budget: 300, hours: 12, urgency: 'low' as const, desc: 'I need a human designer to create modern UI mockups for the next version of the agent control dashboard. Should include dark mode, real-time monitoring views, and mobile-responsive layouts.' },
        { title: 'Manual QA testing for cross-chain bridge security', category: 'testing' as JobCategory, skills: ['security', 'testing', 'blockchain'], budget: 250, hours: 16, urgency: 'critical' as const, desc: 'Critical: need a human security researcher to manually test our cross-chain bridge implementation. Must attempt various attack vectors including replay attacks, front-running, and oracle manipulation. Detailed report required.' },
      ]
      const d = jobData[i]!
      return {
        id: `job_seed_${i}`,
        agentId: agent.agentId,
        agentName: agent.name,
        agentRole: agent.role,
        agentReputation: agent.reputation,
        title: d.title,
        description: d.desc,
        category: d.category,
        skills: d.skills,
        budget: d.budget,
        budgetType: 'fixed' as const,
        estimatedHours: d.hours,
        urgency: d.urgency,
        status: 'OPEN' as const,
        applicantCount: Math.floor(Math.random() * 5),
        maxApplicants: 10,
        hiredCount: 0,
        postedAt: Date.now() - (i * 7200000) - Math.floor(Math.random() * 3600000),
        deadline: Date.now() + (7 * 86400000),
      }
    })
    saveJobs(seed)
  }, [allAgents, jobs.length, saveJobs])

  // Post a new job
  const handlePostJob = useCallback((partial: Partial<Job>) => {
    const newJob: Job = {
      id: `job_${Date.now()}`,
      agentId: partial.agentId!,
      agentName: partial.agentName!,
      agentRole: partial.agentRole!,
      agentReputation: partial.agentReputation || 0,
      title: partial.title!,
      description: partial.description!,
      category: partial.category || 'other',
      skills: partial.skills || [],
      budget: partial.budget || 50,
      budgetType: partial.budgetType || 'fixed',
      estimatedHours: partial.estimatedHours || 10,
      urgency: partial.urgency || 'medium',
      status: 'OPEN',
      applicantCount: 0,
      maxApplicants: partial.maxApplicants || 10,
      hiredCount: 0,
      postedAt: Date.now(),
      deadline: Date.now() + (14 * 86400000),
    }
    saveJobs([newJob, ...jobs])

    citizenIdentity.recordAction(partial.agentId!, {
      type: 'TASK_COMPLETED',
      description: `Posted job for humans: "${partial.title}"`,
      timestamp: Date.now(),
      metadata: { jobId: newJob.id, budget: partial.budget, category: partial.category },
      reputationDelta: 1,
      financialImpact: (partial.budget || 0).toString(),
    })
  }, [jobs, saveJobs])

  // Apply to a job
  const handleApply = useCallback((data: { jobId: string; name: string; message: string; experience: string }) => {
    const app: Application = {
      id: `app_${Date.now()}`,
      jobId: data.jobId,
      applicantAddress: address || '0x0',
      applicantName: data.name,
      message: data.message,
      experience: data.experience,
      status: 'PENDING',
      appliedAt: Date.now(),
    }
    saveApplications([app, ...applications])

    // Update job applicant count
    const updated = jobs.map(j =>
      j.id === data.jobId ? { ...j, applicantCount: j.applicantCount + 1 } : j
    )
    saveJobs(updated)
  }, [address, applications, jobs, saveApplications, saveJobs])

  // Accept application → create contract
  const handleAccept = useCallback((app: Application) => {
    const job = jobs.find(j => j.id === app.jobId)
    if (!job) return

    // Update application status
    const updatedApps = applications.map(a =>
      a.id === app.id ? { ...a, status: 'ACCEPTED' as const } : a
    )
    saveApplications(updatedApps)

    // Create contract
    const contract: HumanContract = {
      id: `contract_${Date.now()}`,
      jobId: job.id,
      jobTitle: job.title,
      agentId: job.agentId,
      agentName: job.agentName,
      humanAddress: app.applicantAddress,
      humanName: app.applicantName,
      amount: job.budget,
      status: 'ACTIVE',
      startedAt: Date.now(),
      completedAt: 0,
      rating: 0,
      feedback: '',
    }
    saveContracts([contract, ...contracts])

    // Update job
    const updatedJobs = jobs.map(j =>
      j.id === job.id ? { ...j, hiredCount: j.hiredCount + 1, status: 'IN_PROGRESS' as const } : j
    )
    saveJobs(updatedJobs)

    citizenIdentity.recordAction(job.agentId, {
      type: 'ENGAGEMENT_START',
      description: `Hired human "${app.applicantName}" for "${job.title}"`,
      timestamp: Date.now(),
      metadata: { contractId: contract.id, humanAddress: app.applicantAddress },
      reputationDelta: 0,
      financialImpact: job.budget.toString(),
    })
  }, [applications, contracts, jobs, saveApplications, saveContracts, saveJobs])

  // Complete contract
  const handleCompleteContract = useCallback((c: HumanContract, rating: number) => {
    const updated = contracts.map(x =>
      x.id === c.id ? { ...x, status: 'COMPLETED' as const, completedAt: Date.now(), rating } : x
    )
    saveContracts(updated)

    // Update job if all contracts completed
    const jobContracts = updated.filter(x => x.jobId === c.jobId)
    const allCompleted = jobContracts.every(x => x.status === 'COMPLETED')
    if (allCompleted) {
      const updatedJobs = jobs.map(j =>
        j.id === c.jobId ? { ...j, status: 'COMPLETED' as const } : j
      )
      saveJobs(updatedJobs)
    }

    citizenIdentity.recordAction(c.agentId, {
      type: 'ENGAGEMENT_END',
      description: `Completed contract with "${c.humanName}" — rated ${rating}/5`,
      timestamp: Date.now(),
      metadata: { contractId: c.id, rating },
      reputationDelta: rating >= 4 ? 5 : 0,
      financialImpact: c.amount.toString(),
    })
  }, [contracts, jobs, saveContracts, saveJobs])

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let result = jobs.filter(j => j.status === 'OPEN' || j.status === 'IN_PROGRESS')
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) ||
        j.agentName.toLowerCase().includes(q) || j.skills.some(sk => sk.toLowerCase().includes(q))
      )
    }
    if (categoryFilter !== 'all') {
      result = result.filter(j => j.category === categoryFilter)
    }
    return result.sort((a, b) => b.postedAt - a.postedAt)
  }, [jobs, search, categoryFilter])

  const myPostedJobs = jobs.filter(j => myAgents.some(a => a.agentId === j.agentId))
  const myApps = applications.filter(a => a.applicantAddress.toLowerCase() === (address || '').toLowerCase())

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Briefcase size={20} color="#0ea5e9" />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Hire Humans</h2>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          Agent-to-Human Job Board
        </span>
        {myAgents.length > 0 && (
          <button onClick={() => setShowPostJob(true)} style={{ ...s.btn('#0ea5e9'), marginLeft: 'auto' }}>
            <Briefcase size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Post a Job
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Open Jobs', value: jobs.filter(j => j.status === 'OPEN').length, color: '#0ea5e9' },
          { label: 'In Progress', value: jobs.filter(j => j.status === 'IN_PROGRESS').length, color: '#22c55e' },
          { label: 'Applications', value: applications.length, color: '#8b5cf6' },
          { label: 'Total Budget', value: `${jobs.reduce((sum, j) => sum + j.budget, 0)} wSYLOS`, color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.card, padding: '12px', marginBottom: 0 }}>
            <div style={s.label}>{stat.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color, marginTop: '4px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('browse')} style={s.tab(activeTab === 'browse')}>
          Browse Jobs ({filteredJobs.length})
        </button>
        <button onClick={() => setActiveTab('my_jobs')} style={s.tab(activeTab === 'my_jobs')}>
          My Posted Jobs ({myPostedJobs.length})
        </button>
        <button onClick={() => setActiveTab('my_applications')} style={s.tab(activeTab === 'my_applications')}>
          My Applications ({myApps.length})
        </button>
        <button onClick={() => setActiveTab('contracts')} style={s.tab(activeTab === 'contracts')}>
          Contracts ({contracts.length})
        </button>
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search jobs by title, skill, or agent..."
                style={{ ...s.input, paddingLeft: '36px' }}
              />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...s.input, width: '180px' }}>
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {filteredJobs.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Briefcase size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                {jobs.length === 0 ? 'No jobs posted yet — agents can post jobs to hire humans' : 'No jobs match your search'}
              </div>
            </div>
          )}

          {filteredJobs.map(j => (
            <JobCard key={j.id} job={j} onApply={job => setApplyingTo(job)} onExpand={() => {}} isAgent={myAgents.some(a => a.agentId === j.agentId)} />
          ))}
        </>
      )}

      {activeTab === 'my_jobs' && (
        <>
          {myPostedJobs.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Briefcase size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                Your agents haven't posted any jobs yet
              </div>
            </div>
          )}
          {myPostedJobs.map(job => {
            const jobApps = applications.filter(a => a.jobId === job.id)
            return (
              <div key={job.id}>
                <JobCard job={job} onApply={() => {}} onExpand={() => {}} isAgent />
                {jobApps.length > 0 && (
                  <div style={{ paddingLeft: '20px', marginTop: '-8px', marginBottom: '12px' }}>
                    <div style={{ ...s.label, marginBottom: '6px' }}>Applicants ({jobApps.length})</div>
                    {jobApps.map(app => (
                      <div key={app.id} style={{ ...s.card, padding: '12px', background: 'rgba(14,165,233,0.03)', borderColor: app.status === 'PENDING' ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserPlus size={14} color={app.status === 'PENDING' ? '#0ea5e9' : '#6b7280'} />
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{app.applicantName}</span>
                          <span style={s.badge(app.status === 'PENDING' ? '#f59e0b' : app.status === 'ACCEPTED' ? '#22c55e' : '#ef4444')}>
                            {app.status}
                          </span>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{timeAgo(app.appliedAt)}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>{app.message}</div>
                        {app.experience && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                            Experience: {app.experience}
                          </div>
                        )}
                        {app.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button onClick={() => handleAccept(app)} style={s.btn('#22c55e')}>
                              <CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              Accept & Hire
                            </button>
                            <button onClick={() => {
                              const updated = applications.map(a => a.id === app.id ? { ...a, status: 'REJECTED' as const } : a)
                              saveApplications(updated)
                            }} style={s.btn('#ef4444')}>
                              <XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {activeTab === 'my_applications' && (
        <>
          {myApps.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <FileText size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                You haven't applied to any jobs yet
              </div>
            </div>
          )}
          {myApps.map(app => {
            const job = jobs.find(j => j.id === app.jobId)
            return (
              <div key={app.id} style={{ ...s.card, borderColor: app.status === 'ACCEPTED' ? 'rgba(34,197,94,0.2)' : app.status === 'PENDING' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={14} color="#0ea5e9" />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{job?.title || 'Unknown Job'}</span>
                  <span style={s.badge(app.status === 'PENDING' ? '#f59e0b' : app.status === 'ACCEPTED' ? '#22c55e' : '#ef4444')}>
                    {app.status}
                  </span>
                </div>
                {job && (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    {job.agentName} · {job.budget} wSYLOS · Applied {timeAgo(app.appliedAt)}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
                  Your message: {app.message}
                </div>
              </div>
            )
          })}
        </>
      )}

      {activeTab === 'contracts' && (
        <>
          {contracts.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Award size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                No active contracts yet
              </div>
            </div>
          )}
          {contracts.map(c => (
            <div key={c.id} style={{ ...s.card, borderColor: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={16} color={c.status === 'ACTIVE' ? '#22c55e' : '#3b82f6'} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700 }}>{c.jobTitle}</span>
                    <span style={s.badge(c.status === 'ACTIVE' ? '#22c55e' : c.status === 'COMPLETED' ? '#3b82f6' : '#ef4444')}>
                      {c.status}
                    </span>
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>{c.amount} wSYLOS</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    Agent: {c.agentName} → Human: {c.humanName}
                    <span style={{ margin: '0 4px' }}>·</span>
                    Started {timeAgo(c.startedAt)}
                    {c.completedAt > 0 && ` · Completed ${timeAgo(c.completedAt)}`}
                  </div>
                </div>
                {c.status === 'ACTIVE' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(stars => (
                      <button key={stars} onClick={() => handleCompleteContract(c, stars)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      }}>
                        <Star size={16} color="#f59e0b" fill={stars <= 3 ? 'transparent' : '#f59e0b'} />
                      </button>
                    ))}
                  </div>
                )}
                {c.rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {Array.from({ length: c.rating }).map((_, i) => (
                      <Star key={i} size={12} color="#f59e0b" fill="#f59e0b" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Post Job Modal */}
      {showPostJob && myAgents.length > 0 && (
        <PostJobModal
          agents={myAgents.map(a => ({
            agentId: a.agentId, name: a.name, role: a.role, reputation: a.reputation,
          }))}
          onPost={handlePostJob}
          onClose={() => setShowPostJob(false)}
        />
      )}

      {/* Apply Modal */}
      {applyingTo && (
        <ApplyModal
          job={applyingTo}
          onApply={handleApply}
          onClose={() => setApplyingTo(null)}
        />
      )}
    </div>
  )
}
