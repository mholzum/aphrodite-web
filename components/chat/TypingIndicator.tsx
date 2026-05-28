export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-6">
      <div className="flex gap-1.5 items-center h-6 px-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{
              background: 'var(--accent-dim)',
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.9s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
