import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Called after first response is delivered.
// Creates the user account from onboarding data.
// Optionally stores email if provided.
export async function POST(req: NextRequest) {
  const { session_token, email } = await req.json()
  if (!session_token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceClient()

  // Load session
  const { data: session, error } = await supabase
    .from('onboarding_sessions')
    .select('partial_profile, completed_at, user_id')
    .eq('session_token', session_token)
    .single()

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Idempotent — if already completed, just return
  if (session.completed_at && session.user_id) {
    return NextResponse.json({ user_id: session.user_id })
  }

  const profile = session.partial_profile ?? {}

  // Create auth user
  const userEmail = email ?? `anon_${session_token.slice(0, 8)}@aphrodite.internal`
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: userEmail,
    email_confirm: true,
    user_metadata: { name: profile.name, onboarded_at: new Date().toISOString() },
  })

  if (authError || !authData.user) {
    console.error('Auth create error:', authError)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }

  const userId = authData.user.id

  // Insert public.users row from collected profile
  const { error: profileError } = await supabase.from('users').insert({
    id: userId,
    name: profile.name ?? 'Unknown',
    cycle_length_average: profile.cycle_length_average ?? 28,
    cycle_regularity: profile.cycle_regularity ?? 'unknown',
    last_period_start: profile.last_period_start ?? null,
    current_phase: profile.current_phase ?? 'unknown',
    perimenopause_flag: profile.perimenopause_flag ?? false,
    primary_symptoms: profile.primary_symptoms ?? [],
    symptom_duration: profile.symptom_duration ?? null,
    apps_abandoned: profile.apps_abandoned ?? [],
    why_abandoned: profile.why_abandoned ?? null,
    already_tried: profile.already_tried ?? [],
    birth_control: profile.birth_control ?? null,
    notable_life_context: profile.notable_life_context ?? null,
    onboarding_complete: true,
    subscription_status: 'free',
  })

  if (profileError) {
    console.error('Profile insert error:', profileError)
  }

  // Create cycle 1 so daily logs have a parent record
  const cycleStart = profile.last_period_start ?? new Date().toISOString().split('T')[0]
  await supabase.from('cycles').insert({
    user_id: userId,
    cycle_number: 1,
    cycle_start_date: cycleStart,
  })

  // Mark session complete
  await supabase
    .from('onboarding_sessions')
    .update({ user_id: userId, completed_at: new Date().toISOString() })
    .eq('session_token', session_token)

  const response = NextResponse.json({ user_id: userId })

  // Upgrade session cookie to user auth token not needed here —
  // Supabase session management handled on dashboard load
  return response
}
