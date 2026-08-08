import * as tl from 'azure-pipelines-task-lib'
import { randomBytes } from 'crypto'
import { ApmAgent, initApm } from './apm'

export const ENDPOINT_INPUT = 'apmConnection'
export const TOKEN_PARAM = 'apitoken'

export interface AzureEndpointConfig {
  serverUrl?: string
  secretToken?: string
  serviceName: string
  debug: boolean
}

export function getEndpointConfig(): AzureEndpointConfig {
  const endpointId = tl.getInput(ENDPOINT_INPUT, false)
  let serverUrl: string | undefined
  let secretToken: string | undefined
  try {
    serverUrl = endpointId ? (tl.getEndpointUrl(endpointId, false) ?? undefined) : undefined
  } catch {
    // no connection bound in this run
  }
  try {
    if (endpointId) {
      const auth = tl.getEndpointAuthorization(endpointId, false)
      secretToken = auth?.parameters?.[TOKEN_PARAM] ?? auth?.parameters?.apmSecretToken
    }
  } catch {
    // APM Server may not require a token
  }
  const envDebug = (process.env.ELASTIC_APM_DEBUG ?? '').toLowerCase()
  return {
    serverUrl: serverUrl || process.env.ELASTIC_APM_SERVER_URL,
    secretToken: secretToken || process.env.ELASTIC_APM_SECRET_TOKEN,
    serviceName: 'azure-devops',
    debug: tl.getBoolInput('debug', false) || envDebug === 'true' || envDebug === '1',
  }
}

export function initAzureApm(): ApmAgent {
  const config = getEndpointConfig()
  tl.debug(`Elastic APM server URL: ${config.serverUrl ? 'configured' : 'NOT SET (trace will be a no-op)'}`)
  tl.debug(`Elastic APM secret token: ${config.secretToken ? 'configured' : 'not set'}`)
  tl.debug(`Elastic APM debug: ${config.debug}`)
  return initApm({
    serverUrl: config.serverUrl,
    secretToken: config.secretToken,
    serviceName: config.serviceName,
    serviceVersion: tl.getVariable('Build.BuildNumber'),
    serviceNode: tl.getVariable('Agent.Name'),
    debug: config.debug,
    globalLabels: pipelineTags(),
  })
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

export function getTraceId(): string {
  return tl.getVariable('APM_TRACE_ID') || randomHex(16)
}

export function pipelineTags(): Record<string, string> {
  const tags: Record<string, string> = {}
  const add = (key: string, value: string | undefined): void => {
    if (value) {
      tags[key] = value
    }
  }
  add('definition_name', tl.getVariable('Build.DefinitionName'))
  add('build_id', tl.getVariable('Build.BuildId'))
  add('build_number', tl.getVariable('Build.BuildNumber'))
  add('branch', tl.getVariable('Build.SourceBranchName'))
  add('commit', tl.getVariable('Build.SourceVersion'))
  add('repo', tl.getVariable('Build.Repository.Name'))
  add('ci_provider', 'azure-devops')
  add('runner_os', tl.getVariable('Agent.OS'))
  add('runner_arch', tl.getVariable('Agent.OSArchitecture'))
  add('ci.pipeline.id', tl.getVariable('Build.DefinitionId'))
  add('ci.pipeline.name', tl.getVariable('Build.DefinitionName'))
  add('ci.pipeline.run.id', tl.getVariable('Build.BuildId'))
  add('ci.pipeline.run.number', tl.getVariable('Build.BuildNumber'))
  add('ci.pipeline.run.url', buildUrl())
  add('ci.pipeline.run.user', tl.getVariable('Build.RequestedFor'))
  add('ci.pipeline.run.result', tl.getVariable('Agent.JobStatus'))
  add('ci.pipeline.agent.name', tl.getVariable('Agent.Name'))
  add('ci.job.id', tl.getVariable('System.JobId'))
  add('ci.job.name', tl.getVariable('System.JobName'))
  add('ci.job.status', tl.getVariable('Agent.JobStatus'))
  add('ci.step.name', 'CiApmTrace')
  add('ci.build.ref', tl.getVariable('Build.SourceBranchName'))
  add('ci.build.commit', tl.getVariable('Build.SourceVersion'))
  add('ci.build.repo', tl.getVariable('Build.Repository.Name'))
  add('vcs.repository.url', tl.getVariable('Build.Repository.Uri'))
  add('vcs.ref.head.name', tl.getVariable('Build.SourceBranch'))
  add('vcs.commit.id', tl.getVariable('Build.SourceVersion'))
  return tags
}

function buildUrl(): string | undefined {
  const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri')
  const project = tl.getVariable('System.TeamProject')
  const buildId = tl.getVariable('Build.BuildId')
  if (collectionUri && project && buildId) {
    return `${collectionUri.replace(/\/+$/, '')}/${project}/_build/results?buildId=${buildId}`
  }
  return tl.getVariable('Build.BuildUri')
}

export function pipelineUser(): { id?: string; email?: string; username?: string } {
  const user: { id?: string; email?: string; username?: string } = {}
  const id = tl.getVariable('Build.RequestedForId')
  const email = tl.getVariable('Build.RequestedForEmail')
  const username = tl.getVariable('Build.RequestedFor')
  if (id) {
    user.id = id
  }
  if (email) {
    user.email = email
  }
  if (username) {
    user.username = username
  }
  return user
}

export function pipelineCustom(): Record<string, unknown> {
  const custom: Record<string, unknown> = {}
  const add = (key: string, value: string | undefined): void => {
    if (value) {
      custom[key] = value
    }
  }
  add('definition_id', tl.getVariable('Build.DefinitionId'))
  add('definition_name', tl.getVariable('Build.DefinitionName'))
  add('build_id', tl.getVariable('Build.BuildId'))
  add('build_number', tl.getVariable('Build.BuildNumber'))
  add('build_url', buildUrl())
  add('queued_by', tl.getVariable('Build.QueuedBy'))
  add('requested_for', tl.getVariable('Build.RequestedFor'))
  add('agent_name', tl.getVariable('Agent.Name'))
  add('agent_version', tl.getVariable('Agent.Version'))
  add('job_id', tl.getVariable('System.JobId'))
  add('job_name', tl.getVariable('System.JobName'))
  add('project', tl.getVariable('System.TeamProject'))
  add('collection_uri', tl.getVariable('System.TeamFoundationCollectionUri'))
  add('repo_uri', tl.getVariable('Build.Repository.Uri'))
  return custom
}
