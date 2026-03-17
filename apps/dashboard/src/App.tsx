import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Overview } from './pages/Overview'
import { Agents } from './pages/Agents'
import { AgentDetail } from './pages/AgentDetail'
import { Actions } from './pages/Actions'
import { Marketplace } from './pages/Marketplace'
import { Audit } from './pages/Audit'
import { Webhooks } from './pages/Webhooks'
import { Billing } from './pages/Billing'
import { Settings } from './pages/Settings'

export function App() {
  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  )
}
