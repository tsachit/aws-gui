import { useState, useEffect, useRef, useCallback } from 'react'
import { ScrollText, RefreshCw, Play, Square } from 'lucide-react'
import { LogEvent } from '../types/electron-api'
import { getCache, setCache, clearCache, TTL_10M } from '../cache'

const TIME_RANGES: Record<string, number> = {
  '15m':  15 * 60 * 1000,
  '30m':  30 * 60 * 1000,
  '1h':   60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
}

const GROUPS_KEY = 'logs:groups'

// Persist selected group across navigation
let _savedGroup = ''

function formatTs(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23)
}

function lineColor(msg: string): string {
  const u = msg.toUpperCase()
  if (u.includes('ERROR') || u.includes('FATAL')) return 'text-red-400'
  if (u.includes('WARN'))  return 'text-yellow-400'
  return 'text-green-300'
}

export function Logs() {
  const [logGroups, setLogGroups] = useState<string[]>(() => getCache<string[]>(GROUPS_KEY, TTL_10M) ?? [])
  const [groupsRefreshing, setGroupsRefreshing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(_savedGroup || (getCache<string[]>(GROUPS_KEY, TTL_10M)?.[0] ?? ''))
  const [timeRange, setTimeRange] = useState('30m')
  const [filterPattern, setFilterPattern] = useState('')
  const [events, setEvents] = useState<{ ts: string; msg: string }[]>([])
  const [isTailing, setIsTailing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tailIdRef = useRef<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const refreshGroups = useCallback(async () => {
    setGroupsRefreshing(true)
    try {
      const groups = await window.electronAPI.listLogGroups()
      setCache(GROUPS_KEY, groups)
      setLogGroups(groups)
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0])
        _savedGroup = groups[0]
      }
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setGroupsRefreshing(false)
    }
  }, [selectedGroup])

  // On mount: cache already seeded in useState; background-refresh
  useEffect(() => { refreshGroups() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [events])

  const handleGroupChange = useCallback((g: string) => {
    setSelectedGroup(g)
    _savedGroup = g
  }, [])

  const stopTail = useCallback(async () => {
    if (tailIdRef.current) {
      await window.electronAPI.killCommand(tailIdRef.current)
      tailIdRef.current = null
    }
    setIsTailing(false)
  }, [])

  const handleSearch = useCallback(async () => {
    await stopTail()
    if (!selectedGroup) return
    setLoading(true)
    setError(null)
    setEvents([])
    const endMs = Date.now()
    const startMs = endMs - TIME_RANGES[timeRange]
    try {
      const results: LogEvent[] = await window.electronAPI.searchLogs(
        selectedGroup, startMs, endMs, filterPattern
      )
      setEvents(results.map(e => ({ ts: formatTs(e.timestamp), msg: e.message })))
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }, [selectedGroup, timeRange, filterPattern, stopTail])

  const handleTailToggle = useCallback(async () => {
    if (isTailing) { await stopTail(); return }
    if (!selectedGroup) return
    setError(null)
    const command = await window.electronAPI.logsStreamCommand(selectedGroup, filterPattern)
    const id = `tail-${Date.now()}`
    tailIdRef.current = id
    setIsTailing(true)

    const unsubscribe = window.electronAPI.onOutput(event => {
      if (event.id !== id) return
      if (event.type === 'exit') {
        unsubscribe(); setIsTailing(false); tailIdRef.current = null; return
      }
      if (event.type === 'stdout' && event.line.trim()) {
        setEvents(prev => [...prev, { ts: '', msg: event.line }])
      }
    })

    window.electronAPI.runCommand(id, command)
  }, [isTailing, selectedGroup, filterPattern, stopTail])

  return (
    <div className="flex flex-col h-full p-8">
      <div className="flex items-center gap-2 mb-6">
        <ScrollText size={22} className="text-orange-400" />
        <h2 className="text-2xl font-bold">CloudWatch Logs</h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Log group dropdown with reload */}
        <div className="flex items-center gap-1 flex-1 min-w-48">
          <select
            value={selectedGroup}
            onChange={e => handleGroupChange(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {logGroups.length === 0 && <option value="">Loading groups…</option>}
            {logGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button
            onClick={() => { clearCache(GROUPS_KEY); refreshGroups() }}
            disabled={groupsRefreshing}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
            title="Reload log groups"
          >
            <RefreshCw size={13} className={groupsRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Time range */}
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {Object.keys(TIME_RANGES).map(r => (
            <option key={r} value={r}>Last {r}</option>
          ))}
        </select>

        {/* Filter pattern */}
        <input
          value={filterPattern}
          onChange={e => setFilterPattern(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Filter pattern (e.g. ERROR)"
          className="flex-1 min-w-36 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        {/* Search */}
        <button
          onClick={handleSearch}
          disabled={loading || !selectedGroup || groupsRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Search
        </button>

        {/* Tail toggle */}
        <button
          onClick={handleTailToggle}
          disabled={!selectedGroup || groupsRefreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isTailing ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isTailing ? <><Square size={13} /> Stop</> : <><Play size={13} /> Tail</>}
        </button>

        {/* Clear */}
        {events.length > 0 && (
          <button
            onClick={() => setEvents([])}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Streaming indicator */}
      {isTailing && (
        <div className="flex items-center gap-2 mb-2 text-xs text-green-500 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Streaming {selectedGroup}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 rounded-xl bg-gray-950 border border-gray-800 p-4 overflow-y-auto font-mono text-xs min-h-0"
      >
        {events.length === 0 && !loading && (
          <span className="text-gray-600">
            {selectedGroup ? 'Click Search or Tail to load logs.' : 'Select a log group above.'}
          </span>
        )}
        {events.map((e, i) => (
          <div key={i} className={`leading-relaxed ${lineColor(e.msg)}`}>
            {e.ts && <span className="text-gray-500 mr-2">{e.ts}</span>}
            {e.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
