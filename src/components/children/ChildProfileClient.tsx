'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Save, Pill, TrendingUp, FileText, AlertTriangle, Heart, School } from 'lucide-react'
import Link from 'next/link'
import type { Child, ChildMedication, GrowthRecord, ChildDocument } from '@/lib/types'
import { formatDate, ageFromDob, cmToFeetInches, kgToLbs } from '@/lib/utils'

type Tab = 'info' | 'medical' | 'medications' | 'growth' | 'documents' | 'school'

interface ChildProfileClientProps {
  child: Child | null
  calendars: { id: string; name: string }[]
  medications: ChildMedication[]
  growthRecords: GrowthRecord[]
  documents: ChildDocument[]
  userId: string
}

export function ChildProfileClient({
  child: initialChild,
  calendars,
  medications: initialMeds,
  growthRecords: initialGrowth,
  documents: initialDocs,
  userId,
}: ChildProfileClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const isNew = !initialChild
  const [tab, setTab] = useState<Tab>('info')
  const [child, setChild] = useState<Partial<Child>>(initialChild ?? {
    calendar_id: calendars[0]?.id ?? '',
    first_name: '',
    last_name: '',
    allergies: [],
    diagnoses: [],
    emergency_contacts: [],
    doctors: [],
    insurance_info: {},
  })
  const [medications, setMedications] = useState(initialMeds)
  const [growthRecords, setGrowthRecords] = useState(initialGrowth)
  const [documents] = useState(initialDocs)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [newAllergy, setNewAllergy] = useState('')
  const [newDiagnosis, setNewDiagnosis] = useState('')
  const [showMedForm, setShowMedForm] = useState(false)
  const [showGrowthForm, setShowGrowthForm] = useState(false)
  const [medForm, setMedForm] = useState({ name: '', dosage: '', frequency: '', prescribing_doctor: '', start_date: '', notes: '' })
  const [growthForm, setGrowthForm] = useState({ recorded_date: new Date().toISOString().slice(0, 10), height_cm: '', weight_kg: '', notes: '' })

  function updateChild(field: string, value: unknown) {
    setChild(prev => ({ ...prev, [field]: value }))
  }

  function addTag(field: 'allergies' | 'diagnoses', value: string) {
    if (!value.trim()) return
    updateChild(field, [...(child[field] ?? []), value.trim()])
    if (field === 'allergies') setNewAllergy('')
    else setNewDiagnosis('')
  }

  function removeTag(field: 'allergies' | 'diagnoses', index: number) {
    updateChild(field, (child[field] ?? []).filter((_, i) => i !== index))
  }

  async function saveChild() {
    if (!child.first_name?.trim() || !child.last_name?.trim()) {
      setError('First and last name are required')
      return
    }
    setLoading(true)
    setError('')

    const payload = {
      first_name: child.first_name!.trim(),
      last_name: child.last_name!.trim(),
      date_of_birth: child.date_of_birth || null,
      gender: child.gender || null,
      blood_type: child.blood_type || null,
      allergies: child.allergies ?? [],
      diagnoses: child.diagnoses ?? [],
      mental_health_notes: child.mental_health_notes || null,
      dental_notes: child.dental_notes || null,
      vision_notes: child.vision_notes || null,
      carb_info: child.carb_info || null,
      emergency_contacts: child.emergency_contacts ?? [],
      doctors: child.doctors ?? [],
      insurance_info: child.insurance_info ?? {},
      notes: child.notes || null,
      calendar_id: child.calendar_id!,
    }

    const { data, error: err } = isNew
      ? await supabase.from('children').insert(payload).select().single()
      : await supabase.from('children').update(payload).eq('id', initialChild!.id).select().single()

    if (err) {
      setError(err.message)
    } else {
      if (isNew) {
        router.push(`/dashboard/children/${(data as Child).id}`)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
    setLoading(false)
  }

  async function saveMedication() {
    if (!medForm.name.trim() || !initialChild?.id) return
    setLoading(true)

    const { data, error: err } = await supabase
      .from('child_medications')
      .insert({
        child_id: initialChild.id,
        name: medForm.name,
        dosage: medForm.dosage || null,
        frequency: medForm.frequency || null,
        prescribing_doctor: medForm.prescribing_doctor || null,
        start_date: medForm.start_date || null,
        notes: medForm.notes || null,
        created_by: userId,
      })
      .select()
      .single()

    if (!err && data) {
      setMedications(prev => [data as ChildMedication, ...prev])
      setShowMedForm(false)
      setMedForm({ name: '', dosage: '', frequency: '', prescribing_doctor: '', start_date: '', notes: '' })
    }
    setLoading(false)
  }

  async function saveGrowth() {
    if (!growthForm.recorded_date || !initialChild?.id) return
    setLoading(true)

    const { data, error: err } = await supabase
      .from('child_growth_records')
      .insert({
        child_id: initialChild.id,
        recorded_date: growthForm.recorded_date,
        height_cm: growthForm.height_cm ? parseFloat(growthForm.height_cm) : null,
        weight_kg: growthForm.weight_kg ? parseFloat(growthForm.weight_kg) : null,
        notes: growthForm.notes || null,
        recorded_by: userId,
      })
      .select()
      .single()

    if (!err && data) {
      setGrowthRecords(prev => [...prev, data as GrowthRecord].sort((a, b) => a.recorded_date.localeCompare(b.recorded_date)))
      setShowGrowthForm(false)
      setGrowthForm({ recorded_date: new Date().toISOString().slice(0, 10), height_cm: '', weight_kg: '', notes: '' })
    }
    setLoading(false)
  }

  const age = ageFromDob(child.date_of_birth ?? null)
  const latestGrowth = growthRecords[growthRecords.length - 1]

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'info', label: 'Profile', icon: Heart },
    { key: 'medical', label: 'Medical', icon: AlertTriangle },
    { key: 'medications', label: 'Medications', icon: Pill },
    { key: 'growth', label: 'Growth', icon: TrendingUp },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'school', label: 'School', icon: School },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/children" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3">
          {child.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={child.profile_photo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold">
              {child.first_name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isNew ? 'Add Child' : `${child.first_name} ${child.last_name}`}
            </h1>
            {age !== null && <p className="text-sm text-gray-400">{age} years old</p>}
          </div>
        </div>
        <button
          onClick={saveChild}
          disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : saved ? 'Saved!' : isNew ? 'Create Profile' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'info' && (
        <div className="space-y-5">
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calendar *</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.calendar_id}
                onChange={e => updateChild('calendar_id', e.target.value)}
              >
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.first_name ?? ''}
                onChange={e => updateChild('first_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.last_name ?? ''}
                onChange={e => updateChild('last_name', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.date_of_birth ?? ''}
                onChange={e => updateChild('date_of_birth', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.gender ?? ''}
                onChange={e => updateChild('gender', e.target.value)}
              >
                <option value="">—</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={child.blood_type ?? ''}
                onChange={e => updateChild('blood_type', e.target.value)}
              >
                <option value="">Unknown</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              value={child.notes ?? ''}
              onChange={e => updateChild('notes', e.target.value)}
              placeholder="General notes about this child..."
            />
          </div>

          {/* Emergency contacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Emergency Contacts</label>
              <button
                onClick={() => updateChild('emergency_contacts', [...(child.emergency_contacts ?? []), { name: '', relationship: '', phone: '' }])}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {(child.emergency_contacts ?? []).map((contact, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <input
                  className="px-2 py-1.5 rounded border border-gray-200 text-sm"
                  placeholder="Name"
                  value={contact.name}
                  onChange={e => {
                    const updated = [...(child.emergency_contacts ?? [])]
                    updated[i] = { ...updated[i], name: e.target.value }
                    updateChild('emergency_contacts', updated)
                  }}
                />
                <input
                  className="px-2 py-1.5 rounded border border-gray-200 text-sm"
                  placeholder="Relationship"
                  value={contact.relationship}
                  onChange={e => {
                    const updated = [...(child.emergency_contacts ?? [])]
                    updated[i] = { ...updated[i], relationship: e.target.value }
                    updateChild('emergency_contacts', updated)
                  }}
                />
                <div className="flex gap-1">
                  <input
                    className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm"
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={e => {
                      const updated = [...(child.emergency_contacts ?? [])]
                      updated[i] = { ...updated[i], phone: e.target.value }
                      updateChild('emergency_contacts', updated)
                    }}
                  />
                  <button
                    onClick={() => updateChild('emergency_contacts', (child.emergency_contacts ?? []).filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medical tab */}
      {tab === 'medical' && (
        <div className="space-y-5">
          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-red-600 mb-2">Allergies</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(child.allergies ?? []).map((a, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-sm">
                  {a}
                  <button onClick={() => removeTag('allergies', i)} className="hover:text-red-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                placeholder="Add allergy..."
                value={newAllergy}
                onChange={e => setNewAllergy(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag('allergies', newAllergy)}
              />
              <button
                onClick={() => addTag('allergies', newAllergy)}
                className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
              >
                Add
              </button>
            </div>
          </div>

          {/* Diagnoses */}
          <div>
            <label className="block text-sm font-medium text-amber-600 mb-2">Diagnoses</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(child.diagnoses ?? []).map((d, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-sm">
                  {d}
                  <button onClick={() => removeTag('diagnoses', i)} className="hover:text-amber-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                placeholder="Add diagnosis..."
                value={newDiagnosis}
                onChange={e => setNewDiagnosis(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag('diagnoses', newDiagnosis)}
              />
              <button
                onClick={() => addTag('diagnoses', newDiagnosis)}
                className="px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium hover:bg-amber-200"
              >
                Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mental Health Notes</label>
              <textarea rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                value={child.mental_health_notes ?? ''} onChange={e => updateChild('mental_health_notes', e.target.value)} placeholder="Therapist, diagnoses, notes..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carbohydrate / Dietary Info</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                value={child.carb_info ?? ''} onChange={e => updateChild('carb_info', e.target.value)} placeholder="Carb ratios, dietary restrictions..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dental Notes</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                value={child.dental_notes ?? ''} onChange={e => updateChild('dental_notes', e.target.value)} placeholder="Dentist, braces, notes..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vision Notes</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                value={child.vision_notes ?? ''} onChange={e => updateChild('vision_notes', e.target.value)} placeholder="Prescription, glasses, contacts..." />
            </div>
          </div>

          {/* Insurance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Insurance Information</label>
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
              {(['provider', 'policy_number', 'group_number', 'member_id'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1 capitalize">{field.replace('_', ' ')}</label>
                  <input
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm"
                    value={(child.insurance_info as Record<string, string>)?.[field] ?? ''}
                    onChange={e => updateChild('insurance_info', { ...child.insurance_info, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Doctors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Doctors</label>
              <button
                onClick={() => updateChild('doctors', [...(child.doctors ?? []), { name: '', specialty: '', phone: '' }])}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Doctor
              </button>
            </div>
            {(child.doctors ?? []).map((doc, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <input className="px-2 py-1.5 rounded border border-gray-200 text-sm" placeholder="Doctor name"
                  value={doc.name}
                  onChange={e => {
                    const updated = [...(child.doctors ?? [])]
                    updated[i] = { ...updated[i], name: e.target.value }
                    updateChild('doctors', updated)
                  }}
                />
                <input className="px-2 py-1.5 rounded border border-gray-200 text-sm" placeholder="Specialty"
                  value={doc.specialty}
                  onChange={e => {
                    const updated = [...(child.doctors ?? [])]
                    updated[i] = { ...updated[i], specialty: e.target.value }
                    updateChild('doctors', updated)
                  }}
                />
                <div className="flex gap-1">
                  <input className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm" placeholder="Phone"
                    value={doc.phone}
                    onChange={e => {
                      const updated = [...(child.doctors ?? [])]
                      updated[i] = { ...updated[i], phone: e.target.value }
                      updateChild('doctors', updated)
                    }}
                  />
                  <button onClick={() => updateChild('doctors', (child.doctors ?? []).filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medications tab */}
      {tab === 'medications' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{medications.filter(m => m.is_active).length} active medications</p>
            <button
              onClick={() => setShowMedForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              disabled={isNew}
            >
              <Plus className="w-3.5 h-3.5" /> Add Medication
            </button>
          </div>

          {isNew && <p className="text-amber-600 text-sm mb-4">Save the child profile first to add medications.</p>}

          {medications.length === 0 ? (
            <div className="py-12 text-center">
              <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No medications on file</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map(med => (
                <div key={med.id} className={`bg-white rounded-xl border p-4 ${med.is_active ? 'border-green-100' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{med.name}</p>
                      <p className="text-sm text-gray-500">{med.dosage && `${med.dosage} · `}{med.frequency}</p>
                      {med.prescribing_doctor && <p className="text-xs text-gray-400">Dr. {med.prescribing_doctor}</p>}
                      {med.start_date && <p className="text-xs text-gray-400">Started {formatDate(med.start_date)}</p>}
                      {med.notes && <p className="text-xs text-gray-500 mt-1 italic">{med.notes}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${med.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {med.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showMedForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Add Medication</h2>
                  <button onClick={() => setShowMedForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={medForm.name} onChange={e => setMedForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                      <input className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={medForm.dosage} onChange={e => setMedForm(p => ({ ...p, dosage: e.target.value }))} placeholder="e.g., 10mg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                      <input className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={medForm.frequency} onChange={e => setMedForm(p => ({ ...p, frequency: e.target.value }))} placeholder="e.g., Twice daily" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prescribing Doctor</label>
                      <input className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={medForm.prescribing_doctor} onChange={e => setMedForm(p => ({ ...p, prescribing_doctor: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={medForm.start_date} onChange={e => setMedForm(p => ({ ...p, start_date: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                      value={medForm.notes} onChange={e => setMedForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
                  <button onClick={() => setShowMedForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveMedication} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {loading ? 'Saving...' : 'Add Medication'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Growth tab */}
      {tab === 'growth' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            {latestGrowth && (
              <div className="flex gap-6">
                {latestGrowth.height_cm && (
                  <div>
                    <p className="text-xs text-gray-400">Latest Height</p>
                    <p className="font-semibold">{latestGrowth.height_cm} cm <span className="text-gray-400 font-normal text-sm">({cmToFeetInches(latestGrowth.height_cm)})</span></p>
                  </div>
                )}
                {latestGrowth.weight_kg && (
                  <div>
                    <p className="text-xs text-gray-400">Latest Weight</p>
                    <p className="font-semibold">{latestGrowth.weight_kg} kg <span className="text-gray-400 font-normal text-sm">({kgToLbs(latestGrowth.weight_kg)} lbs)</span></p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowGrowthForm(true)}
              disabled={isNew}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 ml-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Record
            </button>
          </div>

          {isNew && <p className="text-amber-600 text-sm mb-4">Save the child profile first to track growth.</p>}

          {growthRecords.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No growth records yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Height</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Weight</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...growthRecords].reverse().map(rec => (
                    <tr key={rec.id}>
                      <td className="py-2.5 text-gray-900">{formatDate(rec.recorded_date)}</td>
                      <td className="py-2.5 text-right text-gray-700">
                        {rec.height_cm ? `${rec.height_cm} cm` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-700">
                        {rec.weight_kg ? `${rec.weight_kg} kg` : '—'}
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs pl-4">{rec.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showGrowthForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Add Growth Record</h2>
                  <button onClick={() => setShowGrowthForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={growthForm.recorded_date} onChange={e => setGrowthForm(p => ({ ...p, recorded_date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                      <input type="number" step="0.1" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={growthForm.height_cm} onChange={e => setGrowthForm(p => ({ ...p, height_cm: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                      <input type="number" step="0.1" className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={growthForm.weight_kg} onChange={e => setGrowthForm(p => ({ ...p, weight_kg: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={growthForm.notes} onChange={e => setGrowthForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 p-5 border-t border-gray-100 justify-end">
                  <button onClick={() => setShowGrowthForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveGrowth} disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {loading ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {isNew
              ? 'Save the child profile first to upload documents.'
              : 'Upload insurance cards, medical records, court documents, and more.'}
          </p>
          {documents.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No documents uploaded yet</p>
              <p className="text-gray-300 text-xs mt-1">Document upload coming soon</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                  <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">{doc.category} · {formatDate(doc.created_at)}</p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs text-indigo-600 hover:underline flex-shrink-0">
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* School tab */}
      {tab === 'school' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(['school_name', 'grade', 'teacher', 'school_phone'] as const).map(field => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={(child.insurance_info as Record<string, string>)?.[field] ?? ''}
                  onChange={e => updateChild('insurance_info', { ...child.insurance_info, [field]: e.target.value })}
                  placeholder={field.replace(/_/g, ' ')}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">School information is stored in the child&apos;s profile and visible to all calendar members.</p>
        </div>
      )}
    </div>
  )
}
