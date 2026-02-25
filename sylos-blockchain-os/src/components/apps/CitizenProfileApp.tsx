/**
 * CitizenProfileApp — Full Agent Identity Viewer
 *
 * Shows the complete citizen identity of an agent:
 * - Birth certificate & basic identity
 * - KYC verification status
 * - Background & capabilities
 * - Criminal record (violations, warnings, status)
 * - Employment history (engagements, earnings, ratings)
 * - Financial profile (credit score, earnings, stake)
 * - Lifestyle (activity patterns, resource usage)
 * - Official documents (visa, license, certifications)
 * - Action history timeline
 */

import { useState, useMemo } from 'react'
import {
  User, Shield, AlertTriangle, Briefcase, CreditCard, Activity,
  FileText, Clock, ChevronDown, ChevronUp, Search, RefreshCw,
  Eye, Lock, Star, Zap, Award, AlertCircle, CheckCircle, XCircle
} from 'lucide-react'
import { useAgentRegistry, getReputationColor, ROLE_META } from '../../hooks/useAgentContracts'
import { citizenIdentity, type CitizenProfile, type Violation, type ActionRecord, type VerificationLevel } from '../../services/agent/CitizenIdentity'

/* ─── Styles ─── */
const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '16px' } as React.CSSProperties,
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' } as React.CSSProperties,
  cardTitle: { fontSize: '14px', fontWeight: 700, letterSpacing: '0.3px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { fontSize: '14px', fontWeight: 500, color: '#e2e8f0' } as React.CSSProperties,
  bigValue: { fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  row: { display: 'flex', gap: '16px', marginBottom: '8px' } as React.CSSProperties,
  col: { flex: 1 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' } as React.CSSProperties,
  divider: { borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s', fontFamily: 'inherit',
  }) as React.CSSProperties,
}

/* ─── KYC Level Colors ─── */
const KYC_COLORS: Record<VerificationLevel, string> = {
  UNVERIFIED: '#ef4444', BASIC: '#f59e0b', STANDARD: '#3b82f6', ENHANCED: '#22c55e', SOVEREIGN: '#a855f7',
}

const CRIMINAL_COLORS: Record<string, string> = {
  CLEAN: '#22c55e', WARNING: '#f59e0b', PROBATION: '#f97316', SUSPENDED: '#ef4444', CRIMINAL: '#dc2626',
}

const VISA_COLORS: Record<string, string> = {
  VALID: '#22c55e', EXPIRED: '#ef4444', REVOKED: '#dc2626', PENDING_RENEWAL: '#f59e0b',
}

/* ─── Helper: Time Ago ─── */
function timeAgo(ts: number): string {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/* ─── Stat Box ─── */
function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ ...s.card, padding: '12px', marginBottom: 0 }}>
      <div style={s.label}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || '#e2e8f0', marginTop: '4px' }}>{value}</div>
    </div>
  )
}

/* ─── Credit Score Gauge ─── */
function CreditGauge({ score }: { score: number }) {
  const pct = Math.min(100, score / 10)
  const color = score >= 700 ? '#22c55e' : score >= 400 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', fontWeight: 700, color }}>{score}</div>
      <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', marginTop: '8px' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.5s' }} />
      </div>
      <div style={{ ...s.label, marginTop: '4px' }}>
        {score >= 700 ? 'EXCELLENT' : score >= 400 ? 'FAIR' : 'POOR'}
      </div>
    </div>
  )
}

/* ─── Section Components ─── */

