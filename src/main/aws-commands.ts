/**
 * aws-commands.ts
 *
 * All AWS CLI operations used by the app — implemented directly in TypeScript.
 * No ~/.zshrc sourcing required. The app is fully standalone (requires only aws-cli).
 */

import { runCommandSync } from './aws-runner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineStageAction {
  actionName: string
  status: string
  lastUpdatedBy?: string
  token?: string        // approval token
  summary?: string
  stageName?: string
}

export interface PipelineStage {
  stageName: string
  inboundExecution?: { pipelineExecutionId: string }
  latestExecution?: { status: string; pipelineExecutionId: string }
  actionStates: PipelineStageAction[]
}

export interface PipelineState {
  pipelineName: string
  stages: PipelineStage[]
  executionCommits: Record<string, string>  // pipelineExecutionId → git commit SHA
}

export interface EcsInstance {
  instanceId: string       // EC2 instance ID (i-xxxx)
  containerInstanceArn: string
  status: string
  runningTasksCount: number
  pendingTasksCount: number
  agentConnected: boolean
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Fetches the current state of a CodePipeline pipeline.
 * Equivalent to: aws codepipeline get-pipeline-state --name <name>
 */
export function getPipelineState(pipelineName: string): PipelineState {
  if (!pipelineName) throw new Error('Pipeline name is not configured. Go to Settings to set it.')

  const raw = runCommandSync(
    `aws codepipeline get-pipeline-state --name "${pipelineName}"`
  )

  const data = JSON.parse(raw)
  const stages: PipelineStage[] = (data.stageStates ?? []).map((s: Record<string, unknown>) => ({
    stageName: s.stageName as string,
    inboundExecution: s.inboundExecution as PipelineStage['inboundExecution'],
    latestExecution: s.latestExecution as PipelineStage['latestExecution'],
    actionStates: ((s.actionStates ?? []) as Record<string, unknown>[]).map(a => ({
      actionName: a.actionName as string,
      status: (a.latestExecution as Record<string, unknown> | undefined)?.status as string ?? 'Unknown',
      lastUpdatedBy: (a.latestExecution as Record<string, unknown> | undefined)?.lastUpdatedBy as string,
      token: (a.latestExecution as Record<string, unknown> | undefined)?.token as string,
      summary: (a.latestExecution as Record<string, unknown> | undefined)?.summary as string,
      revisionId: (a.currentRevision as Record<string, unknown> | undefined)?.revisionId as string,
      stageName: s.stageName as string,
    })),
  }))

  // Collect unique execution IDs across all stages and resolve their git commit SHA
  const execIds = [...new Set(
    stages.map(s => s.latestExecution?.pipelineExecutionId).filter(Boolean) as string[]
  )]

  const executionCommits: Record<string, string> = {}
  for (const execId of execIds) {
    try {
      const execRaw = runCommandSync(
        `aws codepipeline get-pipeline-execution --pipeline-name "${pipelineName}" --pipeline-execution-id "${execId}"`
      )
      const execData = JSON.parse(execRaw)
      const revisions = execData.pipelineExecution?.artifactRevisions as Record<string, unknown>[] | undefined
      // revisionId is an AWS internal ID (e.g. S3 version); revisionSummary contains the git SHA
      const summary = revisions?.[0]?.revisionSummary as string | undefined
      const match = summary?.match(/([a-f0-9]{7,40})/i)
      const commit = match ? match[1].slice(0, 7) : undefined
      if (commit) executionCommits[execId] = commit
    } catch {
      // execution may have expired — skip
    }
  }

  return { pipelineName: data.pipelineName, stages, executionCommits }
}

/**
 * Approves or rejects a manual approval action in CodePipeline.
 * Equivalent to: aws codepipeline put-approval-result ...
 */
export function putApprovalResult(
  pipelineName: string,
  stageName: string,
  actionName: string,
  token: string,
  approved: boolean
): string {
  if (!pipelineName) throw new Error('Pipeline name is not configured.')
  if (!token) throw new Error('No approval token found. Is there a pending approval?')

  const status = approved ? 'Approved' : 'Rejected'
  const summary = approved ? 'Approved via AWS GUI' : 'Rejected via AWS GUI'

  const result = runCommandSync(
    `aws codepipeline put-approval-result ` +
    `--pipeline-name "${pipelineName}" ` +
    `--stage-name "${stageName}" ` +
    `--action-name "${actionName}" ` +
    `--token "${token}" ` +
    `--result "summary=${summary},status=${status}"`
  )

  return result
}

// ─── Pipeline list ────────────────────────────────────────────────────────────

export interface PipelineSummary {
  name: string
  status: string
  updatedAt: string
}

/**
 * Lists all CodePipeline pipelines with their latest execution status.
 * Makes N+1 calls: one to list names, one per pipeline for latest status.
 */
export function listPipelines(): PipelineSummary[] {
  const raw = runCommandSync('aws codepipeline list-pipelines')
  const data = JSON.parse(raw)
  const names: string[] = (data.pipelines ?? []).map(
    (p: Record<string, unknown>) => p.name as string
  )

  return names.map(name => {
    try {
      const execRaw = runCommandSync(
        `aws codepipeline list-pipeline-executions --pipeline-name "${name}" --max-results 1`
      )
      const execData = JSON.parse(execRaw)
      const latest = (execData.pipelineExecutionSummaries ?? [])[0] as Record<string, unknown> | undefined
      return {
        name,
        status: (latest?.status as string) ?? 'Unknown',
        updatedAt: (latest?.lastUpdateTime as string) ?? '',
      }
    } catch {
      return { name, status: 'Unknown', updatedAt: '' }
    }
  })
}

// ─── ECS Instances ────────────────────────────────────────────────────────────

/**
 * Lists all ECS cluster names in the account.
 */
export function listClusters(): string[] {
  const raw = runCommandSync('aws ecs list-clusters --output json')
  const data = JSON.parse(raw)
  return (data.clusterArns ?? []).map((arn: string) => arn.split('/').pop() as string)
}

/**
 * Lists all service names in a given ECS cluster.
 */
export function listServices(cluster: string): string[] {
  const raw = runCommandSync(
    `aws ecs list-services --cluster "${cluster}" --output json`
  )
  const data = JSON.parse(raw)
  return (data.serviceArns ?? []).map((arn: string) => arn.split('/').pop() as string)
}

/**
 * Lists ECS container instances for a cluster, optionally filtered by service.
 * When serviceFilter is provided it filters by task group (service:<name>).
 */
export function listEcsInstances(cluster: string, serviceFilter?: string): EcsInstance[] {
  const filterArg = serviceFilter
    ? ` --filter "task:group == service:${serviceFilter}"`
    : ''

  const listRaw = runCommandSync(
    `aws ecs list-container-instances --cluster "${cluster}"${filterArg}`
  )

  const listData = JSON.parse(listRaw)
  const arns: string[] = listData.containerInstanceArns ?? []
  if (arns.length === 0) return []

  const arnArgs = arns.map(a => `"${a}"`).join(' ')
  const descRaw = runCommandSync(
    `aws ecs describe-container-instances --cluster "${cluster}" --container-instances ${arnArgs}`
  )

  const descData = JSON.parse(descRaw)
  return (descData.containerInstances ?? []).map((ci: Record<string, unknown>) => ({
    instanceId: ci.ec2InstanceId as string,
    containerInstanceArn: ci.containerInstanceArn as string,
    status: ci.status as string,
    runningTasksCount: ci.runningTasksCount as number,
    pendingTasksCount: ci.pendingTasksCount as number,
    agentConnected: ci.agentConnected as boolean,
  }))
}

// ─── CloudWatch Logs ──────────────────────────────────────────────────────────

export interface LogEvent {
  timestamp: number
  message: string
  logStreamName: string
}

/**
 * Lists all CloudWatch log group names (up to 200).
 */
export function listLogGroups(): string[] {
  const raw = runCommandSync(
    `aws logs describe-log-groups --max-items 200 --query 'logGroups[*].logGroupName' --output json`
  )
  return JSON.parse(raw) as string[]
}

/**
 * Searches logs in a time window with an optional filter pattern.
 * startMs / endMs are Unix epoch milliseconds.
 */
export function searchLogs(
  logGroup: string,
  startMs: number,
  endMs: number,
  filterPattern: string
): LogEvent[] {
  const filterArg = filterPattern.trim()
    ? `--filter-pattern ${JSON.stringify(filterPattern)}`
    : ''

  const raw = runCommandSync(
    `aws logs filter-log-events ` +
    `--log-group-name ${JSON.stringify(logGroup)} ` +
    `--start-time ${startMs} ` +
    `--end-time ${endMs} ` +
    `${filterArg} ` +
    `--output json`
  )

  const data = JSON.parse(raw)
  return (data.events ?? []).map((e: Record<string, unknown>) => ({
    timestamp: e.timestamp as number,
    message: (e.message as string ?? '').trimEnd(),
    logStreamName: e.logStreamName as string ?? '',
  }))
}

/**
 * Returns the shell command to tail a log group live.
 * Pass to runCommand() for streaming.
 */
export function logsStreamCommand(logGroup: string, filterPattern: string): string {
  const filterArg = filterPattern.trim()
    ? ` --filter-pattern ${JSON.stringify(filterPattern)}`
    : ''
  return `aws logs tail ${JSON.stringify(logGroup)} --follow${filterArg}`
}

// ─── EC2 Instances (non-ECS) ──────────────────────────────────────────────────

export interface Ec2Instance {
  instanceId: string
  name: string
  state: string
  privateIp?: string
  instanceType?: string
}

/**
 * Lists EC2 instances filtered by Name tag prefix.
 * Equivalent to get-instances() in ~/.zshrc.
 */
export function listEc2Instances(nameFilter: string): Ec2Instance[] {
  const raw = runCommandSync(
    `aws ec2 describe-instances ` +
    `--filters "Name=tag:Name,Values=${nameFilter}*" "Name=instance-state-name,Values=running" ` +
    `--query "Reservations[*].Instances[*].{ID:InstanceId,Name:Tags[?Key=='Name']|[0].Value,State:State.Name,IP:PrivateIpAddress,Type:InstanceType}" ` +
    `--output json`
  )

  // AWS CLI returns arrays of arrays when using Reservations[*]
  const data = JSON.parse(raw) as Array<Array<Record<string, string>>>
  return data.flat().map(i => ({
    instanceId: i['ID'] ?? '',
    name: i['Name'] ?? '',
    state: i['State'] ?? 'unknown',
    privateIp: i['IP'],
    instanceType: i['Type'],
  }))
}

// ─── SSM Connect command string ───────────────────────────────────────────────

/**
 * Returns the shell command to open an SSM/EC2 Instance Connect session.
 * This is run via runCommand() so output streams back to the UI.
 */
export function ssmConnectCommand(instanceId: string): string {
  return `aws ec2-instance-connect ssh --instance-id "${instanceId}" --connection-type eice`
}

// ─── Secrets Manager ──────────────────────────────────────────────────────────

export interface SecretEntry {
  name: string
  arn: string
  lastChangedDate: string
}

/**
 * Lists all secrets (first page, up to 100).
 */
export function listSecrets(): SecretEntry[] {
  const raw = runCommandSync('aws secretsmanager list-secrets --output json')
  const data = JSON.parse(raw)
  return (data.SecretList ?? []).map((s: Record<string, unknown>) => ({
    name: s.Name as string,
    arn: s.ARN as string,
    lastChangedDate: (s.LastChangedDate as string) ?? '',
  }))
}

/**
 * Fetches the plaintext value of a secret.
 */
export function getSecretValue(secretId: string): string {
  const raw = runCommandSync(
    `aws secretsmanager get-secret-value --secret-id ${JSON.stringify(secretId)} --output json`
  )
  const data = JSON.parse(raw)
  return (data.SecretString as string) ?? ''
}

/**
 * Updates a secret's string value.
 * Writes to a temp file to avoid shell escaping issues with special characters.
 */
export function updateSecret(secretId: string, value: string): void {
  const { writeFileSync, unlinkSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const { tmpdir } = require('os') as typeof import('os')

  const tmpFile = join(tmpdir(), `aws-gui-secret-${Date.now()}.json`)
  writeFileSync(tmpFile, JSON.stringify({ SecretId: secretId, SecretString: value }))
  try {
    runCommandSync(`aws secretsmanager update-secret --cli-input-json file://${tmpFile}`)
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}
