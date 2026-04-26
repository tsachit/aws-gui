// ─── Output streaming ─────────────────────────────────────────────────────────

export interface OutputEvent {
  id: string
  type: 'stdout' | 'stderr' | 'exit'
  line: string
}

// ─── AWS Config files ─────────────────────────────────────────────────────────

export interface AwsProfile {
  name: string
  region?: string
  output?: string
}

export interface AwsCredential {
  name: string
  aws_access_key_id?: string
  aws_secret_access_key?: string
  aws_session_token?: string
}

export interface AwsConfigData {
  profiles: AwsProfile[]
  credentials: AwsCredential[]
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export type TerminalApp = 'terminal' | 'iterm2' | 'warp' | 'custom'

export interface AppSettings {
  terminalApp: TerminalApp
  customTerminalCommand: string
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineSummary {
  name: string
  status: string      // latest execution status: Succeeded | InProgress | Failed | Stopped | Unknown
  updatedAt: string   // ISO timestamp of last execution
}

export interface PipelineStageAction {
  actionName: string
  status: string
  lastUpdatedBy?: string
  token?: string
  stageName?: string
  summary?: string      // execution summary
  revisionId?: string   // commit SHA / revision ID from currentRevision
}

export interface PipelineStage {
  stageName: string
  latestExecution?: { status: string; pipelineExecutionId: string }
  actionStates: PipelineStageAction[]
}

export interface PipelineState {
  pipelineName: string
  stages: PipelineStage[]
}

// ─── Instances ────────────────────────────────────────────────────────────────

export interface EcsInstance {
  instanceId: string
  containerInstanceArn: string
  status: string
  runningTasksCount: number
  pendingTasksCount: number
  agentConnected: boolean
}

// ─── CloudWatch Logs ──────────────────────────────────────────────────────────

export interface LogEvent {
  timestamp: number
  message: string
  logStreamName: string
}

// ─── Secrets Manager ──────────────────────────────────────────────────────────

export interface SecretEntry {
  name: string
  arn: string
  lastChangedDate: string
}

// ─── Window API surface ───────────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: {
      // Generic streaming runner
      runCommand: (id: string, command: string) => Promise<void>
      killCommand: (id: string) => Promise<void>
      onOutput: (callback: (event: OutputEvent) => void) => () => void

      // Pipeline
      listPipelines: () => Promise<PipelineSummary[]>
      getPipelineState: (pipelineName: string) => Promise<PipelineState>
      putApproval: (args: {
        pipelineName: string
        stageName: string
        actionName: string
        token: string
        approved: boolean
      }) => Promise<string>

      // ECS / Instances
      listClusters: () => Promise<string[]>
      listServices: (cluster: string) => Promise<string[]>
      listEcsInstances: (cluster: string, serviceFilter?: string) => Promise<EcsInstance[]>
      listEc2Instances: (nameFilter: string) => Promise<EcsInstance[]>
      ssmConnect: (instanceId: string) => Promise<void>

      // CloudWatch Logs
      listLogGroups: () => Promise<string[]>
      searchLogs: (logGroup: string, startMs: number, endMs: number, filterPattern: string) => Promise<LogEvent[]>
      logsStreamCommand: (logGroup: string, filterPattern: string) => Promise<string>

      // Secrets Manager
      listSecrets: () => Promise<SecretEntry[]>
      getSecretValue: (secretId: string) => Promise<string>
      updateSecret: (secretId: string, value: string) => Promise<void>
      copySecret: (secretId: string) => Promise<void>

      // App settings
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: Partial<AppSettings>) => Promise<{ ok: boolean }>

      // AWS config files
      getAwsConfig: () => Promise<AwsConfigData>
      saveAwsConfig: (profiles: AwsProfile[]) => Promise<{ ok: boolean }>
      saveAwsCredentials: (credentials: AwsCredential[]) => Promise<{ ok: boolean }>
    }
  }
}
