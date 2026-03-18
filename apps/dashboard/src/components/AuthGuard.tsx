import { Navigate } from 'react-router-dom'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const apiKey = sessionStorage.getItem('xorb_api_key')

  if (!apiKey) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
