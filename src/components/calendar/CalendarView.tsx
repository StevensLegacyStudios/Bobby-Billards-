'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core'
import type { CalendarEvent, CalendarWithMembers, Child } from '@/lib/types'
import { EVENT_TYPE_COLORS } from '@/lib/types'
import { EventModal } from './EventModal'
import { createClient } from '@/lib/supabase/client'

interface CalendarViewProps {
  calendars: CalendarWithMembers[]
  childProfiles: Child[]
  userId: string
}

export function CalendarView({ calendars, childProfiles, userId }: CalendarViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const calRef = useRef<FullCalendar>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [newEventSlot, setNewEventSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const calendarIds = useMemo(() => calendars.map(c => c.id), [calendars])

  useEffect(() => {
    if (!calendarIds.length) return

    let cancelled = false

    async function fetchEvents() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .in('calendar_id', calendarIds)
      if (!cancelled) setEvents((data ?? []) as CalendarEvent[])
    }

    void fetchEvents()

    const channel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        void fetchEvents()
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [calendarIds, supabase])

  const fcEvents = events.map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ev.start_time,
    end: ev.end_time,
    allDay: ev.is_all_day,
    backgroundColor: ev.color || EVENT_TYPE_COLORS[ev.event_type] || '#4F46E5',
    borderColor: ev.color || EVENT_TYPE_COLORS[ev.event_type] || '#4F46E5',
    extendedProps: { event: ev },
  }))

  function handleEventClick(arg: EventClickArg) {
    setSelectedEvent(arg.event.extendedProps.event as CalendarEvent)
    setNewEventSlot(null)
    setModalOpen(true)
  }

  function handleDateSelect(arg: DateSelectArg) {
    setNewEventSlot({ start: arg.start, end: arg.end })
    setSelectedEvent(null)
    setModalOpen(true)
  }

  async function reloadEvents() {
    if (!calendarIds.length) return
    const { data } = await supabase.from('events').select('*').in('calendar_id', calendarIds)
    setEvents((data ?? []) as CalendarEvent[])
  }

  return (
    <div className="h-full">
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        events={fcEvents}
        editable={false}
        selectable
        select={handleDateSelect}
        eventClick={handleEventClick}
        height="100%"
        nowIndicator
      />

      {modalOpen && (
        <EventModal
          calendars={calendars}
          childProfiles={childProfiles}
          userId={userId}
          event={selectedEvent}
          defaultSlot={newEventSlot}
          onClose={() => setModalOpen(false)}
          onSaved={() => { void reloadEvents(); setModalOpen(false) }}
        />
      )}
    </div>
  )
}
