import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { api, API_BASE } from '../lib/api'

export function Audit() {
  const [framework, setFramework] = useState<string>('eu-ai-act')
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
  })

  async function generateReport() {
    if (!selectedAgent) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/v1/compliance/${selectedAgent}?format=${framework}`)
      const data = await res.json()
      setReport(data)
    } catch (e: any) {
      setReport({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit & Compliance"
        description="Generate compliance reports for your agents"
      />

      <div className="glass-card p-5 mb-6">
        <h3 className="text-sm font-medium mb-4">Generate Report</h3>
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs text-xorb-muted block mb-1">Agent</label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Select agent...</option>
              {(agentsData?.agents || []).map((a: any) => (
                <option key={a.agentId} value={a.agentId}>{a.name} ({a.agentId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-xorb-muted block mb-1">Framework</label>
            <select
              value={framework}
              onChange={e => setFramework(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              <option value="eu-ai-act">EU AI Act</option>
              <option value="nist-ai-rmf">NIST AI RMF</option>
              <option value="soc2">SOC 2</option>
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={!selectedAgent || loading}
            className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText size={16} /> {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {report && !report.error && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">
              {framework === 'eu-ai-act' ? 'EU AI Act' : framework === 'nist-ai-rmf' ? 'NIST AI RMF' : 'SOC 2'} Report
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full ${report.summary.overall_status === 'compliant' ? 'bg-green-500/20 text-green-400' : report.summary.overall_status === 'partially_compliant' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
              {report.summary.overall_status}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold">{report.summary.score}</div>
              <div className="text-xs text-xorb-muted">Score</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold">{report.summary.total_controls}</div>
              <div className="text-xs text-xorb-muted">Controls</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-green-400">{report.summary.passed_controls}</div>
              <div className="text-xs text-xorb-muted">Passed</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-red-400">{report.summary.failed_controls}</div>
              <div className="text-xs text-xorb-muted">Failed</div>
            </div>
          </div>

          <div className="space-y-3">
            {(report.sections || []).map((s: any) => (
              <div key={s.id} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {s.status === 'pass' ? <CheckCircle size={14} className="text-green-400" /> :
                   s.status === 'warning' ? <AlertTriangle size={14} className="text-yellow-400" /> :
                   <AlertTriangle size={14} className="text-red-400" />}
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.status === 'pass' ? 'bg-green-500/20 text-green-400' : s.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{s.status}</span>
                </div>
                <ul className="text-xs text-xorb-muted ml-5 space-y-0.5">
                  {(s.evidence || []).map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-xs text-xorb-muted mt-3">Generated {report.generated_at}</div>
        </div>
      )}

      {report?.error && (
        <div className="glass-card p-5 text-red-400 text-sm">Error: {report.error}</div>
      )}

      {!report && (
        <div className="glass-card p-12 text-center text-xorb-muted text-sm">
          Select an agent and framework to generate a compliance report.
        </div>
      )}
    </div>
  )
}
