import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  labels?: Record<string, string>   // optional display label overrides per value
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({ value, onChange, options, labels = {}, placeholder = 'Select…', disabled = false, className = '' }: Props) {
  const display = (v: string) => labels[v] ?? v
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [highlighted, setHighlighted] = useState(0)

  const filtered = query
    ? options.filter(o => display(o).toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlighted(0) }, [query])

  const select = useCallback((opt: string) => {
    onChange(opt)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'Escape') { setOpen(false); setQuery(''); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter' && filtered[highlighted]) { e.preventDefault(); select(filtered[highlighted]); return }
  }, [open, filtered, highlighted, select])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const displayValue = open ? undefined : (value ? display(value) : '')

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm font-mono cursor-text transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-600'
            : open
              ? 'border-orange-500 ring-2 ring-orange-500/30'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
        }`}
        onClick={() => { if (!disabled) { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0) } }}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
      >
        <input
          ref={inputRef}
          value={open ? query : displayValue ?? ''}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (!disabled) setOpen(true) }}
          placeholder={open ? 'Type to filter…' : (value ? undefined : placeholder)}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none min-w-0 placeholder-gray-400 dark:placeholder-gray-500 cursor-text"
          onKeyDown={handleKeyDown}
        />
        <ChevronDown
          size={13}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg text-sm font-mono py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">No matches</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt}
                onMouseDown={() => select(opt)}
                onMouseEnter={() => setHighlighted(i)}
                className={`px-3 py-2 cursor-pointer truncate ${
                  opt === value
                    ? 'bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                    : i === highlighted
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {display(opt)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
