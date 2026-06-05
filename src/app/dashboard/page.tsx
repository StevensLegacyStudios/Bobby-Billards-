import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Baby, DollarSign, Plus, ArrowRight, CalendarHeart } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'
import type { CalendarEvent, Expense, Calendar, ActivityLog } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's calendars
  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id, role')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const [calendarsRes, upcomingRes, recentActivityRes, expensesRes, childrenCountRes] = await Promise.all([
    calendarIds.length
      ? supabase.from('calendars').select('*').in('id', calendarIds)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase
          .from('events')
          .select('*')
          .in('calendar_id', calendarIds)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase
          .from('activity_log')
          .select('*, profiles(full_name, avatar_url)')
          .in('calendar_id', calendarIds)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase
          .from('expenses')
          .select('*')
          .in('calendar_id', calendarIds)
          .eq('status', 'pending')
          .limit(5)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase
          .from('children')
          .select('*', { count: 'exact', head: true })
          .in('calendar_id', calendarIds)
      : Promise.resolve({ count: 0 }),
  ])

  const calendars = (calendarsRes.data ?? []) as Calendar[]
  const upcoming = (upcomingRes.data ?? []) as CalendarEvent[]
  const recentActivity = (recentActivityRes.data ?? []) as (ActivityLog & { profiles?: { full_name: string | null; avatar_url: string | null } })[]
  const pendingExpenses = (expensesRes.data ?? []) as Expense[]
  const childrenCount = childrenCountRes.count ?? 0

  const hasCalendar = calendars.length > 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(new Date())}</p>
        </div>
        {hasCalendar && (
          <Link
            href="/dashboard/calendar"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </Link>
        )}
      </div>

      {!hasCalendar ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
            <CalendarHeart className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Create your family calendar</h2>
          <p className="text-gray-500 max-w-sm mb-6">
            Set up a shared calendar to coordinate schedules, track children&apos;s info, and keep everyone in sync.
          </p>
          <Link
            href="/dashboard/settings"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Create Calendar
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats row */}
          <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Calendars', value: calendars.length, icon: CalendarDays, href: '/dashboard/settings', color: 'indigo' },
              { label: 'Children', value: childrenCount, icon: Baby, href: '/dashboard/children', color: 'purple' },
              { label: 'Upcoming Events', value: upcoming.length, icon: CalendarDays, href: '/dashboard/calendar', color: 'blue' },
              { label: 'Pending Expenses', value: pendingExpenses.length, icon: DollarSign, href: '/dashboard/expenses', color: 'green' },
            ].map(({ label, value, icon: Icon, href, color }) => (
              <Link
                key={label}
                href={href}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-indigo-200 transition-colors group"
              >
                <div className={`w-9 h-9 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 text-${color}-600`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </Link>
            ))}
          </div>

          {/* Upcoming Events */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upcoming Events</h2>
              <Link href="/dashboard/calendar" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(event => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div
                      className="w-1 h-full min-h-[36px] rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: event.color || '#4F46E5' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(event.start_time, 'EEE, MMM d · h:mm a')}</p>
                      {event.location && (
                        <p className="text-xs text-gray-400 truncate">{event.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              <Link href="/dashboard/activity" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(log => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-500">
                      {(log.profiles?.full_name?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">{log.profiles?.full_name ?? 'Someone'}</span>{' '}
                        {log.action} a {log.resource_type}
                        {(log.details as Record<string, string>)?.title ? `: ${(log.details as Record<string, string>).title}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Expenses */}
          {pendingExpenses.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Pending Expenses</h2>
                <Link href="/dashboard/expenses" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingExpenses.map(expense => (
                  <div key={expense.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(expense.expense_date)} · {expense.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">${expense.amount.toFixed(2)}</p>
                      <p className="text-xs text-amber-600">Pending</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
