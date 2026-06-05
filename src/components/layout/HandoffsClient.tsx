'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, ClipboardList } from 'lucide-react'
import type { HandoffLog, Child, Profile } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

interface HandoffsClientProps {
  handoffs: HandoffLog[]
  childProfiles: Child[]
  profiles: Profile[]
  userId: string
  calendarIds: string[]
}

export function HandoffsClient({ handoffs: initial, childProfiles, profiles, userId, calendarIds }: HandoffsClientProps) {
  const supabase = createClient()
  const [handoffs, setHandoffs] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    calendar_id: calendarIds[0] ?? '',
    handoff_time: new Date().toISOString().slice(0, 16),
    location: '',
    from_parent: '',
    to_parent: '',
    child_ids: [] as string[],
    notes: '',
  })

  function update(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleChild(id: string) {
    setForm(prev => ({
      ...prev,
      child_ids: prev.child_ids.includes(id)
        ? prev.child_ids.filter(c => c !== id)
        : [...prev.child_ids, id],
    }))
  }

  async function handleSave() {
    if (!form.handoff_time || !form.calendar_id) {
      setError('Time and calendar are required')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('handoff_logs')
      .insert({
        calendar_id: form.calendar_id,
        handoff_time: new Date(form.handoff_time).toISOString(),
        location: form.location || null,
        from_parent: form.from_parent || null,
        to_parent: form.to_parent || null,
        child_ids: form.child_ids,
        notes: form.notes || null,
        logged_by: userId,
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
    } else {
      setHandoffs(prev => [data as HandoffLog, ...prev])
      setShowForm(false)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Custody Handoffs</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Handoff
        </button>
      </div>

      {handoffs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">No handoffs logged yet</p>
          <p className="text-gray-400 text-sm">Keep a timestamped record of every custody exchange.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {handoffs.map(handoff => {
            const involvedChildren = childProfiles.filter(c => handoff.child_ids.includes(c.id))
            const fromParent = profiles.find(p => p.id === handoff.from_parent)
            const toParent = profiles.find(p => p.id === handoff.to_parent)

            return (
              <div key={handoff.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{formatDateTime(handoff.handoff_time)}</p>
                    {handoff.location && (
                      <p className="text-xs text-gray-400 mt-0.5">📍 {handoff.location}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      {fromParent && <span className="font-medium">{fromParent.full_name}</span>}
                      {fromParent && toParent && <span className="text-gray-400">→</span>}
                      {toParent && <span className="font-medium">{toParent.full_name}</span>}
                    </div>
                    {involvedChildren.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {involvedChildren.map(c => (
                          <span key={c.id} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                            {c.first_name}
                          </span>
                        ))}
                      </div>
                    )}
                    {handoff.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">{handoff.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Log Handoff</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={form.handoff_time}
                  onChange={e => update('handoff_time', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={form.location}
                  onChange={e => update('location', e.target.value)}
                  placeholder="e.g., School parking lot"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.from_parent}
                    onChange={e => update('from_parent', e.target.value)}
                  >
                    <option value="">Select parent</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={form.to_parent}
                    onChange={e => update('to_parent', e.target.value)}
                  >
                    <option value="">Select parent</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {childProfiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
                  <div className="flex flex-wrap gap-2">
                    {childProfiles.map(child => (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Log Handoff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
