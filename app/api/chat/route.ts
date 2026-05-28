import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { buildSystemPrompt } from '@/lib/anthropic/system-prompt'
import { createServiceClient } from '@/lib/supabase/server'
import { Message, UserProfile } from '@/types/aphrodite'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  const { session_token, message, mode } = await req.json()

  if (!session_token || !message) {
    return new Response('Missing session_token or message', { status: 400 })
  }

  const supabase = createServiceClient()

  // Load session
  const { data: session, error } = await supabase
    .from('onboarding_sessions')
    .select('conversation_history, partial_profile, perimenopause_flag_detected')
    .eq('session_token', session_token)
    .single()

  if (error || !session) {
    return new Response('Session not found', { status: 404 })
  }

  const history: Message[] = session.conversation_history ?? []
  const profile: Partial<UserProfile> = session.partial_profile ?? {}
  const perimenopause = session.perimenopause_flag_detected ?? false

  if (perimenopause) profile.perimenopause_flag = true

  // Append user message to history
  const userMessage: Message = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  }

  // For the first response trigger, replace the synthetic message with
  // a plain prompt so Aphrodite generates the Mode A insight
  const resolvedMessage =
    message === '__GENERATE_FIRST_RESPONSE__'
      ? `Based on everything I've just told you, what are you seeing? Give me your first response.`
      : message

  const finalHistory = [...history, { ...userMessage, content: resolvedMessage }]

  // Build messages array for Anthropic (strip timestamp — not part of API shape)
  const apiMessages = finalHistory.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const resolvedMode: 'A' | 'B' = mode === 'B' ? 'B' : 'A'
  const systemPrompt = buildSystemPrompt(resolvedMode, profile)

  // Persist updated history before streaming (fire and forget)
  supabase
    .from('onboarding_sessions')
    .update({ conversation_history: finalHistory })
    .eq('session_token', session_token)
    .then(() => {})

  // Stream response from Anthropic
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''

      try {
        const anthropicStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullResponse += text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`)
            )
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        // Append assistant response to history in Supabase
        const assistantMessage: Message = {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        }
        const historyWithResponse = [...finalHistory, assistantMessage]
        await supabase
          .from('onboarding_sessions')
          .update({ conversation_history: historyWithResponse })
          .eq('session_token', session_token)
      } catch (err) {
        console.error('Anthropic stream error:', err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`
          )
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
