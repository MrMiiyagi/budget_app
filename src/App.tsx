import './App.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type ExpenseCategory =
  | 'Lebensmittel'
  | 'Miete'
  | 'Transport'
  | 'Freizeit'
  | 'Abos'
  | 'Gesundheit'
  | 'Shopping'
  | 'Sonstiges'

type Expense = {
  id: string
  date: string // YYYY-MM-DD
  amountCents: number
  category: ExpenseCategory
  note: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

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

const CATEGORIES: ExpenseCategory[] = [
  'Lebensmittel',
  'Miete',
  'Transport',
  'Freizeit',
  'Abos',
  'Gesundheit',
  'Shopping',
  'Sonstiges',
]

function App() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses())
  const [syncState, setSyncState] = useState<SyncState>(() => loadSyncState())
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const initial = expenses[0]?.date ? monthFromDateISO(expenses[0].date) : monthFromDateISO(todayISO())
    return initial
  })

  const { user, signOut } = useAuth()
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)

  const [date, setDate] = useState<string>(() => todayISO())
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<ExpenseCategory>('Lebensmittel')
  const [note, setNote] = useState<string>('')
  const amountInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    saveExpenses(expenses)
  }, [expenses])

  useEffect(() => {
    saveSyncState(syncState)
  }, [syncState])

  const shouldRedirectToLogin = isSupabaseConfigured && !user

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
      amountInputRef.current?.focus()
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
    setAmount('')
    setNote('')
    setFilterMonth(monthFromDateISO(date))
    amountInputRef.current?.focus()
  }

  function deleteExpense(id: string) {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, deletedAt: Date.now(), updatedAt: Date.now() } : e)),
    )
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

  // Auth actions are handled in the dedicated /login page.

  return (
    <div className="app">
      {shouldRedirectToLogin ? <Navigate to="/login" replace state={{ from: '/app' }} /> : null}
      <header className="header">
        <div className="headerTitle">
          <h1>Budget</h1>
          <p className="muted">
            Ausgaben erfassen, filtern und summieren ({isSupabaseConfigured ? 'mit optionalem Sync' : 'lokal gespeichert'}
            ).
          </p>
        </div>
        <div className="headerActions">
          <label className="field">
            <span>Monat</span>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </label>
          <div className="stat">
            <div className="statLabel">Summe</div>
            <div className="statValue">{formatCents(totalFiltered)}</div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Neue Ausgabe</h2>
          <div className="form">
            <label className="field">
              <span>Datum</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="field">
              <span>Betrag</span>
              <input
                ref={amountInputRef}
                inputMode="decimal"
                placeholder="z. B. 12,50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addExpense()
                }}
              />
              <span className="hint">Komma oder Punkt ist ok.</span>
            </label>

            <label className="field">
              <span>Kategorie</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="field wide">
              <span>Notiz (optional)</span>
              <input
                placeholder="z. B. Supermarkt, Ticket, ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addExpense()
                }}
              />
            </label>

            <div className="formActions">
              <button type="button" className="primary" onClick={addExpense}>
                Hinzufügen
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDate(todayISO())
                  setAmount('')
                  setCategory('Lebensmittel')
                  setNote('')
                  amountInputRef.current?.focus()
                }}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Account & Sync</h2>
          {!isSupabaseConfigured ? (
            <p className="muted">
              Sync ist noch nicht konfiguriert. Lege eine <code>.env</code> an (siehe <code>.env.example</code>) und trage
              deine Supabase Keys ein.
            </p>
          ) : (
            <div className="stack">
              <div className="row">
                <div>
                  <div className="statLabel">Angemeldet als</div>
                  <div className="strong">{user?.email}</div>
                </div>
                <button type="button" className="ghost" onClick={signOut}>
                  Abmelden
                </button>
              </div>

              <div className="muted">
                Letzter Pull: {syncState.lastPulledAt ? new Date(syncState.lastPulledAt).toLocaleString('de-DE') : '—'}
                <br />
                Letzter Push: {syncState.lastPushedAt ? new Date(syncState.lastPushedAt).toLocaleString('de-DE') : '—'}
              </div>

              <div className="row">
                <button type="button" className="primary" onClick={syncNow} disabled={syncBusy}>
                  {syncBusy ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
                </button>
                <span className="hint">Local-first: deine Daten bleiben auch offline nutzbar.</span>
              </div>
              {syncError ? <p className="error">{syncError}</p> : null}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Übersicht</h2>
          {totalsByCategory.length > 0 ? (
            <div className="chips">
              {totalsByCategory.map((x) => (
                <div key={x.category} className="chip" title={x.category}>
                  <span className="chipLabel">{x.category}</span>
                  <span className="chipValue">{formatCents(x.totalCents)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Für diesen Monat gibt es noch keine Ausgaben.</p>
          )}

          <div className="tableWrap" role="region" aria-label="Ausgaben Tabelle">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Kategorie</th>
                  <th>Notiz</th>
                  <th className="right">Betrag</th>
                  <th className="right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{e.date}</td>
                    <td>{e.category}</td>
                    <td className="muted">{e.note || '—'}</td>
                    <td className="right strong">{formatCents(e.amountCents)}</td>
                    <td className="right">
                      <button type="button" className="danger" onClick={() => deleteExpense(e.id)}>
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="muted">
          Tipp: Du kannst den Monat oben wechseln. Mit Supabase kannst du zusätzlich zwischen Geräten synchronisieren.
        </span>
      </footer>
    </div>
  )
}

export default App
