import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SetupData } from '@/types/aphrodite'

// GET /api/session?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('session_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/session — create new session from setup screen
export async function POST(req: NextRequest) {
  const body: SetupData = await req.json()

  if (!body.name || !body.timezone || !body.tos_accepted) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const token = crypto.randomUUID()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('onboarding_sessions')
    .insert({
      session_token: token,
      current_step: 0,
      conversation_history: [],
      partial_profile: { name: body.name, timezone: body.timezone },
      perimenopause_flag_detected: false,
    })
    .select('id, session_token')
    .single()

  if (error || !data) {
    console.error('Session create error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const response = NextResponse.json({ session_token: data.session_token })
  response.cookies.set('aphrodite_session', data.session_token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return response
}

// PATCH /api/session — update step, profile, flags
export async function PATCH(req: NextRequest) {
  const { session_token, ...updates } = await req.json()
  if (!session_token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('onboarding_sessions')
    .update(updates)
    .eq('session_token', session_token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
