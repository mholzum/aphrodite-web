'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div
      className="flex items-end gap-3 px-4 py-3"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Reply…'}
        rows={1}
        className="flex-1 resize-none text-sm leading-relaxed outline-none bg-transparent disabled:opacity-40"
        style={{ color: 'var(--text-primary)' }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="shrink-0 pb-0.5 text-xs uppercase tracking-widest transition-opacity disabled:opacity-30"
        style={{ color: 'var(--accent)' }}
      >
        Send
      </button>
    </div>
  )
}
