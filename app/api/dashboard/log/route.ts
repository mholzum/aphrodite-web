import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('aphrodite_session')?.value
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const body = await req.json()
  const { sleep_quality, energy_level, symptoms, mood, notes } = body

  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('user_id, partial_profile')
    .eq('session_token', token)
    .single()

  if (!session?.user_id) {
    return NextResponse.json({ error: 'No user account yet' }, { status: 400 })
  }

  const profile = session.partial_profile ?? {}
  const cycleLen = profile.cycle_length_average ?? 28
  const today = new Date().toISOString().split('T')[0]

  // Compute cycle day + phase
  let cycleDay = 1
  let phase = 'unknown'
  if (profile.last_period_start) {
    const last = new Date(profile.last_period_start)
    const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
    cycleDay = (daysSince % cycleLen) + 1
    if (cycleDay <= 5) phase = 'menstrual'
    else if (cycleDay <= Math.round(cycleLen * 0.45)) phase = 'follicular'
    else if (cycleDay <= Math.round(cycleLen * 0.55)) phase = 'ovulatory'
    else phase = 'luteal'
    if (profile.perimenopause_flag) phase = 'indeterminate'
  }

  // Look up the user's current cycle
  const { data: cycleRow } = await supabase
    .from('cycles')
    .select('id, cycle_number')
    .eq('user_id', session.user_id)
    .order('cycle_number', { ascending: false })
    .limit(1)
    .single()

  // Upsert — one log per day per user
  const { error } = await supabase.from('cycle_logs').upsert(
    {
      user_id: session.user_id,
      cycle_id: cycleRow?.id ?? null,
      cycle_number: cycleRow?.cycle_number ?? 1,
      phase,
      day_of_cycle: cycleDay,
      log_date: today,
      symptoms: symptoms ?? [],
      energy_level: energy_level ?? null,
      sleep_quality: sleep_quality ?? null,
      mood: mood ?? null,
      food_notes: notes ?? null,
    },
    { onConflict: 'user_id,log_date' }
  )

  if (error) {
    console.error('Log insert error:', error)
    return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
