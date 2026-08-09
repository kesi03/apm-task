import { randomBytes } from 'crypto'
import * as os from 'os'
import { ApmAgent, initApm } from './apm'

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

export function getEnvConfig(): CliEndpointConfig {
  return {
    serverUrl: process.env.ELASTIC_APM_SERVER_URL,
    secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
    apiKey: process.env.ELASTIC_APM_API_KEY,
    serviceName: process.env.ELASTIC_APM_SERVICE_NAME || (process.env.GITHUB_ACTIONS === 'true' ? 'github-action' : 'cli'),
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
  return process.env.CI_PROVIDER || 'cli'
}

export function pipelineName(): string {
  return process.env.BUILD_DEFINITION_NAME || process.env.CI_PIPELINE_NAME || 'ci-pipeline'
}

export function pipelineTags(): Record<string, string> {
  const tags: Record<string, string> = {}
  const add = (key: string, value: string | undefined): void => {
    if (value) {
      tags[key] = value
    }
  }
  const buildId = process.env.BUILD_ID
  const buildNumber = process.env.BUILD_NUMBER
  const branch = process.env.BUILD_BRANCH
  const commit = process.env.BUILD_COMMIT
  const repo = process.env.BUILD_REPO
  const provider = providerName()
  add('definition_name', pipelineName())
  add('build_id', buildId)
  add('build_number', buildNumber)
  add('branch', branch)
  add('commit', commit)
  add('repo', repo)
  add('ci_provider', provider)
  add('runner_os', process.env.RUNNER_OS)
  add('runner_arch', process.env.RUNNER_ARCH)
  add('ci.pipeline.id', buildId)
  add('ci.pipeline.name', pipelineName())
  add('ci.pipeline.run.id', buildId)
  add('ci.pipeline.run.number', buildNumber)
  add('ci.pipeline.run.url', process.env.BUILD_URL)
  add('ci.pipeline.run.user', process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR)
  add('ci.pipeline.run.result', process.env.JOB_STATUS)
  add('ci.pipeline.agent.name', process.env.AGENT_NAME || process.env.RUNNER_NAME)
  add('ci.job.id', process.env.JOB_ID)
  add('ci.job.name', process.env.JOB_NAME)
  add('ci.job.status', process.env.JOB_STATUS)
  add('ci.step.name', 'ci-apm-trace')
  add('ci.build.ref', branch)
  add('ci.build.commit', commit)
  add('ci.build.repo', repo)
  add('vcs.repository.url', process.env.BUILD_REPO_URI)
  add('vcs.ref.head.name', process.env.BUILD_REF || branch)
  add('vcs.commit.id', commit)
  return tags
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
  const custom: Record<string, unknown> = {}
  const add = (key: string, value: string | undefined): void => {
    if (value) {
      custom[key] = value
    }
  }
  add('definition_id', process.env.BUILD_DEFINITION_ID)
  add('definition_name', pipelineName())
  add('build_id', process.env.BUILD_ID)
  add('build_number', process.env.BUILD_NUMBER)
  add('build_url', process.env.BUILD_URL)
  add('requested_for', process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR)
  add('agent_name', process.env.AGENT_NAME || process.env.RUNNER_NAME)
  add('agent_version', process.env.AGENT_VERSION)
  add('job_id', process.env.JOB_ID)
  add('job_name', process.env.JOB_NAME)
  add('repo_uri', process.env.BUILD_REPO_URI)
  return custom
}
