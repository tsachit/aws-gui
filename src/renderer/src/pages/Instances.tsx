import { useState, useCallback, useEffect } from 'react'
import { Terminal, RefreshCw } from 'lucide-react'
import { SearchableSelect } from '../components/SearchableSelect'
import { EcsInstance, TerminalApp } from '../types/electron-api'
import {
  getCachedInstances,
  setCachedInstances,
  invalidateCache,
  getSelectedCluster,
  setSelectedCluster,
  getSelectedService,
  setSelectedService,
} from '../instancesStore'
import { getCache, setCache, clearCache, TTL_10M } from '../cache'

const ALL_SERVICES = '__all__'
const CLUSTERS_KEY = 'ecs:clusters'
const servicesKey = (c: string) => `ecs:services:${c}`

export function Instances() {
  const [clusters, setClusters] = useState<string[]>(() => getCache<string[]>(CLUSTERS_KEY, TTL_10M) ?? [])
  const [services, setServices] = useState<string[]>([])
  const [selectedCluster, setCluster] = useState<string>(() => getSelectedCluster() ?? '')
  const [selectedService, setSvc] = useState<string>(() => getSelectedService() ?? ALL_SERVICES)
  const [instances, setInstances] = useState<EcsInstance[]>([])
  const [clustersRefreshing, setClustersRefreshing] = useState(false)
  const [servicesRefreshing, setServicesRefreshing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [terminalApp, setTerminalApp] = useState<TerminalApp>('iterm2')
  const [customTerminalCommand, setCustomTerminalCommand] = useState('')

  const refreshClusters = useCallback(async () => {
    setClustersRefreshing(true)
    try {
      const list = await window.electronAPI.listClusters()
      setCache(CLUSTERS_KEY, list)
      setClusters(list)
      return list
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
      return null
    } finally {
      setClustersRefreshing(false)
    }
  }, [])

  const refreshServices = useCallback(async (cluster: string) => {
    setServicesRefreshing(true)
    try {
      const list = await window.electronAPI.listServices(cluster)
      setCache(servicesKey(cluster), list)
      setServices(list)
      return list
    } catch {
      setServices([])
      return null
    } finally {
      setServicesRefreshing(false)
    }
  }, [])

  // On mount: restore from cache immediately, then background-refresh
  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setTerminalApp(s.terminalApp)
      setCustomTerminalCommand(s.customTerminalCommand)
    })

    const cluster = getSelectedCluster() ?? ''

    // Services: restore from cache
    if (cluster) {
      const cachedSvcs = getCache<string[]>(servicesKey(cluster), TTL_10M) ?? []
      setServices(cachedSvcs)
      const svc = getSelectedService() ?? ALL_SERVICES
      setSvc(svc)
      setSelectedService(svc)
      const cachedInst = getCachedInstances(cluster, svc)
      if (cachedInst) setInstances(cachedInst)
      refreshServices(cluster)
    }

    // Clusters: already seeded from cache in useState initializer; background-refresh
    refreshClusters().then(list => {
      if (!list) return
      const saved = getSelectedCluster()
      const resolved = (saved && list.includes(saved)) ? saved : (list[0] ?? '')
      if (!cluster && resolved) {
        setCluster(resolved)
        setSelectedCluster(resolved)
        refreshServices(resolved)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClusterChange = useCallback((cluster: string) => {
    setCluster(cluster)
    setSelectedCluster(cluster)
    setInstances([])
    setError(null)
    // Restore cached services immediately
    const cachedSvcs = getCache<string[]>(servicesKey(cluster), TTL_10M) ?? []
    setServices(cachedSvcs)
    setSvc(ALL_SERVICES)
    setSelectedService(ALL_SERVICES)
    refreshServices(cluster)
  }, [refreshServices])

  const handleServiceChange = useCallback((svc: string) => {
    setSvc(svc)
    setSelectedService(svc)
    const cached = getCachedInstances(selectedCluster, svc)
    setInstances(cached ?? [])
    setError(null)
  }, [selectedCluster])

  const fetchInstances = useCallback(async (force = false) => {
    if (!selectedCluster) return
    if (!force) {
      const cached = getCachedInstances(selectedCluster, selectedService)
      if (cached) { setInstances(cached); return }
    }
    setLoading(true)
    setError(null)
    try {
      const filter = selectedService !== ALL_SERVICES ? selectedService : undefined
      const result = await window.electronAPI.listEcsInstances(selectedCluster, filter)
      setCachedInstances(selectedCluster, selectedService, result)
      setInstances(result)
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }, [selectedCluster, selectedService])

  const connectToInstance = useCallback((instanceId: string) => {
    window.electronAPI.ssmConnect(instanceId)
  }, [])

  const saveTerminal = useCallback((app: TerminalApp) => {
    setTerminalApp(app)
    window.electronAPI.saveSettings({ terminalApp: app })
  }, [])

  const isCached = getCachedInstances(selectedCluster, selectedService) !== null && instances.length > 0

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Instances</h2>

      {/* Cluster + service selectors */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        {/* Cluster dropdown */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Cluster</label>
            <button
              onClick={() => { clearCache(CLUSTERS_KEY); refreshClusters() }}
              disabled={clustersRefreshing}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
              title="Reload clusters"
            >
              <RefreshCw size={10} className={clustersRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <SearchableSelect
            value={selectedCluster}
            onChange={handleClusterChange}
            options={clusters}
            placeholder={clusters.length === 0 ? 'No clusters found' : 'Select cluster…'}
            className="min-w-52"
          />
        </div>

        {/* Service dropdown */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Service</label>
            <button
              onClick={() => { clearCache(servicesKey(selectedCluster)); refreshServices(selectedCluster) }}
              disabled={servicesRefreshing || !selectedCluster}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
              title="Reload services"
            >
              <RefreshCw size={10} className={servicesRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <SearchableSelect
            value={selectedService}
            onChange={handleServiceChange}
            options={[ALL_SERVICES, ...services]}
            labels={{ [ALL_SERVICES]: 'All services' }}
            placeholder="Select service…"
            disabled={!selectedCluster}
            className="min-w-48"
          />
        </div>

        {/* Fetch button */}
        <button
          onClick={() => {
            invalidateCache(selectedCluster, selectedService)
            fetchInstances(true)
          }}
          disabled={loading || !selectedCluster}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 transition-colors self-end"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : isCached ? 'Refresh' : 'Fetch'}
        </button>
      </div>

      {/* Status line */}
      {selectedCluster && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">
          aws ecs list-container-instances --cluster {selectedCluster}
          {selectedService !== ALL_SERVICES && ` --filter "task:group == service:${selectedService}"`}
          {isCached && <span className="ml-2 text-green-500">● cached</span>}
        </p>
      )}

      {/* Terminal picker */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-gray-400">Open in:</span>
        {(['iterm2', 'warp', 'terminal', 'custom'] as TerminalApp[]).map(t => (
          <button
            key={t}
            onClick={() => saveTerminal(t)}
            className={`px-2.5 py-1 rounded-md font-medium border transition-colors ${
              terminalApp === t
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400'
            }`}
          >
            {t === 'iterm2' ? 'iTerm2' : t === 'warp' ? 'Warp' : t === 'custom' ? 'Custom…' : 'Terminal'}
          </button>
        ))}
        {terminalApp === 'custom' && (
          <input
            value={customTerminalCommand}
            onChange={e => {
              setCustomTerminalCommand(e.target.value)
              window.electronAPI.saveSettings({ customTerminalCommand: e.target.value })
            }}
            placeholder={`kitty -- zsh -c "{cmd}"`}
            className="ml-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Instance table */}
      {instances.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Instance ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Tasks</th>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Connect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {instances.map(inst => (
                <tr key={inst.instanceId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-mono text-xs">{inst.instanceId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                      inst.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                    }`}>
                      {inst.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {inst.runningTasksCount} running
                    {inst.pendingTasksCount > 0 && `, ${inst.pendingTasksCount} pending`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      inst.agentConnected ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                    }`}>
                      {inst.agentConnected ? '● Connected' : '● Disconnected'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => connectToInstance(inst.instanceId)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                    >
                      <Terminal size={11} />
                      Connect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && instances.length === 0 && !error && selectedCluster && (
        <p className="text-sm text-gray-400 italic">
          Click <strong>Fetch</strong> to load instances.
        </p>
      )}
    </div>
  )
}
