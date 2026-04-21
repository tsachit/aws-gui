import { contextBridge, ipcRenderer } from 'electron'

export interface OutputEvent {
  id: string
  type: 'stdout' | 'stderr' | 'exit'
  line: string
}

type OutputListener = (event: OutputEvent) => void
let outputListeners: OutputListener[] = []

ipcRenderer.on('aws:output', (_event, data: OutputEvent) => {
  outputListeners.forEach(fn => fn(data))
})

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic streaming runner
  runCommand: (id: string, command: string) =>
    ipcRenderer.invoke('aws:run', { id, command }),

  killCommand: (id: string) =>
    ipcRenderer.invoke('aws:kill', id),

  onOutput: (callback: OutputListener) => {
    outputListeners.push(callback)
    return () => {
      outputListeners = outputListeners.filter(fn => fn !== callback)
    }
  },

  // Pipeline
  listPipelines: () => ipcRenderer.invoke('pipeline:list'),
  getPipelineState: (pipelineName: string) =>
    ipcRenderer.invoke('pipeline:get-state', pipelineName),
  putApproval: (args: unknown) => ipcRenderer.invoke('pipeline:put-approval', args),

  // ECS / Instances
  listClusters: () => ipcRenderer.invoke('ecs:list-clusters'),
  listServices: (cluster: string) => ipcRenderer.invoke('ecs:list-services', cluster),
  listEcsInstances: (cluster: string, serviceFilter?: string) =>
    ipcRenderer.invoke('instances:list-ecs', { cluster, serviceFilter }),
  listEc2Instances: (nameFilter: string) =>
    ipcRenderer.invoke('instances:list-ec2', nameFilter),
  ssmConnect: (instanceId: string) =>
    ipcRenderer.invoke('instances:ssm-connect', instanceId),

  // CloudWatch Logs
  listLogGroups: () => ipcRenderer.invoke('logs:list-groups'),
  searchLogs: (logGroup: string, startMs: number, endMs: number, filterPattern: string) =>
    ipcRenderer.invoke('logs:search', { logGroup, startMs, endMs, filterPattern }),
  logsStreamCommand: (logGroup: string, filterPattern: string) =>
    ipcRenderer.invoke('logs:stream-command', { logGroup, filterPattern }),

  // Secrets Manager
  listSecrets: () => ipcRenderer.invoke('secrets:list'),
  getSecretValue: (secretId: string) => ipcRenderer.invoke('secrets:get-value', secretId),
  updateSecret: (secretId: string, value: string) =>
    ipcRenderer.invoke('secrets:update', { secretId, value }),
  copySecret: (secretId: string) => ipcRenderer.invoke('secrets:copy', secretId),

  // App settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  // AWS config files
  getAwsConfig: () => ipcRenderer.invoke('aws:get-config'),
  saveAwsConfig: (profiles: unknown[]) => ipcRenderer.invoke('aws:save-config', profiles),
  saveAwsCredentials: (credentials: unknown[]) =>
    ipcRenderer.invoke('aws:save-credentials', credentials),
})
