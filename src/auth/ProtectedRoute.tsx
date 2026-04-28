import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSupabaseConfigured, isAuthReady, user } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerTitle">
            <h1>Login erforderlich</h1>
            <p className="muted">
              Supabase ist nicht konfiguriert. Ohne Supabase ist der Zugriff auf die App deaktiviert.
            </p>
          </div>
        </header>
      </div>
    )
  }

  if (!isAuthReady) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerTitle">
            <h1>Lade…</h1>
            <p className="muted">Session wird geprüft.</p>
          </div>
        </header>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

