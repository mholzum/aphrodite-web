import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const OBSERVATION_PROMPT = `You are Aphrodite. You are reading this user's data. State what you see or what you are watching for. Do not encourage. Do not motivate. Do not reflect emotions back at her. Observe and direct only.

The only data points that exist in this system are:
- Sleep quality (1=poor, 3=okay, 5=good)
- Energy level (1=low, 3=medium, 5=high)
- Brain fog (yes or no)
- Symptoms from the user's primary symptom list (the specific symptoms they flagged at onboarding)
- Free text notes they typed
- Cycle day and phase (calculated from last period start date)

Do not reference anything outside this list. No basal body temperature. No cervical mucus. No heart rate. No weight. No lab values. No supplements unless the user typed them in notes. Only reference what the system can actually log.

Rules:
- One paragraph. 3–4 sentences maximum.
- Address her by name.
- If she has recent logs: state one specific pattern using the logged values above. Reference actual numbers where possible (e.g. "energy has been low three days running").
- If no logs yet: state what this cycle phase typically does to her specific onboarding symptoms. Mechanistic, not motivational.
- End with a single directive tied to the logging UI: tell her what to watch for in sleep, energy, brain fog, or her specific symptoms today.
- Never use em dashes (—). Use a period or rewrite.
- No headers. No bullets. Prose only. Under 60 words.
- Never: "I see," "I notice," "it sounds like," "you might be feeling," "this is a great time," "honor your body."
- No warmth language. The precision is the care.`

export async function POST(req: NextRequest) {
  const token = req.cookies.get('aphrodite_session')?.value
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('user_id, partial_profile')
    .eq('session_token', token)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  let profile = session.partial_profile ?? {}
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

  // Load recent logs for context
  let recentLogs: object[] = []
  if (session.user_id) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data: logs } = await supabase
      .from('cycle_logs')
      .select('log_date, energy_level, sleep_quality, symptoms, mood, food_notes, experiment_notes')
      .eq('user_id', session.user_id)
      .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('log_date', { ascending: false })
      .limit(7)
    recentLogs = logs ?? []
  }

  // Compute cycle day
  let cycleDay: number | null = null
  let phase = profile.current_phase ?? 'unknown'
  const cycleLen = profile.cycle_length_average ?? 28
  if (profile.last_period_start && profile.cycle_regularity !== 'absent') {
    const today = new Date()
    const last = new Date(profile.last_period_start)
    const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    cycleDay = (daysSince % cycleLen) + 1
    if (!profile.perimenopause_flag) {
      if (cycleDay <= 5) phase = 'menstrual'
      else if (cycleDay <= Math.round(cycleLen * 0.45)) phase = 'follicular'
      else if (cycleDay <= Math.round(cycleLen * 0.55)) phase = 'ovulatory'
      else phase = 'luteal'
    }
  }

  const contextBlock = `USER: ${profile.name ?? 'her'}
Cycle day: ${cycleDay ? `Day ${cycleDay} of ${cycleLen}` : 'unknown'}
Phase: ${phase}
Perimenopause flag: ${profile.perimenopause_flag ? 'yes' : 'no'}
Primary symptoms: ${profile.primary_symptoms?.join(', ') ?? 'not listed'}
Birth control: ${profile.birth_control ?? 'unknown'}
Notable context: ${profile.notable_life_context ?? 'none provided'}
Already tried: ${profile.already_tried?.join(', ') || 'nothing yet'}

RECENT LOGS (last 7 days):
${recentLogs.length
  ? JSON.stringify(recentLogs, null, 2)
  : 'No logs yet. This is her first or early days.'
}

Write the daily observation paragraph now.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: OBSERVATION_PROMPT,
    messages: [{ role: 'user', content: contextBlock }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ observation: text })
}
