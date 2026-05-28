'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  profile: {
    name: string
    primary_symptoms: string[]
    perimenopause_flag: boolean
    last_period_start: string | null
    cycle_length_average: number | null
    cycle_regularity: string | null
  }
  cycle_day: number | null
  phase: string
  streak: number
  logged_today: boolean
  user_id: string | null
}

// ─── Client-side cycle helpers ────────────────────────────────────────────────

function clientCycleDay(lastPeriodStart: string, cycleLen: number): number {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastPeriodStart).getTime()) / (1000 * 60 * 60 * 24)
  )
  return (daysSince % cycleLen) + 1
}

function clientPhase(cycleDay: number, cycleLen: number): string {
  if (cycleDay <= 5) return 'menstrual'
  if (cycleDay <= Math.round(cycleLen * 0.45)) return 'follicular'
  if (cycleDay <= Math.round(cycleLen * 0.55)) return 'ovulatory'
  return 'luteal'
}

const SLEEP_CHIPS = [
  { label: 'Poor', value: 1 },
  { label: 'Okay', value: 3 },
  { label: 'Good', value: 5 },
]

const ENERGY_CHIPS = [
  { label: 'Low', value: 1 },
  { label: 'Medium', value: 3 },
  { label: 'High', value: 5 },
]

const BRAIN_FOG_CHIPS = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

const PHASE_DISPLAY: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  indeterminate: '',
  unknown: '',
}

// ─── Chip category label ──────────────────────────────────────────────────────

function ChipLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: 'var(--text-secondary)',
        fontSize: '9px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: 0.5,
      }}
    >
      {children}
    </span>
  )
}

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip({
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
      style={{
        padding: '6px 16px',
        fontSize: '12px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        background: selected ? 'var(--accent)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
        color: selected ? 'var(--bg)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderRadius: '1px',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [observation, setObservation] = useState<string>('')
  const [obsLoading, setObsLoading] = useState(true)

  // Logging state
  const [sleep, setSleep] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [brainFog, setBrainFog] = useState<'yes' | 'no' | null>(null)
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loggedToday, setLoggedToday] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) {
        router.push('/onboarding')
        return
      }
      const json = await res.json()

      if (json.needs_onboarding) {
        router.push('/onboarding/chat')
        return
      }

      console.log('[Aphrodite] dashboard data:', JSON.stringify({
        cycle_day: json.cycle_day,
        phase: json.phase,
        last_period_start: json.profile?.last_period_start,
        cycle_length_average: json.profile?.cycle_length_average,
        cycle_regularity: json.profile?.cycle_regularity,
        perimenopause_flag: json.profile?.perimenopause_flag,
        primary_symptoms: json.profile?.primary_symptoms,
        user_id: json.user_id,
      }, null, 2))
      setData(json)
      setLoggedToday(json.logged_today)

      const obsRes = await fetch('/api/dashboard/observation', { method: 'POST' })
      if (obsRes.ok) {
        const { observation: obs } = await obsRes.json()
        setObservation(obs)
      }
      setObsLoading(false)
    }
    load()
  }, [router])

  function toggleSymptom(s: string) {
    setActiveSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  async function handleSubmit() {
    if (!sleep || !energy) return
    setSubmitting(true)

    const symptoms = [...activeSymptoms]
    if (brainFog === 'yes' && !symptoms.includes('Brain fog')) {
      symptoms.push('Brain fog')
    }

    const res = await fetch('/api/dashboard/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sleep_quality: sleep,
        energy_level: energy,
        symptoms,
        notes: notes.trim() || null,
      }),
    })

    setSubmitting(false)
    if (res.ok) {
      setLoggedToday(true)
      setObsLoading(true)
      const obsRes = await fetch('/api/dashboard/observation', { method: 'POST' })
      if (obsRes.ok) {
        const { observation: obs } = await obsRes.json()
        setObservation(obs)
      }
      setObsLoading(false)
    }
  }

  const canSubmit = sleep !== null && energy !== null && !submitting

  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg)',
          color: 'var(--accent)',
          fontSize: '13px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ animation: 'pulse 2s ease-in-out infinite' }}>Aphrodite</span>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    )
  }

  // Resolve cycle day client-side if server didn't compute it
  const p = data.profile
  const cycleLen = p.cycle_length_average ?? 28
  let resolvedCycleDay = data.cycle_day
  let resolvedPhase = data.phase
  if (!resolvedCycleDay && p.last_period_start && p.cycle_regularity !== 'absent') {
    resolvedCycleDay = clientCycleDay(p.last_period_start, cycleLen)
    if (!p.perimenopause_flag) resolvedPhase = clientPhase(resolvedCycleDay, cycleLen)
  }
  console.log('[Aphrodite] resolved:', { resolvedCycleDay, resolvedPhase })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Wordmark */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Aphrodite
        </span>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 0 100px 0' }}>

        {/* Oracle reading — full width, no competing elements */}
        <div style={{ padding: '56px 28px 48px', textAlign: 'center' }}>

          {/* Cycle day — subtle line above reading */}
          {resolvedCycleDay && resolvedCycleDay > 0 && PHASE_DISPLAY[resolvedPhase] && (
            <p
              style={{
                color: 'var(--accent)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                opacity: 0.6,
                margin: '0 0 28px 0',
              }}
            >
              Day {resolvedCycleDay}. {PHASE_DISPLAY[resolvedPhase]}.
            </p>
          )}

          {obsLoading ? (
            <span
              style={{
                color: 'var(--accent)',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                opacity: 0.5,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              Reading
            </span>
          ) : (
            <p
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'Georgia, serif',
                fontSize: '21px',
                lineHeight: '2.0',
                margin: 0,
              }}
            >
              {observation}
            </p>
          )}
        </div>

        {/* Log section */}
        <div style={{ padding: '0 24px' }}>
          {loggedToday ? (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              Today is logged.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Sleep */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ChipLabel>Sleep</ChipLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {SLEEP_CHIPS.map((c) => (
                    <Chip
                      key={c.label}
                      label={c.label}
                      selected={sleep === c.value}
                      onClick={() => setSleep(c.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ChipLabel>Energy</ChipLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {ENERGY_CHIPS.map((c) => (
                    <Chip
                      key={c.label}
                      label={c.label}
                      selected={energy === c.value}
                      onClick={() => setEnergy(c.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Brain fog */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ChipLabel>Brain fog</ChipLabel>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {BRAIN_FOG_CHIPS.map((c) => (
                    <Chip
                      key={c.label}
                      label={c.label}
                      selected={brainFog === c.value}
                      onClick={() => setBrainFog(c.value as 'yes' | 'no')}
                    />
                  ))}
                </div>
              </div>

              {/* How's your body today? — symptoms + notes, always together */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                  }}
                >
                  How&apos;s your body today?
                </span>

                {/* Exclude symptoms that have dedicated rows above */}
                {(data.profile.primary_symptoms ?? []).filter((s) => s.toLowerCase() !== 'brain fog').length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(data.profile.primary_symptoms ?? [])
                      .filter((s) => s.toLowerCase() !== 'brain fog')
                      .map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          selected={activeSymptoms.includes(s)}
                          onClick={() => toggleSymptom(s)}
                        />
                      ))}
                  </div>
                )}

                {/* Notes — separate from chips, never a chip */}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What you ate, how you felt, what you noticed..."
                  rows={2}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    padding: '10px 12px',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  background: canSubmit ? 'var(--accent)' : 'var(--surface)',
                  color: canSubmit ? 'var(--bg)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '14px',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  cursor: canSubmit ? 'pointer' : 'default',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {submitting ? 'Logging...' : 'Log today'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Streak — bottom right corner, not the focus */}
      {data.streak > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            color: 'var(--text-secondary)',
            fontSize: '10px',
            letterSpacing: '0.06em',
            opacity: 0.4,
          }}
        >
          {data.streak} day{data.streak !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
