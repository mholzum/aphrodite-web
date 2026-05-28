import { NextRequest, NextResponse } from 'next/server'
import { extractProfile } from '@/lib/anthropic/extraction'
import { createServiceClient } from '@/lib/supabase/server'
import { Message } from '@/types/aphrodite'

export async function POST(req: NextRequest) {
  const { session_token } = await req.json()
  if (!session_token) {
    return NextResponse.json({ error: 'Missing session_token' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: session, error } = await supabase
    .from('onboarding_sessions')
    .select('conversation_history, partial_profile')
    .eq('session_token', session_token)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const history: Message[] = session.conversation_history ?? []
  const existingProfile = session.partial_profile ?? {}
  const name: string = existingProfile.name ?? ''
  const timezone: string = existingProfile.timezone ?? 'UTC'

  const profile = await extractProfile(history, name, timezone)

  // Merge with existing partial_profile (name + timezone already there)
  const merged = { ...existingProfile, ...profile }

  // Update session with extracted profile
  await supabase
    .from('onboarding_sessions')
    .update({ partial_profile: merged })
    .eq('session_token', session_token)

  return NextResponse.json({ profile: merged })
}
