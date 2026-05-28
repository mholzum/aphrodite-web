'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Message, CycleRegularity, UserProfile } from '@/types/aphrodite'

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMPTOMS = [
  'Hormonal acne',
  'Energy crashes',
  'Mood swings',
  'Irregular periods',
  'Period pain / cramps',
  'Sleep issues',
  'Bloating',
  'Low libido',
  'Weight changes',
  'Brain fog',
  'Heavy periods',
]

const DURATIONS = [
  'Just started, a few weeks',
  'A couple of months',
  'About a year',
  'More than a year',
  'For as long as I can remember',
]

const BC_OPTIONS = [
  'Pill, patch, or ring',
  'Hormonal IUD',
  'Implant',
  'Copper IUD or barrier method',
  'Nothing',
  'I recently stopped',
]

const BC_STOPPED_OPTIONS = [
  'Less than 3 months ago',
  '3–6 months ago',
  '6–12 months ago',
  'More than a year ago',
]

const CYCLE_OPTIONS = [
  'Under 25 days',
  '25–30 days',
  '31–35 days',
  'It varies a lot',
  "I don't really track it",
]

type Screen = 'symptoms' | 'duration' | 'birth_control' | 'cycle' | 'depth' | 'processing' | 'response'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cycleLengthToNumber(label: string): number | null {
  if (label === 'Under 25 days') return 24
  if (label === '25–30 days') return 28
  if (label === '31–35 days') return 33
  return null
}

function cycleRegularityFromLabel(label: string): CycleRegularity {
  if (label === 'It varies a lot') return 'irregular'
  if (label === "I don't really track it") return 'unknown'
  return 'regular'
}

function calculatePhase(lastPeriodStart: string, cycleLengthAvg: number | null): string {
  if (!lastPeriodStart || !cycleLengthAvg) return 'unknown'
  const today = new Date()
  const last = new Date(lastPeriodStart)
  const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  const cycleDay = (daysSince % cycleLengthAvg) + 1
  if (cycleDay <= 5) return 'menstrual'
  if (cycleDay <= Math.round(cycleLengthAvg * 0.45)) return 'follicular'
  if (cycleDay <= Math.round(cycleLengthAvg * 0.55)) return 'ovulatory'
  return 'luteal'
}

function detectPerimenopause(symptoms: string[], freeText: string): boolean {
  const s = symptoms.map((x) => x.toLowerCase())
  const hasIrregular = s.includes('irregular periods')
  const hasTrigger =
    s.includes('sleep issues') || s.includes('mood swings') || s.includes('brain fog')
  const textSignal = /perimenopause|hot flash/i.test(freeText)
  return (hasIrregular && hasTrigger) || textSignal
}

function buildProfile(
  selectedSymptoms: string[],
  somethingElse: string,
  duration: string,
  birthControl: string,
  bcStopped: string,
  lastPeriod: string,
  cycleLabel: string,
  depthText: string,
  name: string,
  timezone: string
): Partial<UserProfile> {
  // Only structured symptoms become chips on the dashboard — free text goes to context
  const allSymptoms = [...selectedSymptoms]

  const cycleLength = cycleLengthToNumber(cycleLabel)
  const regularity = cycleRegularityFromLabel(cycleLabel)
  const isPeri = detectPerimenopause(selectedSymptoms, somethingElse)

  const bcValue =
    birthControl === 'I recently stopped' && bcStopped
      ? `recently stopped (${bcStopped})`
      : birthControl

  const phase =
    isPeri || regularity === 'absent'
      ? 'indeterminate'
      : calculatePhase(lastPeriod, cycleLength)

  return {
    name,
    timezone,
    primary_symptoms: allSymptoms,
    symptom_duration: duration || null,
    birth_control: bcValue || null,
    last_period_start: lastPeriod || null,
    cycle_length_average: cycleLength,
    cycle_regularity: regularity,
    current_phase: phase,
    perimenopause_flag: isPeri,
    notable_life_context: [somethingElse.trim(), depthText.trim()].filter(Boolean).join('\n\n') || null,
    already_tried: [],
    apps_abandoned: [],
    why_abandoned: null,
    age_range: null,
  }
}

