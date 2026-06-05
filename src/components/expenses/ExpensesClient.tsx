'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, AlertCircle, Check, FileText } from 'lucide-react'
import type { Expense, Child, Calendar, ExpenseCategory, ExpenseStatus } from '@/lib/types'
import { formatDate, formatCurrency } from '@/lib/utils'

const CATEGORIES: ExpenseCategory[] = ['medical', 'dental', 'school', 'activity', 'clothing', 'food', 'general']
const STATUS_COLORS: Record<ExpenseStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  disputed: 'bg-red-50 text-red-700',
  settled: 'bg-green-50 text-green-700',
}

interface ExpensesClientProps {
  expenses: Expense[]
  childProfiles: Child[]
  calendars: Calendar[]
  userId: string
  calendarIds: string[]
}

export function ExpensesClient({ expenses: initial, childProfiles, userId, calendarIds }: ExpensesClientProps) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    amount: '',
    category: 'general' as ExpenseCategory,
    child_id: '',
    calendar_id: calendarIds[0] ?? '',
    split_percentage: '50',
    expense_date: new Date().toISOString().slice(0, 10),
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.title || !form.amount || !form.expense_date) {
      setError('Title, amount, and date are required')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('expenses')
      .insert({
        title: form.title,
        description: form.description || null,
        amount: parseFloat(form.amount),
        category: form.category,
        child_id: form.child_id || null,
        calendar_id: form.calendar_id,
        paid_by: userId,
        split_percentage: parseFloat(form.split_percentage),
        expense_date: form.expense_date,
        status: 'pending',
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
    } else {
      setExpenses(prev => [data as Expense, ...prev])
      setShowForm(false)
      setForm({ title: '', description: '', amount: '', category: 'general', child_id: '', calendar_id: calendarIds[0] ?? '', split_percentage: '50', expense_date: new Date().toISOString().slice(0, 10) })
    }
    setLoading(false)
  }

  async function updateStatus(id: string, status: ExpenseStatus) {
    await supabase.from('expenses').update({ status }).eq('id', id)
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  const filtered = filterStatus === 'all' ? expenses : expenses.filter(e => e.status === filterStatus)

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0)
  const myShare = totalPending * 0.5

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pending', value: formatCurrency(totalPending), color: 'amber' },
          { label: 'Your Share (50%)', value: formatCurrency(myShare), color: 'indigo' },
          { label: 'Settled', value: expenses.filter(e => e.status === 'settled').length, color: 'green', suffix: ' items' },
          { label: 'Disputed', value: expenses.filter(e => e.status === 'disputed').length, color: 'red', suffix: ' items' },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{value}{suffix}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'approved', 'disputed', 'settled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Expense list */}
      <div className="bg-white rounded-2xl border border-gray-100">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No expenses found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(expense => {
              const child = childProfiles.find(c => c.id === expense.child_id)
              const myAmount = expense.amount * (expense.split_percentage / 100)
              return (
                <div key={expense.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-gray-900 text-sm">{expense.title}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[expense.status]}`}>
                        {expense.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDate(expense.expense_date)} · {expense.category}
                      {child && ` · ${child.first_name}`}
                    </p>
                    {expense.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{expense.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">{formatCurrency(expense.amount)}</p>
                      <p className="text-xs text-gray-400">Your share: {formatCurrency(myAmount)}</p>
                    </div>
                    {expense.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateStatus(expense.id, 'approved')}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateStatus(expense.id, 'disputed')}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          title="Dispute"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {expense.status === 'approved' && (
                      <button
                        onClick={() => updateStatus(expense.id, 'settled')}
                        className="px-2 py-1 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        Mark Settled
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Expense</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="e.g., Doctor co-pay"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.amount}
                    onChange={e => update('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.expense_date}
                    onChange={e => update('expense_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.category}
                    onChange={e => update('category', e.target.value)}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Split %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.split_percentage}
                    onChange={e => update('split_percentage', e.target.value)}
                  />
                </div>
              </div>
              {childProfiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">For Child</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.child_id}
                    onChange={e => update('child_id', e.target.value)}
                  >
                    <option value="">Not specific to a child</option>
                    {childProfiles.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Optional details..."
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
