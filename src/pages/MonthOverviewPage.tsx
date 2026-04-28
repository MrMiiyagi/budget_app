import { useBudget } from '../budget/budgetContext'

export default function MonthOverviewPage() {
  const { totalsByCategory, filteredExpenses, deleteExpense, formatCents } = useBudget()

  return (
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
  )
}

