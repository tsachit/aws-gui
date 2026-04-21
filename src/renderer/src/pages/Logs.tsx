import { useState, useEffect, useRef, useCallback } from 'react'
import { ScrollText, RefreshCw, Play, Square } from 'lucide-react'
import { SearchableSelect } from '../components/SearchableSelect'
import { LogEvent } from '../types/electron-api'
import { getCache, setCache, clearCache, TTL_10M } from '../cache'

const TIME_RANGES: Record<string, number> = {
  '5m':   5  * 60 * 1000,
  '30m':  30 * 60 * 1000,
  '1h':   60 * 60 * 1000,
  '3h':   3  * 60 * 60 * 1000,
  '12h':  12 * 60 * 60 * 1000,
  '24h':  24 * 60 * 60 * 1000,
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
    <div className="flex flex-col h-full p-6">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ScrollText size={20} className="text-orange-400" />
        <h2 className="text-xl font-bold">CloudWatch Logs</h2>
      </div>

      {/* Query definition panel */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-3">

        {/* Log group row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 w-20">Log Group</span>
          <SearchableSelect
            value={selectedGroup}
            onChange={handleGroupChange}
            options={logGroups}
            placeholder={logGroups.length === 0 ? 'Loading groups…' : 'Select log group…'}
            disabled={groupsRefreshing && logGroups.length === 0}
            className="flex-1"
          />
          <button
            onClick={() => { clearCache(GROUPS_KEY); refreshGroups() }}
            disabled={groupsRefreshing}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
            title="Reload log groups"
          >
            <RefreshCw size={13} className={groupsRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Time range pills */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 w-20">Time range</span>
          <div className="flex gap-1">
            {Object.keys(TIME_RANGES).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  timeRange === r
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Filter / query textarea */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter pattern</span>
            <span className="text-[10px] text-gray-400 font-mono">e.g. ERROR, [level=ERROR], "timeout"</span>
          </div>
          <textarea
            value={filterPattern}
            onChange={e => setFilterPattern(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch() }}
            placeholder={'ERROR\n[level=ERROR]\n"connection timeout"'}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y placeholder-gray-300 dark:placeholder-gray-600"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={handleSearch}
            disabled={loading || !selectedGroup || groupsRefreshing}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Running…' : 'Run query'}
          </button>

          <button
            onClick={handleTailToggle}
            disabled={!selectedGroup || groupsRefreshing}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              isTailing ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isTailing ? <><Square size={13} /> Stop tailing</> : <><Play size={13} /> Start tailing</>}
          </button>

          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400 font-mono">⌘↵ to run</span>
        </div>
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
        <div className="mb-3 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300 text-xs font-mono">
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
            {selectedGroup ? 'Click Run query or Start tailing to load logs.' : 'Select a log group above.'}
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
