import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DollarSign } from 'lucide-react'
import { ExpensesClient } from '@/components/expenses/ExpensesClient'
import type { Expense, Child, Profile, Calendar } from '@/lib/types'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  if (!calendarIds.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No calendar yet</h2>
        <p className="text-gray-500">Create a calendar first to track expenses.</p>
      </div>
    )
  }

  const [expensesRes, childrenRes, calendarsRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .in('calendar_id', calendarIds)
      .order('expense_date', { ascending: false }),
    supabase.from('children').select('*').in('calendar_id', calendarIds),
    supabase.from('calendars').select('*').in('id', calendarIds),
  ])

  const expenses = (expensesRes.data ?? []) as Expense[]
  const children = (childrenRes.data ?? []) as Child[]
  const calendars = (calendarsRes.data ?? []) as Calendar[]

  return (
    <ExpensesClient
      expenses={expenses}
      children={children}
      calendars={calendars}
      userId={user.id}
      calendarIds={calendarIds}
    />
  )
}
