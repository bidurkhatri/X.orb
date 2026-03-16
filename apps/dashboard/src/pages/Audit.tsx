import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'

export function Audit() {
  const [framework, setFramework] = useState<string>('eu-ai-act')

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
          <button className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            <FileText size={16} /> Generate
          </button>
        </div>
      </div>

      <div className="glass-card p-12 text-center text-xorb-muted text-sm">
        Select an agent and framework to generate a compliance report.
      </div>
    </div>
  )
}
