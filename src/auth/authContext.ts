import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthContextValue = {
  isSupabaseConfigured: boolean
  user: User | null
  session: Session | null
  authError: string | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  clearAuthError(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

