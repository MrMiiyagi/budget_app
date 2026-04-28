import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function LoginPage() {
  const { isSupabaseConfigured, user, authError, clearAuthError, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const location = useLocation()

  const nextPath = (location.state as { from?: string } | null)?.from ?? '/app'

  useEffect(() => {
    clearAuthError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerTitle">
            <h1>Login</h1>
            <p className="muted">
              Supabase ist nicht konfiguriert. Erstelle eine <code>.env</code> (siehe <code>.env.example</code>) und starte
              den Dev-Server neu.
            </p>
          </div>
        </header>
      </div>
    )
  }

  if (user) return <Navigate to={nextPath} replace />

  return (
    <div className="app">
      <header className="header">
        <div className="headerTitle">
          <h1>Login</h1>
          <p className="muted">Melde dich an, um deine Ausgaben zwischen Geräten zu synchronisieren.</p>
        </div>
      </header>

      <main className="grid gridSingle">
        <section className="card">
          <h2>Anmelden / Registrieren</h2>
          <div className="form">
            <label className="field wide">
              <span>E-Mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" />
            </label>
            <label className="field wide">
              <span>Passwort</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mind. 6 Zeichen"
              />
            </label>
            <div className="formActions">
              <button type="button" className="primary" onClick={() => signIn(email, password)}>
                Anmelden
              </button>
              <button type="button" className="ghost" onClick={() => signUp(email, password)}>
                Registrieren
              </button>
            </div>
            {authError ? <p className="error">{authError}</p> : null}
          </div>
          <p className="hint">
            Tipp: Nach dem Login kannst du in der Budget-App auf „Jetzt synchronisieren“ drücken.
          </p>
        </section>
      </main>
    </div>
  )
}

