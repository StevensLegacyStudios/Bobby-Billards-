'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarHeart,
  CalendarDays,
  Users,
  DollarSign,
  Activity,
  LogOut,
  Bell,
  Baby,
  ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: CalendarDays, label: 'Dashboard' },
  { href: '/dashboard/calendar', icon: CalendarHeart, label: 'Calendar' },
  { href: '/dashboard/children', icon: Baby, label: 'Children' },
  { href: '/dashboard/expenses', icon: DollarSign, label: 'Expenses' },
  { href: '/dashboard/activity', icon: Activity, label: 'Activity Log' },
  { href: '/dashboard/handoffs', icon: ClipboardList, label: 'Handoffs' },
]

interface SidebarProps {
  unreadCount?: number
}

export function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <CalendarHeart className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight">CoParent</p>
            <p className="text-xs text-gray-400">Family Scheduler</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}

        <Link
          href="/dashboard/notifications"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            pathname === '/dashboard/notifications'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/dashboard/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            pathname === '/dashboard/settings'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          Members & Settings
        </Link>
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
