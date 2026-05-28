export type CycleRegularity = 'regular' | 'irregular' | 'unknown' | 'absent'

export interface UserProfile {
  name: string
  age_range: string | null
  timezone: string
  cycle_length_average: number | null
  cycle_regularity: CycleRegularity
  last_period_start: string | null // ISO 8601
  current_phase: string
  perimenopause_flag: boolean
  primary_symptoms: string[]
  symptom_duration: string | null
  apps_abandoned: string[]
  why_abandoned: string | null
  already_tried: string[]
  birth_control: string | null
  notable_life_context: string | null
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface OnboardingSession {
  id: string
  session_token: string
  user_id: string | null
  current_step: number
  conversation_history: Message[]
  partial_profile: Partial<UserProfile>
  perimenopause_flag_detected: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface SetupData {
  name: string
  timezone: string
  tos_accepted: boolean
}
