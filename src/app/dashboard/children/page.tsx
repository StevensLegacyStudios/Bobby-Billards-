import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Baby } from 'lucide-react'
import type { Child } from '@/lib/types'
import { ageFromDob } from '@/lib/utils'

export default async function ChildrenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRows } = await supabase
    .from('calendar_members')
    .select('calendar_id')
    .eq('user_id', user.id)

  const calendarIds = memberRows?.map(m => m.calendar_id) ?? []

  const { data: children } = calendarIds.length
    ? await supabase.from('children').select('*').in('calendar_id', calendarIds).order('first_name')
    : { data: [] }

  const allChildren = (children ?? []) as Child[]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Children</h1>
        <Link
          href="/dashboard/children/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Child
        </Link>
      </div>

      {allChildren.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
            <Baby className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No children added yet</h2>
          <p className="text-gray-500 max-w-sm mb-6">
            Add your children&apos;s profiles to track their medical info, growth, medications, and more.
          </p>
          <Link
            href="/dashboard/children/new"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Add First Child
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allChildren.map(child => {
            const age = ageFromDob(child.date_of_birth)
            return (
              <Link
                key={child.id}
                href={`/dashboard/children/${child.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-indigo-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 mb-4">
                  {child.profile_photo_url ? (
                    <img
                      src={child.profile_photo_url}
                      alt={child.first_name}
                      className="w-12 h-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                      {child.first_name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{child.first_name} {child.last_name}</p>
                    {age !== null && (
                      <p className="text-sm text-gray-400">{age} years old</p>
                    )}
                  </div>
                </div>

                {child.allergies.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-red-600 mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {child.allergies.slice(0, 3).map(a => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs">{a}</span>
                      ))}
                      {child.allergies.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">+{child.allergies.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                {child.diagnoses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-600 mb-1">Diagnoses</p>
                    <div className="flex flex-wrap gap-1">
                      {child.diagnoses.slice(0, 2).map(d => (
                        <span key={d} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs">{d}</span>
                      ))}
                      {child.diagnoses.length > 2 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">+{child.diagnoses.length - 2}</span>
                      )}
                    </div>
                  </div>
                )}

                {child.allergies.length === 0 && child.diagnoses.length === 0 && (
                  <p className="text-xs text-gray-400">No medical alerts on file</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