// ─── Shared button component ───────────────────────────────────────────────────

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 text-sm text-left transition-colors"
      style={{
        background: selected ? 'var(--accent)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        color: selected ? 'var(--bg)' : 'var(--text-primary)',
        borderRadius: '2px',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('symptoms')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('UTC')

  // Screen 1
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [showSomethingElse, setShowSomethingElse] = useState(false)
  const [somethingElse, setSomethingElse] = useState('')

  // Screen 2
  const [duration, setDuration] = useState('')

  // Screen 3
  const [birthControl, setBirthControl] = useState('')
  const [bcStopped, setBcStopped] = useState('')

  // Screen 4
  const today = new Date().toISOString().split('T')[0]
  const [lastPeriod, setLastPeriod] = useState(today)
  const [cycleLabel, setCycleLabel] = useState('')

  // Screen 5
  const [depthText, setDepthText] = useState('')

  // Response screen
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)
  const streamingContentRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load session
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/session/current')
      if (!res.ok) { router.push('/onboarding'); return }
      const { token } = await res.json()
      setSessionToken(token)

      const sessionRes = await fetch(`/api/session?token=${token}`)
      if (sessionRes.ok) {
        const data = await sessionRes.json()
        setName(data.partial_profile?.name ?? '')
        setTimezone(data.partial_profile?.timezone ?? 'UTC')
      }
    }
    init()
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Symptom toggle ──────────────────────────────────────────────────────────
  function toggleSymptom(s: string) {
    if (s === 'Something else') {
      setShowSomethingElse((v) => !v)
      return
    }
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  // ── Perimenopause adaptive label ────────────────────────────────────────────
  const isPeri = detectPerimenopause(selectedSymptoms, somethingElse)

  // ── Stream the first response ───────────────────────────────────────────────
  const streamFirstResponse = useCallback(async (token: string) => {
    setStreaming(true)
    streamingContentRef.current = ''

    const placeholder: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages([placeholder])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: token,
          message: '__GENERATE_FIRST_RESPONSE__',
          mode: 'A',
        }),
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') continue
          try {
            const { delta } = JSON.parse(data)
            if (delta) {
              streamingContentRef.current += delta
              setMessages([{
                role: 'assistant',
                content: streamingContentRef.current,
                timestamp: new Date().toISOString(),
              }])
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      console.error('Stream error:', err)
    } finally {
      setStreaming(false)
      await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token }),
      })
      setDone(true)
    }
  }, [])

  // ── Submit handler — runs on the processing screen ──────────────────────────
  async function runProcessing(token: string) {
    const profile = buildProfile(
      selectedSymptoms,
      somethingElse,
      duration,
      birthControl,
      bcStopped,
      lastPeriod,
      cycleLabel,
      depthText,
      name,
      timezone
    )

    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: token,
        partial_profile: profile,
        perimenopause_flag_detected: profile.perimenopause_flag ?? false,
      }),
    })

    // Deliberate pause — signals reasoning, not retrieval
    await new Promise((r) => setTimeout(r, 3500))

    setScreen('response')
    await streamFirstResponse(token)
  }

  function goToProcessing() {
    if (!sessionToken) return
    setScreen('processing')
    runProcessing(sessionToken)
  }

  function handleContinue() {
    router.push('/dashboard')
  }

  // ── Screen: SYMPTOMS ────────────────────────────────────────────────────────
  if (screen === 'symptoms') {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-xl mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
              Tell me what&apos;s going on.
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select everything that applies.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SYMPTOMS.map((s) => (
              <OptionButton
                key={s}
                label={s}
                selected={selectedSymptoms.includes(s)}
                onClick={() => toggleSymptom(s)}
              />
            ))}
            <OptionButton
              label="Something else →"
              selected={showSomethingElse}
              onClick={() => toggleSymptom('Something else')}
            />
          </div>

          {showSomethingElse && (
            <input
              type="text"
              value={somethingElse}
              onChange={(e) => setSomethingElse(e.target.value)}
              placeholder="What else is going on?"
              className="w-full px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          )}
        </div>

        <Cta
          label="This is what&apos;s happening →"
          disabled={selectedSymptoms.length === 0 && !somethingElse.trim()}
          onClick={() => setScreen('duration')}
        />
      </Layout>
    )
  }

  // ── Screen: DURATION ────────────────────────────────────────────────────────
  if (screen === 'duration') {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
          <h1 className="text-xl" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
            For how long?
          </h1>
          <div className="flex flex-col gap-2">
            {DURATIONS.map((d) => (
              <OptionButton
                key={d}
                label={d}
                selected={duration === d}
                onClick={() => setDuration(d)}
              />
            ))}
          </div>
        </div>

        <Cta
          label="Next →"
          disabled={!duration}
          onClick={() => setScreen('birth_control')}
        />
      </Layout>
    )
  }

  // ── Screen: BIRTH CONTROL ───────────────────────────────────────────────────
  if (screen === 'birth_control') {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
          <h1 className="text-xl" style={{ color: 'var(--text-primary)' }}>
            Are you on any hormonal birth control?
          </h1>
          <div className="flex flex-col gap-2">
            {BC_OPTIONS.map((opt) => (
              <OptionButton
                key={opt}
                label={opt}
                selected={birthControl === opt}
                onClick={() => { setBirthControl(opt); setBcStopped('') }}
              />
            ))}
          </div>

          {birthControl === 'I recently stopped' && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                How long ago?
              </p>
              {BC_STOPPED_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  label={opt}
                  selected={bcStopped === opt}
                  onClick={() => setBcStopped(opt)}
                />
              ))}
            </div>
          )}
        </div>

        <Cta
          label="Next →"
          disabled={!birthControl || (birthControl === 'I recently stopped' && !bcStopped)}
          onClick={() => setScreen('cycle')}
        />
      </Layout>
    )
  }

  // ── Screen: CYCLE ───────────────────────────────────────────────────────────
  if (screen === 'cycle') {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
          <h1 className="text-xl" style={{ color: 'var(--text-primary)' }}>
            Last period and cycle length.
          </h1>

          <div className="flex flex-col gap-2">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isPeri
                ? 'When was your last period, even if it was a while ago?'
                : 'When did your last period start?'}
            </label>
            <input
              type="date"
              value={lastPeriod}
              max={today}
              onChange={(e) => setLastPeriod(e.target.value)}
              className="px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                colorScheme: 'dark',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              How long is your cycle usually?
            </p>
            {CYCLE_OPTIONS.map((opt) => (
              <OptionButton
                key={opt}
                label={opt}
                selected={cycleLabel === opt}
                onClick={() => setCycleLabel(opt)}
              />
            ))}
          </div>
        </div>

        <Cta
          label="Almost there →"
          disabled={!lastPeriod || !cycleLabel}
          onClick={() => setScreen('depth')}
        />
      </Layout>
    )
  }

  // ── Screen: DEPTH ───────────────────────────────────────────────────────────
  if (screen === 'depth') {
    return (
      <Layout>
        <div className="flex flex-col gap-4">
          <h1 className="text-xl" style={{ color: 'var(--text-primary)' }}>
            Want a more specific answer?
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'Georgia, serif' }}>
            Tell me anything else. What you&apos;ve tried, what your life looks like right now, what no app has ever asked you. The more I know, the more specific I can get. One line or ten. Up to you.
          </p>
          <textarea
            value={depthText}
            onChange={(e) => setDepthText(e.target.value)}
            rows={5}
            placeholder="e.g. I've tried cutting dairy, I'm under a lot of stress, I stopped the pill 8 months ago and nothing's settled since..."
            className="w-full px-3 py-2 text-sm outline-none resize-none"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Cta
            label="Show me what you've got →"
            disabled={false}
            onClick={goToProcessing}
          />
          <button
            onClick={goToProcessing}
            className="text-sm text-center py-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Skip. Just show me what you&apos;ve got.
          </button>
        </div>
      </Layout>
    )
  }

  // ── Screen: PROCESSING ──────────────────────────────────────────────────────
  if (screen === 'processing') {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen max-w-xl mx-auto gap-6"
        style={{ color: 'var(--accent)' }}
      >
        <span
          className="text-3xl tracking-widest uppercase"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        >
          Aphrodite
        </span>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    )
  }

  // ── Screen: RESPONSE ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen max-w-xl mx-auto">
      <div
        className="px-6 py-4 text-xs uppercase tracking-widest shrink-0"
        style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}
      >
        Aphrodite
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif',
            }}
          >
            {msg.content}
            {streaming && i === messages.length - 1 && (
              <span
                className="inline-block w-1 h-4 ml-0.5 align-middle"
                style={{ background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }}
              />
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Continue button — appears after streaming completes */}
      {done && !streaming && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '20px 24px',
            background: 'var(--bg)',
          }}
        >
          <button
            onClick={handleContinue}
            className="w-full py-3 text-sm uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'Georgia, serif', letterSpacing: '0.2em' }}
          >
            Continue to your temple
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Layout wrapper ────────────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  const childArray = Array.isArray(children) ? children : [children]
  const main = childArray.slice(0, -1)
  const cta = childArray[childArray.length - 1]

  return (
    <div className="flex justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-xl flex flex-col">
        <div
          className="px-6 py-4 text-xs uppercase tracking-widest shrink-0"
          style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}
        >
          Aphrodite
        </div>
        <div className="px-6 pt-6 pb-40">
          {main}
        </div>
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 pb-8 pt-4"
          style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}
        >
          {cta}
        </div>
      </div>
    </div>
  )
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function Cta({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 text-sm uppercase tracking-widest transition-opacity disabled:opacity-30"
      style={{ background: 'var(--accent)', color: 'var(--bg)' }}
    >
      {label}
    </button>
  )
}

// ─── Email capture ─────────────────────────────────────────────────────────────

function EmailCapture({
  sessionToken,
  onContinue,
}: {
  sessionToken: string | null
  onContinue: () => void
}) {
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Detect if input looks like a phone number
  const isPhone = /^[\d\s\-()+]+$/.test(contact) && contact.replace(/\D/g, '').length >= 7

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact.trim() || !sessionToken) return
    setSubmitting(true)
    await fetch('/api/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        ...(isPhone ? { phone: contact.trim() } : { email: contact.trim() }),
      }),
    })
    setSubmitted(true)
    setTimeout(onContinue, 800)
  }

  if (submitted) {
    return (
      <div className="mt-10 flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          The thread stays open.
        </p>
        <button
          onClick={onContinue}
          className="w-full py-3 text-sm uppercase tracking-widest"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          Enter the temple
        </button>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <p className="text-sm mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
        To keep the connection.
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Email or phone, whichever you prefer.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="email or phone"
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={submitting || !contact.trim()}
          className="px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          {submitting ? '…' : 'Yes'}
        </button>
      </form>
      <button
        onClick={onContinue}
        className="mt-3 text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        Skip. Enter the temple.
      </button>
    </div>
  )
}
