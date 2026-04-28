import type { Session, User } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signUp(email: string, password: string) {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) setAuthError(error.message)
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setAuthError(error.message)
  }

  async function signOut() {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(error.message)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseConfigured,
      user,
      session,
      authError,
      signIn,
      signUp,
      signOut,
      clearAuthError: () => setAuthError(null),
    }),
    [authError, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
