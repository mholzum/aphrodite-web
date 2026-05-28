// Aphrodite's scripted messages per exchange step.
// Matches aphrodite-onboarding-final.md exactly.
// Step 0 is the initial message Aphrodite sends when chat loads.
// Steps 1–7 are triggered after the user's response to each prior exchange.

export type BranchKey = 'standard' | 'perimenopause'

export function getAphroditePrompt(step: number, flag: boolean): string {
  const branch: BranchKey = flag ? 'perimenopause' : 'standard'

  const messages: Record<number, string | Record<BranchKey, string>> = {
    // Exchange 1 — opening (sent on chat load, before any user input)
    0: `One thing before we begin: I give you education and experiments, not diagnosis. Not a clinician. Something more useful.

Tell me what's been happening.`,

    // Exchange 3 — apps + frustration (after symptom depth)
    2: `Before me, what have you tried? An app, a tracker, anything?`,

    // Exchange 4 — already tried
    3: `Has anything moved it? Supplements, diet changes, cutting something out?`,

    // Exchange 5 — birth control
    4: `Hormonal birth control. Are you on anything? Pill, IUD, implant?`,

    // Exchange 6 — life context
    5: `One more. What is your life asking of you right now? Sleep, stress, how much you're moving. The honest answer.`,

    // Exchange 7 — cycle mechanics (branched)
    6: {
      standard: `Two things.

When did your last period start?`,
      perimenopause: `When did you last have a period? Even approximate.`,
    },

    // Exchange 7b — cycle length (sent after last period answer)
    7: `How long is your cycle? Does it keep a rhythm?`,
  }

  const entry = messages[step]
  if (!entry) return ''
  if (typeof entry === 'string') return entry
  return entry[branch]
}

// Goal language — user said why they're here, not what's wrong
const GOAL_SIGNALS = [
  'learn',
  'understand',
  'curious',
  'cycle sync',
  'cycle syncing',
  'optimize',
  'track',
  'tracking',
  'get better',
  'improve',
  'figure out',
  'know more',
  'more about',
  'interested in',
  'want to',
  'hoping to',
]

// Symptom language — confirms something physical is actually happening
const SYMPTOM_SIGNALS = [
  'acne', 'breakout', 'skin',
  'energy', 'tired', 'fatigue', 'crash', 'exhausted',
  'mood', 'anxiety', 'depression', 'irritable', 'emotional',
  'pain', 'cramp', 'bloat', 'headache', 'migraine',
  'sleep', 'insomnia', 'waking',
  'libido', 'sex drive',
  'weight', 'bloating',
  'irregular', 'heavy', 'spotting', 'discharge',
  'pms', 'pmdd',
]

export function isGoalNotSymptom(text: string): boolean {
  const lower = text.toLowerCase()
  const hasGoalLanguage = GOAL_SIGNALS.some((s) => lower.includes(s))
  const hasSymptomLanguage = SYMPTOM_SIGNALS.some((s) => lower.includes(s))
  // Goal redirect only fires if they gave goal language without any symptom
  return hasGoalLanguage && !hasSymptomLanguage
}

export function hasSymptom(text: string): boolean {
  const lower = text.toLowerCase()
  return SYMPTOM_SIGNALS.some((s) => lower.includes(s))
}

// Exchange 2 branching — depends on what the user said in exchange 1
export function getSymptomDepthPrompt(
  userSymptomText: string,
  perimenopause: boolean
): string {
  // Fix 1: user gave a goal, not a symptom — redirect before moving forward
  if (isGoalNotSymptom(userSymptomText)) {
    return `Cycle syncing is the destination. To get there, I need to know what's been pulling you off course.

What has your body been doing that brought you here?`
  }

  if (perimenopause) {
    return `Unpredictability is its own weight. You cannot brace for what has no pattern. How long has your body been like this?`
  }

  const lower = userSymptomText.toLowerCase()
  // Heuristic: did they mention two or more symptoms?
  const multipleSignals = [' and ', ' plus ', ',', 'also', 'as well', 'both'].some(
    (s) => lower.includes(s)
  )

  if (multipleSignals) {
    return `Those two together mean something. How long has your body been carrying this?`
  }

  return `That rarely travels alone. What else appears alongside it? Energy, mood, anything?`
}

// Fix 2: check if we have at least one symptom before advancing to Exchange 3
// Called in the chat page before stepping from Exchange 2 → 3
export function getSymptomGatePrompt(): string {
  return `To give you something real, I need something specific.

What has been showing up in your body? One thing is enough.`
}

// Detect perimenopause signals in any user message
export function detectPerimenopause(text: string): boolean {
  const signals = [
    'hot flash',
    'hot flashes',
    'night sweat',
    'night sweats',
    'perimenopause',
    'peri-menopause',
    'no period',
    'haven\'t had a period',
    'missed periods',
    'skipped my period',
    'irregular for years',
    'irregular for a few years',
    'periods stopped',
    'periods are stopping',
  ]
  const lower = text.toLowerCase()
  return signals.some((s) => lower.includes(s))
}
