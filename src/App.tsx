import './App.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { BudgetContext, CATEGORIES, type Expense, type ExpenseCategory } from './budget/budgetContext'

const STORAGE_KEY = 'budgetApp.expenses.v1'
const STORAGE_SYNC_KEY = 'budgetApp.sync.v1'

function formatCents(cents: number): string {
  const value = (cents / 100).toFixed(2)
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  )
}

function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  if (amount <= 0) return null
  return Math.round(amount * 100)
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function monthFromDateISO(dateISO: string): string {
  return dateISO.slice(0, 7)
}

function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as Expense)
      .filter(
        (e) =>
          typeof e.id === 'string' &&
          typeof e.date === 'string' &&
          typeof e.amountCents === 'number' &&
          typeof e.category === 'string' &&
          typeof e.note === 'string' &&
          typeof e.createdAt === 'number' &&
          (typeof (e as Expense).updatedAt === 'number' || typeof e.createdAt === 'number') &&
          ((e as Expense).deletedAt === null ||
            typeof (e as Expense).deletedAt === 'number' ||
            typeof (e as Expense).deletedAt === 'undefined'),
      )
      .map((e) => ({
        ...e,
        updatedAt: typeof (e as Expense).updatedAt === 'number' ? (e as Expense).updatedAt : e.createdAt,
        deletedAt:
          typeof (e as Expense).deletedAt === 'number'
            ? (e as Expense).deletedAt
            : (e as Expense).deletedAt === null
              ? null
              : null,
      }))
  } catch {
    return []
  }
}

function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
}

type SyncState = {
  lastPulledAt: number | null
  lastPushedAt: number | null
}

function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_KEY)
    if (!raw) return { lastPulledAt: null, lastPushedAt: null }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { lastPulledAt: null, lastPushedAt: null }
    const x = parsed as Partial<SyncState>
    return {
      lastPulledAt: typeof x.lastPulledAt === 'number' ? x.lastPulledAt : null,
      lastPushedAt: typeof x.lastPushedAt === 'number' ? x.lastPushedAt : null,
    }
  } catch {
    return { lastPulledAt: null, lastPushedAt: null }
  }
}

function saveSyncState(state: SyncState) {
  localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(state))
}