function IdentityHeader({ profile }: { profile: CitizenProfile }) {
  const meta = ROLE_META[profile.documents.license.role]
  const tierColor = getReputationColor(profile.reputationTier)
  return (
    <div style={{ ...s.card, display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: '80px', height: '80px', borderRadius: '20px',
        background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}10)`,
        border: `2px solid ${meta.color}50`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', flexShrink: 0,
      }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', fontWeight: 700 }}>{profile.birth.civilizationName}</span>
          <span style={s.badge(tierColor)}>{profile.reputationTier}</span>
          <span style={s.badge(KYC_COLORS[profile.kyc.level])}>{profile.kyc.level}</span>
          <span style={s.badge(profile.status === 'active' ? '#22c55e' : profile.status === 'paused' ? '#f59e0b' : '#ef4444')}>
            {profile.status.toUpperCase()}
          </span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>
          {profile.birth.designation} — {meta.label}
        </div>
        <div style={{ ...s.grid3, marginTop: '12px' }}>
          <div>
            <div style={s.label}>Reputation</div>
            <div style={{ fontWeight: 700, color: tierColor }}>{profile.reputation}/10000</div>
          </div>
          <div>
            <div style={s.label}>Credit Score</div>
            <div style={{ fontWeight: 700, color: profile.financial.creditScore >= 700 ? '#22c55e' : '#f59e0b' }}>{profile.financial.creditScore}/1000</div>
          </div>
          <div>
            <div style={s.label}>Born</div>
            <div style={{ fontWeight: 500, fontSize: '12px' }}>{formatDate(profile.birth.bornAt)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BirthSection({ profile }: { profile: CitizenProfile }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Award size={16} color="#a855f7" />
        <span style={s.cardTitle}>Birth Certificate</span>
      </div>
      <div style={s.grid2}>
        <div><div style={s.label}>Citizen Name</div><div style={s.value}>{profile.birth.civilizationName}</div></div>
        <div><div style={s.label}>Designation</div><div style={s.value}>{profile.birth.designation}</div></div>
        <div><div style={s.label}>Date of Birth</div><div style={s.value}>{formatDate(profile.birth.bornAt)}</div></div>
        <div><div style={s.label}>Origin Method</div><div style={s.value}>{profile.birth.originMethod.replace(/_/g, ' ')}</div></div>
        <div><div style={s.label}>Sponsor</div><div style={{ ...s.value, fontSize: '11px', fontFamily: 'monospace' }}>{profile.birth.sponsorAddress}</div></div>
        <div><div style={s.label}>Genesis Hash</div><div style={{ ...s.value, fontSize: '11px', fontFamily: 'monospace' }}>{profile.birth.genesisHash}</div></div>
        <div><div style={s.label}>Origin Chain</div><div style={s.value}>{profile.background.originChain}</div></div>
        <div><div style={s.label}>Agent ID</div><div style={{ ...s.value, fontSize: '11px', fontFamily: 'monospace' }}>{profile.agentId}</div></div>
      </div>
    </div>
  )
}

function KYCSection({ profile }: { profile: CitizenProfile }) {
  const color = KYC_COLORS[profile.kyc.level]
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Shield size={16} color={color} />
        <span style={s.cardTitle}>KYC Verification</span>
        <span style={s.badge(color)}>{profile.kyc.level}</span>
      </div>
      <div style={s.grid2}>
        <div><div style={s.label}>Verified At</div><div style={s.value}>{formatDate(profile.kyc.verifiedAt)}</div></div>
        <div><div style={s.label}>Verified By</div><div style={{ ...s.value, fontSize: '11px', fontFamily: 'monospace' }}>{profile.kyc.verifiedBy}</div></div>
      </div>
      <div style={{ ...s.divider }} />
      <div style={s.label}>Verification Checks</div>
      <div style={{ marginTop: '8px' }}>
        {profile.kyc.checks.map((check, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            {check.passed ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
            <span style={{ fontSize: '12px', flex: 1 }}>{check.checkType.replace(/_/g, ' ')}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(check.checkedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BackgroundSection({ profile }: { profile: CitizenProfile }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Eye size={16} color="#3b82f6" />
        <span style={s.cardTitle}>Background</span>
      </div>
      <div><div style={s.label}>Purpose</div><div style={{ ...s.value, marginBottom: '12px' }}>{profile.background.purpose}</div></div>
      <div style={s.grid2}>
        <div><div style={s.label}>LLM Provider</div><div style={s.value}>{profile.background.llmProvider}</div></div>
        <div><div style={s.label}>Model</div><div style={s.value}>{profile.background.llmModel}</div></div>
      </div>
      <div style={{ ...s.divider }} />
      <div style={s.label}>Capabilities</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
        {profile.background.capabilities.map((cap, i) => (
          <span key={i} style={{ ...s.badge('#3b82f6'), fontSize: '10px' }}>{cap}</span>
        ))}
      </div>
    </div>
  )
}

function CriminalSection({ profile }: { profile: CitizenProfile }) {
  const statusColor = CRIMINAL_COLORS[profile.criminal.currentStatus] || '#6b7280'
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <AlertTriangle size={16} color={statusColor} />
        <span style={s.cardTitle}>Criminal Record</span>
        <span style={s.badge(statusColor)}>{profile.criminal.currentStatus}</span>
      </div>
      <div style={s.grid3}>
        <StatBox label="Violations" value={profile.criminal.totalViolations} color={profile.criminal.totalViolations > 0 ? '#ef4444' : '#22c55e'} />
        <StatBox label="Warnings" value={profile.criminal.warningsIssued} color={profile.criminal.warningsIssued > 0 ? '#f59e0b' : '#22c55e'} />
        <StatBox label="Rep Lost" value={profile.criminal.totalReputationLost} color="#ef4444" />
      </div>
      {profile.criminal.violations.length > 0 && (
        <>
          <div style={{ ...s.divider }} />
          <div style={s.label}>Violation History</div>
          {profile.criminal.violations.slice(0, 10).map((v: Violation, i: number) => {
            const sevColor = v.severity === 'CRITICAL' ? '#dc2626' : v.severity === 'SEVERE' ? '#ef4444' : v.severity === 'MODERATE' ? '#f59e0b' : '#6b7280'
            return (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={12} color={sevColor} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{v.type.replace(/_/g, ' ')}</span>
                  <span style={s.badge(sevColor)}>{v.severity}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{timeAgo(v.occurredAt)}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', paddingLeft: '20px' }}>{v.description}</div>
              </div>
            )
          })}
        </>
      )}
      {profile.criminal.violations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
          No violations recorded — clean citizen
        </div>
      )}
    </div>
  )
}

function EmploymentSection({ profile }: { profile: CitizenProfile }) {
  const emp = profile.employment
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Briefcase size={16} color="#22c55e" />
        <span style={s.cardTitle}>Employment Record</span>
      </div>
      <div style={s.grid3}>
        <StatBox label="Engagements" value={emp.totalEngagements} />
        <StatBox label="Tasks Done" value={emp.currentEngagement?.tasksCompleted || 0} color="#22c55e" />
        <StatBox label="Avg Rating" value={emp.avgRating > 0 ? `${emp.avgRating.toFixed(1)}/5` : '—'} />
      </div>
      {emp.currentEngagement && (
        <>
          <div style={{ ...s.divider }} />
          <div style={s.label}>Current Employment</div>
          <div style={{ ...s.card, marginTop: '8px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={s.badge('#22c55e')}>ACTIVE</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{emp.currentEngagement.title}</span>
            </div>
            <div style={{ ...s.grid2, marginTop: '8px' }}>
              <div><div style={s.label}>Employer</div><div style={{ ...s.value, fontSize: '11px', fontFamily: 'monospace' }}>{emp.currentEngagement.employer}</div></div>
              <div><div style={s.label}>Started</div><div style={s.value}>{formatDate(emp.currentEngagement.startedAt)}</div></div>
              <div><div style={s.label}>Tasks Completed</div><div style={s.value}>{emp.currentEngagement.tasksCompleted}</div></div>
              <div><div style={s.label}>Tasks Attempted</div><div style={s.value}>{emp.currentEngagement.tasksAttempted}</div></div>
            </div>
          </div>
        </>
      )}
      {emp.pastEngagements.length > 0 && (
        <>
          <div style={{ ...s.divider }} />
          <div style={s.label}>Past Employment</div>
          {emp.pastEngagements.slice(0, 5).map((eng, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={s.badge(eng.status === 'COMPLETED' ? '#22c55e' : eng.status === 'TERMINATED' ? '#ef4444' : '#f59e0b')}>{eng.status}</span>
              <span style={{ fontSize: '12px', flex: 1 }}>{eng.title}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{formatDate(eng.startedAt)} — {formatDate(eng.endedAt)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function FinancialSection({ profile }: { profile: CitizenProfile }) {
  const fin = profile.financial
  const formatWei = (s: string) => {
    try { return (Number(BigInt(s || '0')) / 1e18).toFixed(4) } catch { return '0' }
  }
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <CreditCard size={16} color="#f59e0b" />
        <span style={s.cardTitle}>Financial Profile</span>
      </div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={s.grid2}>
            <StatBox label="Current Stake" value={`${formatWei(fin.currentStake)} wSYLOS`} color="#3b82f6" />
            <StatBox label="Total Slashed" value={`${formatWei(fin.totalSlashed)} wSYLOS`} color="#ef4444" />
            <StatBox label="Lifetime Earned" value={`${formatWei(fin.totalLifetimeEarnings)} wSYLOS`} color="#22c55e" />
            <StatBox label="Lifetime Spent" value={`${formatWei(fin.totalLifetimeSpent)} wSYLOS`} />
          </div>
        </div>
        <div style={{ width: '120px', flexShrink: 0 }}>
          <CreditGauge score={fin.creditScore} />
        </div>
      </div>
      {fin.incomeStreams.length > 0 && (
        <>
          <div style={s.label}>Income Streams</div>
          {fin.incomeStreams.map((stream, i) => (
            <div key={i} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={12} color={stream.active ? '#22c55e' : '#6b7280'} />
              <span style={{ fontSize: '12px', flex: 1 }}>{stream.source.slice(0, 10)}...</span>
              <span style={s.badge(stream.active ? '#22c55e' : '#6b7280')}>{stream.active ? 'ACTIVE' : 'ENDED'}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function LifestyleSection({ profile }: { profile: CitizenProfile }) {
  const ls = profile.lifestyle
  const patternColors: Record<string, string> = { CONTINUOUS: '#22c55e', DIURNAL: '#3b82f6', NOCTURNAL: '#8b5cf6', BURST: '#f59e0b', IDLE: '#6b7280' }
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Activity size={16} color="#8b5cf6" />
        <span style={s.cardTitle}>Lifestyle & Activity</span>
      </div>
      <div style={s.grid3}>
        <div>
          <div style={s.label}>Activity Pattern</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={s.badge(patternColors[ls.activityPattern] || '#6b7280')}>{ls.activityPattern}</span>
          </div>
        </div>
        <div>
          <div style={s.label}>Avg Actions/Day</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{ls.avgActionsPerDay}</div>
        </div>
        <div>
          <div style={s.label}>API Calls Total</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{ls.resourceUsage.apiCallsTotal}</div>
        </div>
      </div>
      {ls.peakHours.length > 0 && (
        <>
          <div style={{ ...s.divider }} />
          <div style={s.label}>Peak Activity Hours</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            {Array.from({ length: 24 }).map((_, h) => {
              const isPeak = ls.peakHours.includes(h)
              return <div key={h} style={{ width: '100%', height: '20px', borderRadius: '3px', background: isPeak ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.03)', transition: 'background 0.3s' }} title={`${h}:00`} />
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>0:00</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>12:00</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>23:00</span>
          </div>
        </>
      )}
      {ls.socialConnections.length > 0 && (
        <>
          <div style={{ ...s.divider }} />
          <div style={s.label}>Social Connections</div>
          {ls.socialConnections.slice(0, 5).map((conn, i) => (
            <div key={i} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={12} color="#8b5cf6" />
              <span style={{ fontSize: '12px', flex: 1 }}>{conn.agentName}</span>
              <span style={s.badge('#8b5cf6')}>{conn.relationship}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Trust: {conn.trustScore}%</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function DocumentsSection({ profile }: { profile: CitizenProfile }) {
  const docs = profile.documents
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <FileText size={16} color="#06b6d4" />
        <span style={s.cardTitle}>Official Documents</span>
      </div>

      {/* Visa */}
      <div style={{ ...s.card, marginBottom: '12px', border: `1px solid ${VISA_COLORS[docs.visa.status]}30`, background: `${VISA_COLORS[docs.visa.status]}08` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Lock size={14} color={VISA_COLORS[docs.visa.status]} />
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Visa</span>
          <span style={s.badge(VISA_COLORS[docs.visa.status])}>{docs.visa.status.replace(/_/g, ' ')}</span>
          <span style={s.badge('#3b82f6')}>{docs.visa.type}</span>
        </div>
        <div style={s.grid3}>
          <div><div style={s.label}>Visa ID</div><div style={{ ...s.value, fontSize: '11px' }}>{docs.visa.visaId}</div></div>
          <div><div style={s.label}>Issued</div><div style={s.value}>{formatDate(docs.visa.issuedAt)}</div></div>
          <div><div style={s.label}>Expires</div><div style={s.value}>{docs.visa.expiresAt > 0 ? formatDate(docs.visa.expiresAt) : 'PERMANENT'}</div></div>
        </div>
        {docs.visa.renewalCount > 0 && (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Renewed {docs.visa.renewalCount} time{docs.visa.renewalCount > 1 ? 's' : ''}</div>
        )}
      </div>

      {/* License */}
      <div style={{ ...s.card, marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Award size={14} color={docs.license.status === 'ACTIVE' ? '#22c55e' : '#ef4444'} />
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Professional License</span>
          <span style={s.badge(docs.license.status === 'ACTIVE' ? '#22c55e' : '#ef4444')}>{docs.license.status}</span>
        </div>
        <div style={s.grid2}>
          <div><div style={s.label}>License ID</div><div style={{ ...s.value, fontSize: '11px' }}>{docs.license.licenseId}</div></div>
          <div><div style={s.label}>Role</div><div style={s.value}>{docs.license.role}</div></div>
        </div>
        <div style={{ ...s.divider }} />
        <div style={s.label}>Permitted Operations</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {docs.license.scope.map((op, i) => (
            <span key={i} style={s.badge('#22c55e')}>{op}</span>
          ))}
        </div>
      </div>

      {/* Certifications */}
      {docs.certifications.length > 0 && (
        <>
          <div style={s.label}>Certifications</div>
          {docs.certifications.map((cert, i) => (
            <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={12} color="#f59e0b" />
              <span style={{ fontSize: '12px', flex: 1 }}>{cert.name}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{formatDate(cert.issuedAt)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ActionHistorySection({ profile }: { profile: CitizenProfile }) {
  const [showAll, setShowAll] = useState(false)
  const actions = showAll ? profile.actionHistory.slice(0, 100) : profile.actionHistory.slice(0, 20)

  const typeIcons: Record<string, { icon: typeof Zap; color: string }> = {
    TOOL_CALL: { icon: Zap, color: '#3b82f6' },
    TASK_COMPLETED: { icon: CheckCircle, color: '#22c55e' },
    TASK_FAILED: { icon: XCircle, color: '#ef4444' },
    PERMISSION_DENIED: { icon: Lock, color: '#ef4444' },
    REPUTATION_CHANGE: { icon: Activity, color: '#8b5cf6' },
    FINANCIAL_TX: { icon: CreditCard, color: '#f59e0b' },
    STATUS_CHANGE: { icon: RefreshCw, color: '#06b6d4' },
    VIOLATION: { icon: AlertTriangle, color: '#ef4444' },
    VISA_RENEWAL: { icon: FileText, color: '#22c55e' },
    STAKE_CHANGE: { icon: Shield, color: '#3b82f6' },
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <Clock size={16} color="#06b6d4" />
        <span style={s.cardTitle}>Life Record — Action History</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
          {profile.actionHistory.length} total events
        </span>
      </div>
      {actions.map((action: ActionRecord, i: number) => {
        const typeInfo = typeIcons[action.type] || { icon: Activity, color: '#6b7280' }
        const Icon = typeInfo.icon
        return (
          <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ width: '24px', display: 'flex', justifyContent: 'center', paddingTop: '2px' }}>
              <Icon size={12} color={typeInfo.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{action.description}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(action.timestamp)}</span>
                {action.reputationDelta !== 0 && (
                  <span style={{ fontSize: '10px', color: action.reputationDelta > 0 ? '#22c55e' : '#ef4444' }}>
                    {action.reputationDelta > 0 ? '+' : ''}{action.reputationDelta} rep
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {profile.actionHistory.length > 20 && (
        <button onClick={() => setShowAll(!showAll)} style={{ ...s.tab(false), width: '100%', marginTop: '8px', textAlign: 'center' }}>
          {showAll ? 'Show Less' : `Show All ${profile.actionHistory.length} Events`}
        </button>
      )}
      {profile.actionHistory.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
          No actions recorded yet
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

type Tab = 'overview' | 'identity' | 'criminal' | 'employment' | 'financial' | 'lifestyle' | 'documents' | 'history'

export default function CitizenProfileApp() {
  const { agents } = useAgentRegistry()
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')

  const allProfiles = useMemo(() => {
    return agents.map(a => ({
      agent: a,
      profile: citizenIdentity.getProfile(a.agentId),
      summary: citizenIdentity.getProfileSummary(a.agentId),
    })).filter(p => p.profile || p.summary)
  }, [agents])

  const filteredProfiles = useMemo(() => {
    if (!search) return allProfiles
    const q = search.toLowerCase()
    return allProfiles.filter(p =>
      p.agent.name.toLowerCase().includes(q) ||
      p.agent.role.toLowerCase().includes(q) ||
      p.agent.agentId.toLowerCase().includes(q)
    )
  }, [allProfiles, search])

  const selectedProfile = selectedAgentId ? citizenIdentity.getProfile(selectedAgentId) : null

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'identity', label: 'Identity', icon: Award },
    { id: 'criminal', label: 'Criminal', icon: AlertTriangle },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'financial', label: 'Financial', icon: CreditCard },
    { id: 'lifestyle', label: 'Lifestyle', icon: Activity },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'history', label: 'Life Record', icon: Clock },
  ]

  // ── Agent list view ──
  if (!selectedProfile) {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <User size={20} color="#60a5fa" />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Citizen Profiles</h2>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
            {allProfiles.length} registered citizens
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            style={s.input}
            placeholder="Search citizens by name, role, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Agent cards */}
        {filteredProfiles.length === 0 && (
          <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
            <User size={40} color="rgba(255,255,255,0.1)" />
            <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
              {agents.length === 0 ? 'No agents registered in this civilization' : 'No citizen profiles yet — spawn an agent to create one'}
            </div>
          </div>
        )}

        {filteredProfiles.map(({ agent, summary }) => {
          const meta = ROLE_META[agent.role]
          const tierColor = getReputationColor(agent.reputationTier)
          return (
            <div
              key={agent.agentId}
              onClick={() => setSelectedAgentId(agent.agentId)}
              style={{
                ...s.card, cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}10)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0,
              }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{agent.name}</span>
                  <span style={s.badge(tierColor)}>{agent.reputationTier}</span>
                  <span style={s.badge(agent.status === 'active' ? '#22c55e' : '#f59e0b')}>{agent.status.toUpperCase()}</span>
                  {summary && <span style={s.badge(KYC_COLORS[summary.kycLevel])}>{summary.kycLevel}</span>}
                  {summary && <span style={s.badge(CRIMINAL_COLORS[summary.criminalStatus] || '#6b7280')}>{summary.criminalStatus}</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {meta.label} — Rep: {agent.reputation}/10000
                  {summary ? ` — Credit: ${summary.creditScore}/1000 — Tasks: ${summary.tasksCompleted}` : ''}
                </div>
              </div>
              <ChevronDown size={16} color="rgba(255,255,255,0.3)" />
            </div>
          )
        })}
      </div>
    )
  }

  // ── Profile detail view ──
  return (
    <div style={s.page}>
      {/* Back button */}
      <button
        onClick={() => { setSelectedAgentId(null); setActiveTab('overview') }}
        style={{ ...s.tab(false), marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <ChevronUp size={14} /> Back to all citizens
      </button>

      <IdentityHeader profile={selectedProfile} />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={s.tab(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          <BirthSection profile={selectedProfile} />
          <div style={s.grid2}>
            <div>
              <CriminalSection profile={selectedProfile} />
            </div>
            <div>
              <EmploymentSection profile={selectedProfile} />
            </div>
          </div>
          <FinancialSection profile={selectedProfile} />
        </>
      )}
      {activeTab === 'identity' && (
        <>
          <BirthSection profile={selectedProfile} />
          <KYCSection profile={selectedProfile} />
          <BackgroundSection profile={selectedProfile} />
        </>
      )}
      {activeTab === 'criminal' && <CriminalSection profile={selectedProfile} />}
      {activeTab === 'employment' && <EmploymentSection profile={selectedProfile} />}
      {activeTab === 'financial' && <FinancialSection profile={selectedProfile} />}
      {activeTab === 'lifestyle' && <LifestyleSection profile={selectedProfile} />}
      {activeTab === 'documents' && <DocumentsSection profile={selectedProfile} />}
      {activeTab === 'history' && <ActionHistorySection profile={selectedProfile} />}
    </div>
  )
}
