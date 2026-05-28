import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aphrodite_session')?.value

  if (!token) {
    redirect('/onboarding/chat')
  }

  const supabase = createServiceClient()
  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('user_id, partial_profile')
    .eq('session_token', token)
    .single()

  if (!session) {
    redirect('/onboarding/chat')
  }

  const partial = session.partial_profile ?? {}
  const onboardingComplete = partial.last_period_start || partial.primary_symptoms

  if (!onboardingComplete) {
    redirect('/onboarding/chat')
  }

  if (!session.user_id) {
    redirect('/subscribe')
  }

  redirect('/dashboard')
}
