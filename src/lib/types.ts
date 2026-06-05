export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      calendars: {
        Row: Calendar
        Insert: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Calendar, 'id' | 'created_at'>>
      }
      calendar_members: {
        Row: CalendarMember
        Insert: Omit<CalendarMember, 'id' | 'joined_at'>
        Update: Partial<Omit<CalendarMember, 'id'>>
      }
      children: {
        Row: Child
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Child, 'id' | 'created_at'>>
      }
      child_documents: {
        Row: ChildDocument
        Insert: Omit<ChildDocument, 'id' | 'created_at'>
        Update: Partial<Omit<ChildDocument, 'id'>>
      }
      child_medications: {
        Row: ChildMedication
        Insert: Omit<ChildMedication, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChildMedication, 'id' | 'created_at'>>
      }
      child_growth_records: {
        Row: GrowthRecord
        Insert: Omit<GrowthRecord, 'id' | 'created_at'>
        Update: Partial<Omit<GrowthRecord, 'id'>>
      }
      events: {
        Row: CalendarEvent
        Insert: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CalendarEvent, 'id' | 'created_at'>>
      }
      activity_log: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at'>
        Update: never
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>
      }
      handoff_logs: {
        Row: HandoffLog
        Insert: Omit<HandoffLog, 'id' | 'created_at'>
        Update: Partial<Omit<HandoffLog, 'id'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id'>>
      }
      calendar_invitations: {
        Row: CalendarInvitation
        Insert: Omit<CalendarInvitation, 'id' | 'created_at' | 'token' | 'expires_at'>
        Update: Partial<Omit<CalendarInvitation, 'id'>>
      }
    }
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: 'parent' | 'teen' | 'viewer'
  created_at: string
  updated_at: string
}

export interface Calendar {
  id: string
  name: string
  description: string | null
  theme_color: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CalendarMember {
  id: string
  calendar_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
  email?: string
}

export interface Doctor {
  name: string
  specialty: string
  phone: string
  address?: string
  notes?: string
}

export interface InsuranceInfo {
  provider?: string
  policy_number?: string
  group_number?: string
  member_id?: string
  notes?: string
}

export interface Child {
  id: string
  calendar_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  profile_photo_url: string | null
  gender: string | null
  blood_type: string | null
  allergies: string[]
  diagnoses: string[]
  mental_health_notes: string | null
  dental_notes: string | null
  vision_notes: string | null
  carb_info: string | null
  emergency_contacts: EmergencyContact[]
  doctors: Doctor[]
  insurance_info: InsuranceInfo
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ChildDocument {
  id: string
  child_id: string
  name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  category: 'medical' | 'dental' | 'vision' | 'insurance' | 'legal' | 'school' | 'general'
  uploaded_by: string | null
  created_at: string
}

export interface ChildMedication {
  id: string
  child_id: string
  name: string
  dosage: string | null
  frequency: string | null
  prescribing_doctor: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface GrowthRecord {
  id: string
  child_id: string
  recorded_date: string
  height_cm: number | null
  weight_kg: number | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export type EventType = 'custody' | 'appointment' | 'school' | 'activity' | 'holiday' | 'handoff' | 'general'

export interface CalendarEvent {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  is_all_day: boolean
  color: string | null
  event_type: EventType
  rrule: string | null
  recurring_parent_id: string | null
  child_ids: string[]
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  calendar_id: string | null
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Json
  created_at: string
}

export type ExpenseCategory = 'medical' | 'dental' | 'school' | 'activity' | 'clothing' | 'food' | 'general'
export type ExpenseStatus = 'pending' | 'approved' | 'disputed' | 'settled'

export interface Expense {
  id: string
  calendar_id: string
  child_id: string | null
  title: string
  description: string | null
  amount: number
  category: ExpenseCategory
  paid_by: string
  split_percentage: number
  receipt_url: string | null
  expense_date: string
  status: ExpenseStatus
  created_at: string
  updated_at: string
}

export interface HandoffLog {
  id: string
  calendar_id: string
  event_id: string | null
  handoff_time: string
  location: string | null
  from_parent: string | null
  to_parent: string | null
  child_ids: string[]
  notes: string | null
  logged_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  calendar_id: string | null
  title: string
  body: string | null
  resource_type: string | null
  resource_id: string | null
  is_read: boolean
  created_at: string
}

export interface CalendarInvitation {
  id: string
  calendar_id: string
  invited_email: string
  invited_by: string
  role: 'editor' | 'viewer'
  token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  created_at: string
}

// Extended types with joins
export interface CalendarWithMembers extends Calendar {
  calendar_members: (CalendarMember & { profiles: Profile })[]
}

export interface EventWithCreator extends CalendarEvent {
  creator?: Profile
}

export interface ExpenseWithDetails extends Expense {
  payer?: Profile
  child?: Child
}

export interface ActivityLogWithUser extends ActivityLog {
  user?: Profile
}

// Custody schedule patterns
export type CustodyPattern =
  | 'every_weekend'
  | 'every_other_weekend'
  | '50_50_weekly'
  | '50_50_biweekly'
  | '2nd_4th_weekend'
  | '2nd_4th_5th_weekend'
  | 'custom'

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  custody: '#4F46E5',
  appointment: '#DC2626',
  school: '#2563EB',
  activity: '#16A34A',
  holiday: '#D97706',
  handoff: '#7C3AED',
  general: '#6B7280',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  custody: 'Custody',
  appointment: 'Appointment',
  school: 'School',
  activity: 'Activity',
  holiday: 'Holiday',
  handoff: 'Handoff',
  general: 'General',
}
