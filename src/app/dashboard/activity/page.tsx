import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { timeAgo, formatDateTime } from '@/lib/utils'

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const { data: logs } = calendarIds.length
    ? await supabase
        .from('activity_log')
        .select('*, profiles(full_name, avatar_url)')
        .in('calendar_id', calendarIds)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  const allLogs = logs ?? []

  const ACTION_ICONS: Record<string, string> = {
    created: '✨',
    updated: '✏️',
    deleted: '🗑️',
  }

  const RESOURCE_LABELS: Record<string, string> = {
    event: 'event',
    child: 'child profile',
    expense: 'expense',
    handoff: 'handoff',
    medication: 'medication',
    document: 'document',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <span className="text-sm text-gray-400">Full audit trail of all changes</span>
      </div>

      {allLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-400">No activity yet. Changes to events, children, and expenses will appear here.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-4">
            {allLogs.map((log: {
              id: string;
              action: string;
              resource_type: string;
              details: Record<string, string>;
              created_at: string;
              profiles?: { full_name: string | null; avatar_url: string | null };
            }) => {
              const icon = ACTION_ICONS[log.action] ?? '•'
              const resourceLabel = RESOURCE_LABELS[log.resource_type] ?? log.resource_type
              const title = (log.details as Record<string, string>)?.title

              return (
                <div key={log.id} className="flex items-start gap-4 relative">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg z-10 flex-shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.profiles?.full_name ?? 'Someone'}</span>{' '}
                          <span className="text-gray-500">{log.action} a {resourceLabel}</span>
                          {title && (
                            <span className="text-gray-900 font-medium">: {title}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5" title={formatDateTime(log.created_at)}>
                          {timeAgo(log.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
