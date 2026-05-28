import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function computeCycleDay(lastPeriodStart: string, cycleLength: number) {
  const today = new Date()
  const last = new Date(lastPeriodStart)
  const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return (daysSince % cycleLength) + 1
}

function computePhase(cycleDay: number, cycleLength: number): string {
  if (cycleDay <= 5) return 'menstrual'
  if (cycleDay <= Math.round(cycleLength * 0.45)) return 'follicular'
  if (cycleDay <= Math.round(cycleLength * 0.55)) return 'ovulatory'
  return 'luteal'
}

function computeStreak(logs: { log_date: string }[]): number {
  if (!logs.length) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const logDates = new Set(logs.map((l) => l.log_date))
  let streak = 0
  const cursor = new Date(today)
  while (true) {
    const iso = cursor.toISOString().split('T')[0]
    if (logDates.has(iso)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('aphrodite_session')?.value
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: session, error } = await supabase
    .from('onboarding_sessions')
    .select('user_id, partial_profile, conversation_history')
    .eq('session_token', token)
    .single()

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Detect incomplete onboarding — partial_profile only has name/timezone
  // This means the user never completed the onboarding chat flow
  const partial = session.partial_profile ?? {}
  if (!partial.last_period_start && !partial.primary_symptoms) {
    return NextResponse.json({ error: 'Onboarding incomplete', needs_onboarding: true }, { status: 200 })
  }

  // Prefer full users row if available, but don't let null DB values overwrite onboarding data
  let profile = partial
  if (session.user_id) {
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user_id)
      .single()
    if (userRow) {
      const nonNull = Object.fromEntries(
        Object.entries(userRow).filter(([, v]) => v !== null && v !== undefined)
      )
      profile = { ...profile, ...nonNull }
    }
  }

  // Cycle day + phase
  let cycle_day: number | null = null
  let phase: string = profile.current_phase ?? 'unknown'
  const cycleLen = profile.cycle_length_average ?? 28
  if (profile.last_period_start && profile.cycle_regularity !== 'absent') {
    cycle_day = computeCycleDay(profile.last_period_start, cycleLen)
    if (!profile.perimenopause_flag) {
      phase = computePhase(cycle_day, cycleLen)
    }
  }

  // Recent logs for streak + today check
  let streak = 0
  let logged_today = false
  let recent_logs: object[] = []

  if (session.user_id) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: logs } = await supabase
      .from('cycle_logs')
      .select('log_date, energy_level, sleep_quality, symptoms, mood, food_notes, experiment_notes')
      .eq('user_id', session.user_id)
      .gte('log_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('log_date', { ascending: false })

    if (logs) {
      recent_logs = logs
      streak = computeStreak(logs)
      const todayIso = new Date().toISOString().split('T')[0]
      logged_today = logs.some((l) => l.log_date === todayIso)
    }
  }

  return NextResponse.json({
    profile,
    cycle_day,
    phase,
    streak,
    logged_today,
    recent_logs,
    conversation_history: session.conversation_history ?? [],
    user_id: session.user_id,
  })
}