function App() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses())
  const [syncState, setSyncState] = useState<SyncState>(() => loadSyncState())
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const initial = expenses[0]?.date ? monthFromDateISO(expenses[0].date) : monthFromDateISO(todayISO())
    return initial
  })

  const { user, signOut } = useAuth()
  const [, setSyncError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const syncTimerRef = useRef<number | null>(null)
  const syncQueuedRef = useRef(false)
  const lastLocalChangeAtRef = useRef<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const [date, setDate] = useState<string>(() => todayISO())
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<ExpenseCategory>('Lebensmittel')
  const [note, setNote] = useState<string>('')

  useEffect(() => {
    saveExpenses(expenses)
  }, [expenses])

  useEffect(() => {
    saveSyncState(syncState)
  }, [syncState])

  const hasInitialPull = Boolean(user && syncState.lastPulledAt)

  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = profileRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      setProfileOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  const filteredExpenses = useMemo(() => {
    const list = expenses.filter((e) => !e.deletedAt && monthFromDateISO(e.date) === filterMonth)
    list.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
    return list
  }, [expenses, filterMonth])

  const totalFiltered = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amountCents, 0)
  }, [filteredExpenses])

  const totalsByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>()
    for (const e of filteredExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents)
    }
    return CATEGORIES.filter((c) => (map.get(c) ?? 0) > 0).map((c) => ({ category: c, totalCents: map.get(c)! }))
  }, [filteredExpenses])

  function addExpense() {
    const cents = parseAmountToCents(amount)
    if (!cents) {
      return
    }
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      date,
      amountCents: cents,
      category,
      note: note.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    }
    setExpenses((prev) => [newExpense, ...prev])
    lastLocalChangeAtRef.current = Date.now()
    setAmount('')
    setNote('')
    setFilterMonth(monthFromDateISO(date))
  }

  function deleteExpense(id: string) {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, deletedAt: Date.now(), updatedAt: Date.now() } : e)),
    )
    lastLocalChangeAtRef.current = Date.now()
  }

  function mergeByUpdatedAt(local: Expense[], remote: Expense[]): Expense[] {
    const map = new Map<string, Expense>()
    for (const e of local) map.set(e.id, e)
    for (const r of remote) {
      const existing = map.get(r.id)
      if (!existing || r.updatedAt > existing.updatedAt) map.set(r.id, r)
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function pullFromCloud(userId: string) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('expenses')
      .select('id, date, amount_cents, category, note, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    const remote: Expense[] =
      data?.map((row) => ({
        id: row.id as string,
        date: String(row.date),
        amountCents: Number(row.amount_cents),
        category: row.category as ExpenseCategory,
        note: String(row.note ?? ''),
        createdAt: new Date(String(row.created_at)).getTime(),
        updatedAt: new Date(String(row.updated_at)).getTime(),
        deletedAt: row.deleted_at ? new Date(String(row.deleted_at)).getTime() : null,
      })) ?? []
    setExpenses((prev) => mergeByUpdatedAt(prev, remote))
    setSyncState((s) => ({ ...s, lastPulledAt: Date.now() }))
  }

  async function pushToCloud(userId: string) {
    if (!supabase) return
    const rows = expenses.map((e) => ({
      id: e.id,
      user_id: userId,
      date: e.date,
      amount_cents: e.amountCents,
      category: e.category,
      note: e.note,
      created_at: new Date(e.createdAt).toISOString(),
      updated_at: new Date(e.updatedAt).toISOString(),
      deleted_at: e.deletedAt ? new Date(e.deletedAt).toISOString() : null,
    }))
    const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    setSyncState((s) => ({ ...s, lastPushedAt: Date.now() }))
  }

  async function syncNow() {
    if (!supabase || !user) return
    setSyncError(null)
    setSyncBusy(true)
    try {
      await pushToCloud(user.id)
      await pullFromCloud(user.id)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Unbekannter Sync-Fehler')
    } finally {
      setSyncBusy(false)
    }
  }

  function scheduleAutoSync() {
    if (!supabase || !user) return
    if (!hasInitialPull) return

    syncQueuedRef.current = true
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(async () => {
      // If another sync is in flight, keep it queued and retry shortly.
      if (syncBusy) {
        syncTimerRef.current = window.setTimeout(scheduleAutoSync, 800)
        return
      }
      if (!syncQueuedRef.current) return
      syncQueuedRef.current = false
      await syncNow()
    }, 900)
  }

  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false

    ;(async () => {
      setSyncBusy(true)
      setSyncError(null)
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
      syncQueuedRef.current = false
      try {
        await pullFromCloud(user.id)
      } catch (e) {
        if (!cancelled) setSyncError(e instanceof Error ? e.message : 'Unbekannter Sync-Fehler')
      } finally {
        if (!cancelled) setSyncBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!supabase || !user) return
    // Don't auto-sync if nothing changed locally since last push.
    if (!lastLocalChangeAtRef.current) return
    scheduleAutoSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, hasInitialPull, user?.id])

  useEffect(() => {
    if (!supabase || !user) return
    const onOnline = () => scheduleAutoSync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleAutoSync()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialPull, user?.id])

  // Auth actions are handled in the dedicated /login page.

  return (
    <BudgetContext.Provider
      value={{
        expenses,
        filteredExpenses,
        totalsByCategory,
        totalFiltered,
        filterMonth,
        setFilterMonth,
        date,
        setDate,
        amount,
        setAmount,
        category,
        setCategory,
        note,
        setNote,
        addExpense,
        deleteExpense,
        formatCents,
      }}
    >
      <div className="app">
        <header className="header">
          <div className="headerTitle">
            <h1>Budget</h1>
          </div>
          <div className="headerActions">
            <label className="field">
              <span>Monat</span>
              <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
            </label>
            <div className="stat">
              <div className="statLabel">Summe</div>
              <div className="statValue">{formatCents(totalFiltered)}</div>
            </div>
            {isSupabaseConfigured && user ? (
              <div className="profile" ref={profileRef}>
                <button
                  type="button"
                  className="ghost"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  Profil
                </button>
                {profileOpen ? (
                  <div className="profileMenu" role="menu" aria-label="Profil Menü">
                    <div className="profileEmail" role="presentation">
                      {user.email ?? '—'}
                    </div>
                    <button
                      type="button"
                      className="danger profileLogout"
                      role="menuitem"
                      onClick={async () => {
                        setProfileOpen(false)
                        await signOut()
                      }}
                    >
                      Abmelden
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <main className="layout">
          <aside className="sidebar" aria-label="Navigation">
            <div className="sidebarTitle">Seiten</div>
            <nav className="sidebarNav">
              <NavLink to="/app/home" className="sidebarLink">
                Home
              </NavLink>
              <NavLink to="/app/overview" className="sidebarLink">
                Übersicht
              </NavLink>
            </nav>
          </aside>
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </BudgetContext.Provider>
  )
}

export default App
