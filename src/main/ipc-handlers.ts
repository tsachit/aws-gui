import { ipcMain, BrowserWindow, clipboard } from 'electron'
import { runCommand, openInTerminal } from './aws-runner'
import { readAwsConfig, saveAwsConfig, saveAwsCredentials, AwsProfile, AwsCredential } from './config-manager'
import { getSettings, saveSettings, AppSettings } from './settings-store'
import {
  getPipelineState,
  putApprovalResult,
  listPipelines,
  listClusters,
  listServices,
  listEcsInstances,
  listEc2Instances,
  ssmConnectCommand,
  listLogGroups,
  searchLogs,
  logsStreamCommand,
  listSecrets,
  getSecretValue,
  updateSecret,
} from './aws-commands'

// Map of running process kill functions, keyed by caller-supplied ID
const runningProcesses = new Map<string, () => void>()

export function registerIpcHandlers(mainWindow: BrowserWindow): void {

  // ── Generic streaming command runner ────────────────────────────────────────
  ipcMain.handle('aws:run', (_event, { id, command }: { id: string; command: string }) => {
    return new Promise<void>((resolve) => {
      const kill = runCommand(command, {
        onStdout: (line) => mainWindow.webContents.send('aws:output', { id, type: 'stdout', line }),
        onStderr: (line) => mainWindow.webContents.send('aws:output', { id, type: 'stderr', line }),
        onExit: (code) => {
          runningProcesses.delete(id)
          mainWindow.webContents.send('aws:output', { id, type: 'exit', line: String(code) })
          resolve()
        },
      })
      runningProcesses.set(id, kill)
    })
  })

  ipcMain.handle('aws:kill', (_event, id: string) => {
    const kill = runningProcesses.get(id)
    if (kill) {
      kill()
      runningProcesses.delete(id)
    }
  })

  // ── Pipeline ─────────────────────────────────────────────────────────────────
  ipcMain.handle('pipeline:list', () => listPipelines())

  ipcMain.handle('pipeline:get-state', (_event, pipelineName: string) => {
    return getPipelineState(pipelineName)
  })

  ipcMain.handle(
    'pipeline:put-approval',
    (_event, { pipelineName, stageName, actionName, token, approved }: {
      pipelineName: string; stageName: string; actionName: string; token: string; approved: boolean
    }) => putApprovalResult(pipelineName, stageName, actionName, token, approved)
  )

  // ── ECS Instances ─────────────────────────────────────────────────────────────
  ipcMain.handle('ecs:list-clusters', () => listClusters())

  ipcMain.handle('ecs:list-services', (_event, cluster: string) => listServices(cluster))

  ipcMain.handle('instances:list-ecs', (_event, { cluster, serviceFilter }: { cluster: string; serviceFilter?: string }) => {
    return listEcsInstances(cluster, serviceFilter)
  })

  ipcMain.handle('instances:list-ec2', (_event, nameFilter: string) => {
    return listEc2Instances(nameFilter)
  })

  ipcMain.handle('instances:ssm-connect', (_event, instanceId: string) => {
    const { terminalApp, customTerminalCommand } = getSettings()
    openInTerminal(ssmConnectCommand(instanceId), terminalApp, customTerminalCommand)
  })

  // ── CloudWatch Logs ───────────────────────────────────────────────────────────
  ipcMain.handle('logs:list-groups', () => listLogGroups())

  ipcMain.handle(
    'logs:search',
    (_event, { logGroup, startMs, endMs, filterPattern }: {
      logGroup: string; startMs: number; endMs: number; filterPattern: string
    }) => searchLogs(logGroup, startMs, endMs, filterPattern)
  )

  ipcMain.handle(
    'logs:stream-command',
    (_event, { logGroup, filterPattern }: { logGroup: string; filterPattern: string }) =>
      logsStreamCommand(logGroup, filterPattern)
  )

  // ── Secrets Manager ───────────────────────────────────────────────────────────
  ipcMain.handle('secrets:list', () => listSecrets())

  ipcMain.handle('secrets:get-value', (_event, secretId: string) =>
    getSecretValue(secretId)
  )

  ipcMain.handle('secrets:update', (_event, { secretId, value }: { secretId: string; value: string }) =>
    updateSecret(secretId, value)
  )

  ipcMain.handle('secrets:copy', (_event, secretId: string) => {
    const value = getSecretValue(secretId)
    clipboard.writeText(value)
  })

  // ── App Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_event, settings: Partial<AppSettings>) => {
    saveSettings(settings)
    return { ok: true }
  })

  // ── AWS Config files ──────────────────────────────────────────────────────────
  ipcMain.handle('aws:get-config', async () => readAwsConfig())
  ipcMain.handle('aws:save-config', async (_event, profiles: AwsProfile[]) => {
    saveAwsConfig(profiles)
    return { ok: true }
  })
  ipcMain.handle('aws:save-credentials', async (_event, credentials: AwsCredential[]) => {
    saveAwsCredentials(credentials)
    return { ok: true }
  })
}
