import Anthropic from '@anthropic-ai/sdk'
import { UserProfile, Message } from '@/types/aphrodite'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const EXTRACTION_PROMPT = `You are a data extraction assistant. Read the conversation below and extract the user profile into the exact JSON schema provided.

Rules:
- Extract only what was explicitly stated or clearly implied
- For array fields, return [] if nothing was mentioned
- For date fields, use ISO 8601 format (YYYY-MM-DD). Convert relative dates using today's date: TODAY_DATE
- current_phase: calculate from last_period_start + cycle_length_average. If perimenopause_flag is true or cycle_regularity is "absent", set to "indeterminate". If unknown, set to "unknown".
- perimenopause_flag: true if user mentioned hot flashes, night sweats, absent periods, or perimenopausal symptoms
- Do not infer. If a field is unknown, use null.
- Return ONLY valid JSON. No explanation, no markdown fences.

Schema:
{
  "name": "string",
  "age_range": "string | null",
  "cycle_length_average": "number | null",
  "cycle_regularity": "regular | irregular | unknown | absent",
  "last_period_start": "date string | null",
  "current_phase": "string",
  "perimenopause_flag": "boolean",
  "primary_symptoms": ["string"],
  "symptom_duration": "string | null",
  "apps_abandoned": ["string"],
  "why_abandoned": "string | null",
  "already_tried": ["string"],
  "birth_control": "string | null",
  "notable_life_context": "string | null"
}`

export async function extractProfile(
  conversationHistory: Message[],
  name: string,
  timezone: string
): Promise<Partial<UserProfile>> {
  const today = new Date().toISOString().split('T')[0]
  const prompt = EXTRACTION_PROMPT.replace('TODAY_DATE', today)

  const transcript = conversationHistory
    .map((m) => `${m.role === 'user' ? 'User' : 'Aphrodite'}: ${m.content}`)
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nConversation:\n${transcript}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  try {
    const parsed = JSON.parse(text) as Partial<UserProfile>
    // Ensure name and timezone from setup screen take precedence
    parsed.name = name
    parsed.timezone = timezone
    return parsed
  } catch {
    console.error('Profile extraction parse failed:', text)
    return { name, timezone }
  }
}
