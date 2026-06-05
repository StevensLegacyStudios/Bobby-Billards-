'use client'

import dynamic from 'next/dynamic'
import type { CalendarWithMembers, Child } from '@/lib/types'

const CalendarView = dynamic(
  () => import('./CalendarView').then(m => ({ default: m.CalendarView })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-100 rounded-2xl h-full min-h-[500px]" />
    ),
  }
)

interface CalendarWrapperProps {
  calendars: CalendarWithMembers[]
  childProfiles: Child[]
  userId: string
}

export function CalendarWrapper({ calendars, childProfiles, userId }: CalendarWrapperProps) {
  return <CalendarView calendars={calendars} childProfiles={childProfiles} userId={userId} />
}
