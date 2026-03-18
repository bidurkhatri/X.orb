import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './components/layout/Sidebar'
import { AuthGuard } from './components/AuthGuard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OnboardingWizard } from './components/OnboardingWizard'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Agents } from './pages/Agents'
import { AgentDetail } from './pages/AgentDetail'
import { Actions } from './pages/Actions'
import { Marketplace } from './pages/Marketplace'
import { Audit } from './pages/Audit'
import { Webhooks } from './pages/Webhooks'
import { Billing } from './pages/Billing'
import { Settings } from './pages/Settings'

function AuthenticatedLayout() {
  const [showOnboarding, setShowOnboarding] = useState(
    !sessionStorage.getItem('xorb_onboarded')
  )

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {showOnboarding && (
              <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
            )}
            <Routes>
              <Route path="/overview" element={<Overview />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </AuthGuard>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AuthenticatedLayout />} />
      </Routes>
    </ErrorBoundary>
  )
}
