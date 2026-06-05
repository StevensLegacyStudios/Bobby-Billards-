'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Trash2, AlertCircle } from 'lucide-react'
import type { CalendarEvent, CalendarWithMembers, Child, EventType } from '@/lib/types'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/types'

const CUSTODY_PATTERNS = [
  { value: 'every_weekend', label: 'Every Weekend (Sat–Sun)', rrule: 'FREQ=WEEKLY;BYDAY=SA,SU' },
  { value: 'every_other_weekend', label: 'Every Other Weekend', rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,SU' },
  { value: '50_50_weekly', label: '50/50 — Weekly alternating', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { value: '2nd_4th_weekend', label: '2nd & 4th Weekend', rrule: 'FREQ=MONTHLY;BYDAY=2SA,2SU,4SA,4SU' },
  { value: '2nd_4th_5th_weekend', label: '2nd, 4th & 5th Weekend', rrule: 'FREQ=MONTHLY;BYDAY=2SA,2SU,4SA,4SU,5SA,5SU' },
  { value: 'custom', label: 'Custom RRULE...', rrule: '' },
]

interface EventModalProps {
  calendars: CalendarWithMembers[]
  childProfiles: Child[]
  userId: string
  event: CalendarEvent | null
  defaultSlot: { start: Date; end: Date } | null
  onClose: () => void
  onSaved: () => void
}

function toLocalDatetime(d: Date | string) {
  const dt = new Date(d)
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function EventModal({ calendars, childProfiles, userId, event, defaultSlot, onClose, onSaved }: EventModalProps) {
  const supabase = createClient()
  const isEdit = !!event

  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    location: event?.location ?? '',
    calendar_id: event?.calendar_id ?? (calendars[0]?.id ?? ''),
    start_time: event ? toLocalDatetime(event.start_time) : (defaultSlot ? toLocalDatetime(defaultSlot.start) : ''),
    end_time: event ? toLocalDatetime(event.end_time) : (defaultSlot ? toLocalDatetime(defaultSlot.end) : ''),
    is_all_day: event?.is_all_day ?? false,
    event_type: (event?.event_type ?? 'general') as EventType,
    color: event?.color ?? '',
    notes: event?.notes ?? '',
    child_ids: event?.child_ids ?? [] as string[],
    rrule: event?.rrule ?? '',
    custody_pattern: 'custom',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function update(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleChild(childId: string) {
    setForm(prev => ({
      ...prev,
      child_ids: prev.child_ids.includes(childId)
        ? prev.child_ids.filter(id => id !== childId)
        : [...prev.child_ids, childId],
    }))
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_time || !form.end_time || !form.calendar_id) {
      setError('Title, calendar, start and end time are required')
      return
    }

    setLoading(true)
    setError('')

    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      location: form.location || null,
      calendar_id: form.calendar_id,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      is_all_day: form.is_all_day,
      event_type: form.event_type,
      color: form.color || null,
      notes: form.notes || null,
      child_ids: form.child_ids,
      rrule: form.rrule || null,
      created_by: userId,
    }

    const { error: err } = isEdit
      ? await supabase.from('events').update(payload).eq('id', event!.id)
      : await supabase.from('events').insert(payload)

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      onSaved()
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    setLoading(true)
    await supabase.from('events').delete().eq('id', event!.id)
    onSaved()
  }

  const calendarChildren = childProfiles.filter(c => c.calendar_id === form.calendar_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Event title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calendar *</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form.calendar_id}
                onChange={e => update('calendar_id', e.target.value)}
              >
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form.event_type}
                onChange={e => update('event_type', e.target.value as EventType)}
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all-day"
              checked={form.is_all_day}
              onChange={e => update('is_all_day', e.target.checked)}
              className="rounded border-gray-300 text-indigo-600"
            />
            <label htmlFor="all-day" className="text-sm text-gray-700">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start *</label>
              <input
                type={form.is_all_day ? 'date' : 'datetime-local'}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form.start_time}
                onChange={e => update('start_time', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End *</label>
              <input
                type={form.is_all_day ? 'date' : 'datetime-local'}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form.end_time}
                onChange={e => update('end_time', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Pattern</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={form.custody_pattern}
              onChange={e => {
                const pattern = CUSTODY_PATTERNS.find(p => p.value === e.target.value)
                update('custody_pattern', e.target.value)
                if (pattern && pattern.value !== 'custom') update('rrule', pattern.rrule)
              }}
            >
              <option value="custom">None / Custom</option>
              {CUSTODY_PATTERNS.filter(p => p.value !== 'custom').map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {(form.custody_pattern === 'custom' || form.rrule) && (
              <input
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                value={form.rrule}
                onChange={e => update('rrule', e.target.value)}
                placeholder="RRULE:FREQ=WEEKLY;BYDAY=SA,SU"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={form.location}
              onChange={e => update('location', e.target.value)}
              placeholder="Location (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color || EVENT_TYPE_COLORS[form.event_type]}
                onChange={e => update('color', e.target.value)}
                className="w-10 h-8 rounded border border-gray-200 cursor-pointer"
              />
              <div className="flex gap-2">
                {Object.entries(EVENT_TYPE_COLORS).map(([, color]) => (
                  <button
                    key={color}
                    onClick={() => update('color', color)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: color, borderColor: form.color === color ? '#1e1b4b' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {calendarChildren.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Children involved</label>
              <div className="flex flex-wrap gap-2">
                {calendarChildren.map(child => (
                  <button
                    key={child.id}
                    onClick={() => toggleChild(child.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      form.child_ids.includes(child.id)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {child.first_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Add details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Private notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100">
          {isEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Delete this event?</span>
                <button onClick={handleDelete} disabled={loading} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                  Confirm
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )
          ) : <div />}

          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
