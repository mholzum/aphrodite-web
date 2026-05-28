'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Sydney',
  'Asia/Singapore',
  'Asia/Kolkata',
]

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/Los_Angeles'
  }
}

export default function SetupScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(getDeviceTimezone())
  const [tosAccepted, setTosAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!tosAccepted) { setError('Please accept to continue.'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), timezone, tos_accepted: true }),
      })

      if (!res.ok) throw new Error('Failed to start session')
      router.push('/onboarding/chat')
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1
          className="tracking-widest mb-4 text-[clamp(2rem,10vw,3.5rem)] md:text-[2rem]"
          style={{
            color: 'var(--accent)',
            fontFamily: 'Georgia, serif',
            letterSpacing: '0.3em',
          }}
        >
          APHRODITE
        </h1>
        <p
          className="text-xl mb-12"
          style={{ color: 'var(--text-secondary)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
        >
          Your body has been speaking.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs mb-2 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name is fine"
              autoComplete="off"
              className="w-full px-4 py-3 text-base rounded-none outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs mb-2 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 text-base rounded-none outline-none appearance-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* TOS */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-4 h-4 flex items-center justify-center"
                style={{
                  border: `1px solid ${tosAccepted ? 'var(--accent)' : 'var(--border)'}`,
                  background: tosAccepted ? 'var(--accent)' : 'transparent',
                }}
              >
                {tosAccepted && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#0f0e0c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Aphrodite provides education and lifestyle suggestions, not medical diagnosis or treatment.
            </span>
          </label>

          {error && (
            <p className="text-sm" style={{ color: '#c0614a' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-sm uppercase tracking-widest transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.2em',
            }}
          >
            {loading ? 'Starting…' : "Let's begin"}
          </button>
        </form>
      </div>
    </div>
  )
}
