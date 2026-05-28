import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' })
}

export async function POST(req: NextRequest) {
  const { plan } = await req.json()

  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const priceId = plan === 'annual'
    ? process.env.STRIPE_PRICE_ID_ANNUAL
    : process.env.STRIPE_PRICE_ID_MONTHLY

  if (!priceId) return NextResponse.json({ error: 'Price not configured.' }, { status: 500 })

  // Resolve user_id from session cookie so webhook can match
  let userId: string | null = null
  const sessionToken = req.cookies.get('aphrodite_session')?.value
  if (sessionToken) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('onboarding_sessions')
      .select('user_id')
      .eq('session_token', sessionToken)
      .single()
    userId = data?.user_id ?? null
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aphrodite-web.vercel.app'
  const stripe = getStripe()

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      ...(userId ? { client_reference_id: userId } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      success_url: `${appUrl}/onboarding?checkout=success`,
      cancel_url: `${appUrl}/subscribe?checkout=cancelled`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 })
  }
}
