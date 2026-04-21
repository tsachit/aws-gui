import { useState, useEffect, useCallback } from 'react'
import { Lock, Eye, EyeOff, Copy, Edit2, Check, X, RefreshCw } from 'lucide-react'
import { SecretEntry } from '../types/electron-api'
import { getCache, setCache, clearCache, TTL_5M } from '../cache'

const LIST_KEY = 'secrets:list'

export function Secrets() {
  const [secrets, setSecrets] = useState<SecretEntry[]>(() => getCache<SecretEntry[]>(LIST_KEY, TTL_5M) ?? [])
  const [listRefreshing, setListRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SecretEntry | null>(null)
  const [value, setValue] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refreshList = useCallback(async () => {
    setListRefreshing(true)
    try {
      const list = await window.electronAPI.listSecrets()
      setCache(LIST_KEY, list)
      setSecrets(list)
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setListRefreshing(false)
    }
  }, [])

  // On mount: cache already seeded; background-refresh
  useEffect(() => { refreshList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSecret = useCallback(async (entry: SecretEntry) => {
    setSelected(entry)
    setValue(null)
    setRevealed(false)
    setEditing(false)
    setSaveResult(null)
    setError(null)
    setLoading(true)
    try {
      const v = await window.electronAPI.getSecretValue(entry.arn)
      setValue(v)
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (!selected) return
    await window.electronAPI.copySecret(selected.arn)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [selected])

  const handleSave = useCallback(async () => {
    if (!selected) return
    setSaving(true)
    setSaveResult(null)
    try {
      await window.electronAPI.updateSecret(selected.arn, editValue)
      setValue(editValue)
      // Invalidate list cache so updated date reflects on next load
      clearCache(LIST_KEY)
      setEditing(false)
      setRevealed(false)
      setSaveResult('✅ Saved!')
      setTimeout(() => setSaveResult(null), 3000)
    } catch (err: unknown) {
      setSaveResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }, [selected, editValue])

  const filtered = secrets.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  function formatDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div className="flex h-full">
      {/* Left panel — secrets list */}
      <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-orange-400" />
              <h2 className="text-lg font-bold">Secrets</h2>
            </div>
            <button
              onClick={() => { clearCache(LIST_KEY); refreshList() }}
              disabled={listRefreshing}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
              title="Reload secrets list"
            >
              <RefreshCw size={13} className={listRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search secrets…"
            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {listRefreshing && secrets.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-4 text-xs text-gray-400">
              <RefreshCw size={11} className="animate-spin" /> Loading…
            </div>
          )}
          {filtered.map(s => (
            <button
              key={s.arn}
              onClick={() => selectSecret(s)}
              disabled={loading}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors disabled:opacity-60 ${
                selected?.arn === s.arn
                  ? 'bg-orange-50 dark:bg-orange-950 border-l-2 border-l-orange-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">Updated {formatDate(s.lastChangedDate)}</div>
            </button>
          ))}
          {!listRefreshing && filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No secrets found.</p>
          )}
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selected && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a secret to view its value.
          </div>
        )}

        {selected && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-1 font-mono">{selected.name}</h3>
            <p className="text-xs text-gray-400 mb-6">
              {selected.arn} · Updated {formatDate(selected.lastChangedDate)}
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300 text-sm font-mono">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw size={13} className="animate-spin" /> Loading value…
              </div>
            )}

            {value !== null && !loading && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Value</span>
                  <div className="flex gap-2">
                    {!editing && (
                      <>
                        <button
                          onClick={() => setRevealed(r => !r)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                          {revealed ? 'Hide' : 'Reveal'}
                        </button>
                        <button
                          onClick={handleCopy}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Copy size={12} />
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => { setEditing(true); setEditValue(value ?? ''); setRevealed(true) }}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editing ? (
                  <>
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setRevealed(false); setEditValue('') }}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-3 break-all">
                    {revealed ? value : '••••••••••••••••••••'}
                  </div>
                )}

                {saveResult && (
                  <p className="mt-3 text-sm font-mono text-gray-600 dark:text-gray-300">{saveResult}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
