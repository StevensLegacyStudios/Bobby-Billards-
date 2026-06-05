import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ChildProfileClient } from '@/components/children/ChildProfileClient'
import type { Child, ChildMedication, GrowthRecord, ChildDocument } from '@/lib/types'

export default async function ChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (id === 'new') {
    // Get calendars to create child in
    const { data: memberRows } = await supabase
      .from('calendar_members')
      .select('calendar_id')
      .eq('user_id', user.id)
    const calendarIds = memberRows?.map(m => m.calendar_id) ?? []
    const { data: calendars } = calendarIds.length
      ? await supabase.from('calendars').select('*').in('id', calendarIds)
      : { data: [] }

    return (
      <ChildProfileClient
        child={null}
        calendars={calendars ?? []}
        medications={[]}
        growthRecords={[]}
        documents={[]}
        userId={user.id}
      />
    )
  }

  const [childRes, medsRes, growthRes, docsRes] = await Promise.all([
    supabase.from('children').select('*').eq('id', id).single(),
    supabase.from('child_medications').select('*').eq('child_id', id).order('created_at', { ascending: false }),
    supabase.from('child_growth_records').select('*').eq('child_id', id).order('recorded_date', { ascending: true }),
    supabase.from('child_documents').select('*').eq('child_id', id).order('created_at', { ascending: false }),
  ])

  if (!childRes.data) notFound()

  return (
    <ChildProfileClient
      child={childRes.data as Child}
      calendars={[]}
      medications={(medsRes.data ?? []) as ChildMedication[]}
      growthRecords={(growthRes.data ?? []) as GrowthRecord[]}
      documents={(docsRes.data ?? []) as ChildDocument[]}
      userId={user.id}
    />
  )
}
