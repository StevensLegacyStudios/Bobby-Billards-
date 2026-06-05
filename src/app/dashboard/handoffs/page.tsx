import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HandoffsClient } from '@/components/layout/HandoffsClient'
import type { HandoffLog, Child, Profile } from '@/lib/types'

export default async function HandoffsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const [handoffsRes, childrenRes, profilesRes] = await Promise.all([
    calendarIds.length
      ? supabase
          .from('handoff_logs')
          .select('*')
          .in('calendar_id', calendarIds)
          .order('handoff_time', { ascending: false })
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase.from('children').select('*').in('calendar_id', calendarIds)
      : Promise.resolve({ data: [] }),
    calendarIds.length
      ? supabase.from('profiles').select('*')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <HandoffsClient
      handoffs={(handoffsRes.data ?? []) as HandoffLog[]}
      childProfiles={(childrenRes.data ?? []) as Child[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
      userId={user.id}
      calendarIds={calendarIds}
    />
  )
}
