import { createContext, useContext } from 'react'

export type ExpenseCategory =
  | 'Lebensmittel'
  | 'Miete'
  | 'Transport'
  | 'Freizeit'
  | 'Abos'
  | 'Gesundheit'
  | 'Shopping'
  | 'Sonstiges'

export type Expense = {
  id: string
  date: string // YYYY-MM-DD
  amountCents: number
  category: ExpenseCategory
  note: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export const CATEGORIES: ExpenseCategory[] = [
  'Lebensmittel',
  'Miete',
  'Transport',
  'Freizeit',
  'Abos',
  'Gesundheit',
  'Shopping',
  'Sonstiges',
]

export type TotalsByCategoryItem = { category: ExpenseCategory; totalCents: number }

export type BudgetContextValue = {
  expenses: Expense[]
  filteredExpenses: Expense[]
  totalsByCategory: TotalsByCategoryItem[]
  totalFiltered: number

  filterMonth: string
  setFilterMonth(month: string): void

  date: string
  setDate(v: string): void
  amount: string
  setAmount(v: string): void
  category: ExpenseCategory
  setCategory(v: ExpenseCategory): void
  note: string
  setNote(v: string): void

  addExpense(): void
  deleteExpense(id: string): void

  formatCents(cents: number): string
}

export const BudgetContext = createContext<BudgetContextValue | null>(null)

export function useBudget() {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget muss innerhalb von <BudgetContext.Provider> verwendet werden.')
  return ctx
}

