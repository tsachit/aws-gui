import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, GitBranch, CheckCircle, XCircle } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { PipelineSummary, PipelineState, PipelineStageAction } from '../types/electron-api'
import {
  getCachedPipelines,
  setCachedPipelines,
  getSelectedPipelineName,
  setSelectedPipelineName,
} from '../pipelineStore'
import { getCache, setCache, TTL_2M } from '../cache'

const stateKey = (name: string) => `pipeline:state:${name}`

interface ApprovalAction extends PipelineStageAction {
  stageName: string
}

function findPendingApproval(state: PipelineState): ApprovalAction | null {
  for (const stage of state.stages) {
    for (const action of stage.actionStates) {
      if (action.status === 'InProgress' && action.token) {
        return { ...action, stageName: stage.stageName }
      }
    }
  }
  return null
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function sourceCommit(state: PipelineState): string {
  const source = state.stages.find(s => s.stageName.toLowerCase() === 'source')
  if (!source) return ''
  const action = source.actionStates[0]
  if (!action?.summary) return ''
  const match = action.summary.match(/([a-f0-9]{7,40})/i)
  return match ? match[1].slice(0, 7) : action.summary.slice(0, 40)
}

function statusBg(status: string): string {
  const s = status.toLowerCase()
  if (s === 'succeeded') return 'border-green-500 dark:border-green-600'
  if (s === 'inprogress') return 'border-yellow-400 dark:border-yellow-500'
  if (s === 'failed') return 'border-red-500 dark:border-red-600'
  return 'border-gray-300 dark:border-gray-600'
}

export function Pipeline() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>(() => getCachedPipelines())
  const [selectedName, setSelectedName] = useState<string | null>(() => getSelectedPipelineName())
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(() => {
    const saved = getSelectedPipelineName()
    return saved ? getCache<PipelineState>(stateKey(saved), TTL_2M) : null
  })
  const [fetching, setFetching] = useState(false)      // background refresh of pipeline list
  const [stateLoading, setStateLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [approvalResult, setApprovalResult] = useState<string | null>(null)
  const [approvalDone, setApprovalDone] = useState(false)

  const loadPipelines = useCallback(async () => {
    setFetching(true)
    setListError(null)
    try {
      const result = await window.electronAPI.listPipelines()
      setPipelines(result)
      setCachedPipelines(result)
      if (result.length > 0 && !getSelectedPipelineName()) {
        setSelectedName(result[0].name)
        setSelectedPipelineName(result[0].name)
      }
    } catch (err: unknown) {
      setListError(String(err instanceof Error ? err.message : err))
    } finally {
      setFetching(false)
    }
  }, [])

  const loadState = useCallback(async (name: string, force = false) => {
    // Seed from cache immediately (stale-while-revalidate)
    const cached = getCache<PipelineState>(stateKey(name), TTL_2M)
    if (cached && !force) {
      setPipelineState(cached)
      return
    }
    if (cached) setPipelineState(cached)   // show stale while refreshing
    setStateLoading(true)
    setStateError(null)
    setApprovalResult(null)
    setApprovalDone(false)
    try {
      const result = await window.electronAPI.getPipelineState(name)
      setCache(stateKey(name), result)
      setPipelineState(result)
    } catch (err: unknown) {
      setStateError(String(err instanceof Error ? err.message : err))
    } finally {
      setStateLoading(false)
    }
  }, [])

  // On mount: show cache immediately, fetch fresh in background
  useEffect(() => { loadPipelines() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedName) {
      setSelectedPipelineName(selectedName)
      loadState(selectedName)   // shows cache instantly; background-fetches if stale
    }
  }, [selectedName, loadState])

  const handleApproval = useCallback(async (approved: boolean) => {
    if (!pipelineState) return
    const pending = findPendingApproval(pipelineState)
    if (!pending?.token) return
    setApproving(true)
    setApprovalResult(null)
    try {
      await window.electronAPI.putApproval({
        pipelineName: pipelineState.pipelineName,
        stageName: pending.stageName,
        actionName: pending.actionName,
        token: pending.token,
        approved,
      })
      setApprovalDone(true)
      setApprovalResult(approved ? '✅ Approved.' : '❌ Rejected.')
      setTimeout(() => { selectedName && loadState(selectedName, true); setApprovalDone(false); setApprovalResult(null) }, 2000)
    } catch (err: unknown) {
      setApprovalResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setApproving(false)
    }
  }, [pipelineState, selectedName, loadState])

  const pendingApproval = pipelineState ? findPendingApproval(pipelineState) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top half — pipeline grid */}
      <div className="flex flex-col min-h-0" style={{ flex: '0 0 auto', maxHeight: '50%' }}>
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">CodePipeline</h2>
            {fetching && <RefreshCw size={13} className="animate-spin text-gray-400" />}
          </div>
          <button
            onClick={loadPipelines}
            disabled={fetching}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {listError && (
          <div className="px-6 py-2 text-xs text-red-400 font-mono shrink-0">{listError}</div>
        )}

        <div className="overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pipelines.map(p => (
              <button
                key={p.name}
                onClick={() => setSelectedName(p.name)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  selectedName === p.name
                    ? `${statusBg(p.status)} bg-gray-50 dark:bg-gray-800`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <GitBranch size={11} className="text-gray-400 shrink-0" />
                  <span className="text-xs font-semibold truncate">{p.name}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <StatusBadge status={p.status} />
                  <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(p.updatedAt)}</span>
                </div>
              </button>
            ))}
            {!fetching && pipelines.length === 0 && !listError && (
              <p className="col-span-full text-sm text-gray-400">No CodePipelines found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 shrink-0" />

      {/* Bottom half — stage detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedName && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a CodePipeline above to view its stages.
          </div>
        )}

        {selectedName && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold">{selectedName}</h2>
                {pipelineState && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    commit: {sourceCommit(pipelineState) || '—'}
                  </p>
                )}
              </div>
              <button
                onClick={() => loadState(selectedName, true)}
                disabled={stateLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={stateLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {stateError && (
              <div className="mb-5 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300 text-sm font-mono">
                {stateError}
              </div>
            )}

            {stateLoading && !pipelineState && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw size={14} className="animate-spin" /> Loading stages…
              </div>
            )}

            {pipelineState && (
              <>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-5">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Stage</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {pipelineState.stages.map(stage => (
                        <tr key={stage.stageName} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">{stage.stageName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={stage.latestExecution?.status ?? 'Unknown'} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {stage.actionStates.map(a => (
                                <span key={a.actionName} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">{a.actionName}:</span>
                                  <StatusBadge status={a.status} />
                                  {a.summary && (
                                    <span className="font-mono text-gray-400 text-[10px]">
                                      {a.summary.slice(0, 7)}
                                    </span>
                                  )}
                                  {a.token && (
                                    <span className="text-yellow-500 text-[10px] font-bold">NEEDS APPROVAL</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {approvalDone && approvalResult && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-5 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">
                    {approvalResult} Refreshing…
                  </div>
                )}

                {pendingApproval && !approvalDone && (
                  <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-5">
                    <h3 className="font-semibold mb-1 text-yellow-800 dark:text-yellow-200">Manual Approval Required</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                      Stage <strong>{pendingApproval.stageName}</strong> — <strong>{pendingApproval.actionName}</strong> is waiting.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApproval(true)}
                        disabled={approving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleApproval(false)}
                        disabled={approving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                    {approvalResult && (
                      <p className="mt-3 text-sm font-mono text-red-600 dark:text-red-400">{approvalResult}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
