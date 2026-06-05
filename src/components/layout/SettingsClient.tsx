'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, UserPlus, Settings, Palette } from 'lucide-react'
import type { CalendarWithMembers, Profile } from '@/lib/types'
import { getInitials } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const THEME_COLORS = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0891B2',
  '#059669', '#16A34A', '#D97706', '#DC2626',
  '#DB2777', '#9333EA', '#0F172A', '#6B7280',
]

interface SettingsClientProps {
  currentUser: Profile
  calendars: CalendarWithMembers[]
  userId: string
}

export function SettingsClient({ currentUser, calendars: initial, userId }: SettingsClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [calendars, setCalendars] = useState(initial)
  const [showCreateCal, setShowCreateCal] = useState(false)
  const [showInvite, setShowInvite] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [calForm, setCalForm] = useState({ name: '', description: '', theme_color: '#4F46E5' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [profileForm, setProfileForm] = useState({
    full_name: currentUser?.full_name ?? '',
    phone: currentUser?.phone ?? '',
  })

  async function createCalendar() {
    if (!calForm.name.trim()) { setError('Calendar name is required'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('calendars')
      .insert({ name: calForm.name, description: calForm.description || null, theme_color: calForm.theme_color, created_by: userId })
      .select('*, calendar_members(*, profiles(*))')
      .single()

    if (err) {
      setError(err.message)
    } else {
      setCalendars(prev => [...prev, data as CalendarWithMembers])
      setShowCreateCal(false)
      setCalForm({ name: '', description: '', theme_color: '#4F46E5' })
      router.refresh()
    }
    setLoading(false)
  }

  async function sendInvite(calendarId: string) {
    if (!inviteEmail.trim()) { setError('Email is required'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase
      .from('calendar_invitations')
      .insert({ calendar_id: calendarId, invited_email: inviteEmail, invited_by: userId, role: inviteRole })

    if (err) {
      setError(err.message)
    } else {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setShowInvite(null)
      setInviteEmail('')
    }
    setLoading(false)
  }

  async function updateProfile() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: profileForm.full_name, phone: profileForm.phone || null })
      .eq('id', userId)

    if (err) {
      setError(err.message)
    } else {
      setSuccess('Profile updated')
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Members & Settings</h1>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">{success}</div>
      )}

      {/* Profile section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" /> My Profile
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={profileForm.full_name}
              onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={profileForm.phone}
              onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="(555) 555-5555"
            />
          </div>
        </div>
        <button
          onClick={updateProfile}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          Save Profile
        </button>
      </div>

      {/* Calendars section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 text-lg">Calendars</h2>
          <button
            onClick={() => setShowCreateCal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> New Calendar
          </button>
        </div>

        {calendars.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 mb-3">No calendars yet</p>
            <button
              onClick={() => setShowCreateCal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
            >
              Create your first calendar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {calendars.map(cal => {
              const myRole = cal.calendar_members?.find(m => m.user_id === userId)?.role
              return (
                <div key={cal.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: cal.theme_color }} />
                      <div>
                        <p className="font-semibold text-gray-900">{cal.name}</p>
                        {cal.description && <p className="text-sm text-gray-400">{cal.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">Your role: {myRole}</p>
                      </div>
                    </div>
                    {myRole === 'owner' && (
                      <button
                        onClick={() => { setShowInvite(cal.id); setError('') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                      </button>
                    )}
                  </div>

                  {/* Members list */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Members</p>
                    <div className="flex flex-wrap gap-2">
                      {cal.calendar_members?.map(member => {
                        const profile = member.profiles as Profile
                        return (
                          <div key={member.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                              {getInitials(profile?.full_name)}
                            </div>
                            <span className="text-sm text-gray-700">{profile?.full_name ?? profile?.email ?? 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{member.role}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Calendar Modal */}
      {showCreateCal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Calendar</h2>
              <button onClick={() => setShowCreateCal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calendar Name *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={calForm.name}
                  onChange={e => setCalForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Smith Family Calendar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={calForm.description}
                  onChange={e => setCalForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Theme Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {THEME_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setCalForm(p => ({ ...p, theme_color: color }))}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: calForm.theme_color === color ? '#1e1b4b' : 'transparent',
                        boxShadow: calForm.theme_color === color ? '0 0 0 2px white inset' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
              <button
                onClick={() => setShowCreateCal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createCalendar}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Creating...' : 'Create Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Invite Member</h2>
              <button onClick={() => setShowInvite(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="coparent@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                >
                  <option value="editor">Editor — can add & edit events</option>
                  <option value="viewer">Viewer — read only</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
              <button
                onClick={() => setShowInvite(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => sendInvite(showInvite)}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
