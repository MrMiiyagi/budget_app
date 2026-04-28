import { useRef } from 'react'
import { CATEGORIES, useBudget } from '../budget/budgetContext'

export default function HomePage() {
  const {
    date,
    setDate,
    amount,
    setAmount,
    category,
    setCategory,
    note,
    setNote,
    addExpense,
  } = useBudget()

  const amountInputRef = useRef<HTMLInputElement | null>(null)

  return (
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
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
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
          <button
            type="button"
            className="primary"
            onClick={() => {
              addExpense()
              amountInputRef.current?.focus()
            }}
          >
            Hinzufügen
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              // Reset minimal: amount + note
              setAmount('')
              setNote('')
              amountInputRef.current?.focus()
            }}
          >
            Zurücksetzen
          </button>
        </div>
      </div>
    </section>
  )
}

