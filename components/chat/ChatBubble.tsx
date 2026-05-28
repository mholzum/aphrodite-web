import { Message } from '@/types/aphrodite'

interface Props {
  message: Message
  streaming?: boolean
}

export default function ChatBubble({ message, streaming }: Props) {
  const isAphrodite = message.role === 'assistant'

  return (
    <div className={`flex ${isAphrodite ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className="max-w-[85%] text-sm leading-7"
        style={{
          color: isAphrodite ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: isAphrodite ? 'Georgia, serif' : 'inherit',
          fontStyle: isAphrodite ? 'normal' : 'normal',
        }}
      >
        {/* Preserve newlines in Aphrodite's messages */}
        {isAphrodite ? (
          <div className="whitespace-pre-wrap">
            {message.content}
            {streaming && (
              <span
                className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </div>
        ) : (
          <div
            className="px-4 py-2.5 inline-block"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  )
}
