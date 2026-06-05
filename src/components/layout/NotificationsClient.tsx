'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCheck } from 'lucide-react'
import type { Notification } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

interface NotificationsClientProps {
  notifications: Notification[]
  userId: string
}

export function NotificationsClient({ notifications: initial, userId }: NotificationsClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [notifications, setNotifications] = useState(initial)

  useEffect(() => {
    const unreadIds = initial.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length > 0) {
      void supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .then(() => {
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        })
    }

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [supabase, userId, initial])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.length > 0 && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> All marked as read
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Bell className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-400">No notifications yet. You&apos;ll be notified when calendar members make changes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`bg-white rounded-xl border p-4 transition-all ${
                !notif.is_read ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.is_read ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                  {notif.body && <p className="text-sm text-gray-500 mt-0.5">{notif.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
