'use client'

import { useState } from 'react'

type Plan = 'annual' | 'monthly'

export default function SubscribePage() {
  const [selected, setSelected] = useState<Plan>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubscribe() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to create checkout session.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-10">

        {/* Wordmark */}
        <div>
          <h1
            className="tracking-widest text-[clamp(2rem,10vw,3rem)]"
            style={{
              color: 'var(--accent)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.3em',
            }}
          >
            APHRODITE
          </h1>
        </div>

        {/* Hero copy */}
        <div className="flex flex-col gap-2">
          <p
            className="text-3xl leading-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}
          >
            7 days free.
            <br />
            Then $9.99/month.
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
          >
            Start your free trial. Cancel anytime before day 7 — you won&apos;t be charged.
          </p>
        </div>

        {/* Plan selector */}
        <div className="flex flex-col gap-3">

          {/* Annual — default / pushed hard */}
          <button
            onClick={() => setSelected('annual')}
            className="relative w-full px-5 py-4 text-left transition-all"
            style={{
              background: selected === 'annual' ? 'var(--surface)' : 'transparent',
              border: `1px solid ${selected === 'annual' ? 'var(--accent)' : 'var(--border)'}`,
              outline: 'none',
            }}
          >
            {/* Best value badge */}
            <span
              className="absolute top-0 right-0 px-2 py-0.5 text-xs uppercase tracking-widest translate-y-[-50%]"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontFamily: 'Georgia, serif',
              }}
            >
              Best value
            </span>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-base uppercase tracking-widest"
                  style={{ color: selected === 'annual' ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  Annual
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  $5.75/month — two months free
                </span>
              </div>
              <div className="text-right">
                <span
                  className="text-lg"
                  style={{ color: selected === 'annual' ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  $69<span className="text-xs">/yr</span>
                </span>
              </div>
            </div>

            {selected === 'annual' && (
              <div
                className="mt-2 text-xs leading-relaxed"
                style={{ color: 'var(--text-secondary)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              >
                $69/year = $5.75/month. Two months free.
              </div>
            )}
          </button>

          {/* Monthly */}
          <button
            onClick={() => setSelected('monthly')}
            className="w-full px-5 py-4 text-left transition-all"
            style={{
              background: selected === 'monthly' ? 'var(--surface)' : 'transparent',
              border: `1px solid ${selected === 'monthly' ? 'var(--accent)' : 'var(--border)'}`,
              outline: 'none',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-base uppercase tracking-widest"
                style={{ color: selected === 'monthly' ? 'var(--accent)' : 'var(--text-primary)' }}
              >
                Monthly
              </span>
              <span
                className="text-lg"
                style={{ color: selected === 'monthly' ? 'var(--accent)' : 'var(--text-primary)' }}
              >
                $9.99<span className="text-xs">/mo</span>
              </span>
            </div>
          </button>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {error && (
            <p className="text-sm" style={{ color: '#c0614a' }}>{error}</p>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-4 text-sm uppercase tracking-widest transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.2em',
            }}
          >
            {loading ? 'Redirecting…' : 'Start Free Trial'}
          </button>

          <p
            className="text-xs text-center leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Card required to start. Cancel anytime in the first 7 days.
          </p>

          <a
            href="/onboarding"
            className="text-center"
            style={{ color: 'var(--text-secondary)', fontSize: '11px', opacity: 0.4 }}
          >
            Continue without payment (internal testing)
          </a>
        </div>

      </div>
    </div>
  )
}
