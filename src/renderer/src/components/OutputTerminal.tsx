import { useEffect, useRef } from 'react'

export interface Line {
  text: string
  type: 'stdout' | 'stderr' | 'info'
}

interface OutputTerminalProps {
  lines: Line[]
  className?: string
}

export function OutputTerminal({ lines, className = '' }: OutputTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className={`bg-gray-950 rounded-lg p-3 font-mono text-xs overflow-auto ${className}`}>
      {lines.length === 0 && (
        <p className="text-gray-600 italic">No output yet.</p>
      )}
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.type === 'stderr'
              ? 'text-red-400'
              : line.type === 'info'
              ? 'text-yellow-400'
              : 'text-green-300'
          }
        >
          {line.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
