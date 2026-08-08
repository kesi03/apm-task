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
  let serverUrl: string | undefined
  let secretToken: string | undefined
  try {
    serverUrl = tl.getEndpointUrl(ENDPOINT_INPUT, false) ?? undefined
  } catch {
    // no connection bound in this run
  }
  try {
    secretToken = tl.getEndpointAuthorizationParameter(ENDPOINT_INPUT, TOKEN_PARAM, false) ?? undefined
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
  return initApm({
    serverUrl: config.serverUrl,
    secretToken: config.secretToken,
    serviceName: config.serviceName,
    debug: config.debug,
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
  add('build_id', tl.getVariable('Build.BuildId'))
  add('build_number', tl.getVariable('Build.BuildNumber'))
  add('branch', tl.getVariable('Build.SourceBranchName'))
  add('commit', tl.getVariable('Build.SourceVersion'))
  add('repo', tl.getVariable('Build.Repository.Name'))
  add('ci_provider', 'azure-devops')
  add('runner_os', tl.getVariable('Agent.OS'))
  add('runner_arch', tl.getVariable('Agent.OSArchitecture'))
  return tags
}
