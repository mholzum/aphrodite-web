'use client'

import { useState } from 'react'
import ChatInput from './ChatInput'

const CHIPS = [
  'Hormonal acne',
  'Energy crashes',
  'Mood swings',
  'Irregular cycles',
  'Pain or cramps',
  'Something else',
]

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function SymptomChips({ onSend, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showFreeText, setShowFreeText] = useState(false)

  function handleChip(chip: string) {
    if (disabled) return
    if (chip === 'Something else') {
      setShowFreeText(true)
      return
    }
    setSelected(chip)
    setTimeout(() => onSend(chip), 150) // brief delay so selected state renders
  }

  if (showFreeText) {
    return (
      <ChatInput
        onSend={onSend}
        disabled={disabled}
        placeholder="Tell her what's going on…"
      />
    )
  }

  return (
    <div
      className="px-4 pt-1 pb-4 flex flex-wrap gap-2"
      style={{ background: 'var(--bg)' }}
    >
      {CHIPS.map((chip) => {
        const isSelected = selected === chip
        return (
          <button
            key={chip}
            onClick={() => handleChip(chip)}
            disabled={disabled || (selected !== null && !isSelected)}
            className="px-4 py-2 text-sm transition-all disabled:opacity-30"
            style={{
              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--accent-dim)'}`,
              background: isSelected ? 'var(--accent)' : 'transparent',
              color: isSelected ? 'var(--bg)' : 'var(--accent)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.02em',
            }}
          >
            {chip}
          </button>
        )
      })}
    </div>
  )
}
