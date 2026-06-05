import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/layout/SettingsClient'
import type { CalendarWithMembers, Profile } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id, role')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const { data: calendars } = calendarIds.length
    ? await supabase
        .from('calendars')
        .select('*, calendar_members(*, profiles(*))')
        .in('id', calendarIds)
    : { data: [] }

  return (
    <SettingsClient
      currentUser={profile as Profile}
      calendars={(calendars ?? []) as CalendarWithMembers[]}
      userId={user.id}
    />
  )
}
