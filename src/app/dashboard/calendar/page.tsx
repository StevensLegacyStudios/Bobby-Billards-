import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { CalendarWithMembers, Child } from '@/lib/types'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id, role')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const [calendarsRes, childrenRes] = await Promise.all([
    calendarIds.length
      ? supabase
          .from('calendars')
          .select('*, calendar_members(*, profiles(*))')
          .in('id', calendarIds)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase.from('children').select('*').in('calendar_id', calendarIds)
      : Promise.resolve({ data: [] }),
  ])

  const calendars = (calendarsRes.data ?? []) as CalendarWithMembers[]
  const children = (childrenRes.data ?? []) as Child[]

  if (!calendars.length) {
    redirect('/dashboard/settings')
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 pb-0 flex items-center justify-between border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
        <div className="flex gap-2">
          {calendars.map(cal => (
            <div key={cal.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cal.theme_color }} />
              {cal.name}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 min-h-0">
        <CalendarView calendars={calendars} childProfiles={children} userId={user.id} />
      </div>
    </div>
  )
}
