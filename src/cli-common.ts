import { randomBytes } from 'crypto'
import * as os from 'os'
import { ApmAgent, initApm } from './apm'
import { getProfile } from './profiles'
import { PipelineProfile } from './profiles/types'

export interface CliEndpointConfig {
  serverUrl?: string
  secretToken?: string
  apiKey?: string
  serviceName: string
  debug: boolean
}

function isTruthy(value: string | undefined): boolean {
  const v = (value ?? '').toLowerCase()
  return v === 'true' || v === '1'
}

export function getCiPlatform(): string | undefined {
  return process.env.APM_CI_PLATFORM?.trim() || undefined
}

export function selectedProfile(): PipelineProfile {
  return getProfile(getCiPlatform())
}

export function getEnvConfig(): CliEndpointConfig {
  const profile = selectedProfile()
  profile.applyEnv(process.env)
  return {
    serverUrl: process.env.ELASTIC_APM_SERVER_URL,
    secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
    apiKey: process.env.ELASTIC_APM_API_KEY,
    serviceName: process.env.ELASTIC_APM_SERVICE_NAME || profile.name,
    debug: isTruthy(process.env.ELASTIC_APM_DEBUG),
  }
}

export function initCliApm(options: { debug?: boolean } = {}): ApmAgent {
  const config = getEnvConfig()
  return initApm({
    serverUrl: config.serverUrl,
    secretToken: config.secretToken,
    apiKey: config.apiKey,
    serviceName: config.serviceName,
    serviceVersion: process.env.BUILD_NUMBER,
    serviceNode: process.env.AGENT_NAME || process.env.RUNNER_NAME || os.hostname(),
    debug: config.debug || Boolean(options.debug),
    globalLabels: pipelineTags(),
  })
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

export function providerName(): string {
  return selectedProfile().name
}

export function pipelineName(): string {
  return selectedProfile().pipelineName()
}

export function pipelineTags(): Record<string, string> {
  return selectedProfile().pipelineTags()
}

export function pipelineUser(): { id?: string; email?: string; username?: string } {
  const user: { id?: string; email?: string; username?: string } = {}
  const username = process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR
  const id = process.env.GITHUB_ACTOR_ID || process.env.BUILD_REQUESTED_FOR_ID
  const email = process.env.GITHUB_ACTOR_EMAIL || process.env.BUILD_REQUESTED_FOR_EMAIL
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
  return selectedProfile().pipelineCustom()
}
