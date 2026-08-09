import { pickStrings, pickValues } from './common'
import { PipelineProfile } from './types'

function npmVersion(): string | undefined {
  const userAgent = process.env.npm_config_user_agent
  if (userAgent) {
    const match = userAgent.match(/^([^\s/]+)\/([^\s]+)/)
    if (match) {
      return `${match[1]}/${match[2]}`
    }
  }
  return userAgent
}

export const npmProfile: PipelineProfile = {
  name: 'npm',

  applyEnv(env: NodeJS.ProcessEnv): void {
    const set = (key: string, value: string | undefined): void => {
      if (value) {
        env[key] = value
      }
    }
    set(
      'BUILD_ID',
      process.env.CI_PIPELINE_ID || process.env.CI_RUN_ID || process.env.CI_JOB_ID || process.env.npm_lifecycle_event
    )
    set('BUILD_NUMBER', process.env.CI_RUN_NUMBER || process.env.CI_PIPELINE_RUN_NUMBER)
    set('BUILD_BRANCH', process.env.CI_COMMIT_BRANCH)
    set('BUILD_COMMIT', process.env.CI_COMMIT_SHA)
    set('BUILD_REPO', process.env.CI_REPOSITORY)
    set('BUILD_REPO_URI', process.env.CI_REPOSITORY_URL)
    set('BUILD_URL', process.env.CI_PIPELINE_URL || process.env.CI_JOB_URL)
    set('BUILD_REF', process.env.CI_COMMIT_BRANCH)
    set('BUILD_DEFINITION_NAME', process.env.CI_PIPELINE_NAME || process.env.npm_package_name)
    set('JOB_ID', process.env.CI_JOB_ID || process.env.CI_RUN_ID)
    set('JOB_NAME', process.env.CI_JOB_NAME || process.env.npm_lifecycle_event)
    set('JOB_STATUS', process.env.CI_JOB_STATUS)
    set('BUILD_REQUESTED_FOR', process.env.CI_TRIGGERING_ACTOR)
    set('AGENT_NAME', process.env.CI_RUNNER_NAME || process.env.RUNNER_NAME)
    set('RUNNER_OS', process.env.CI_RUNNER_OS)
    set('RUNNER_ARCH', process.env.CI_RUNNER_ARCH)
  },

  pipelineName(): string {
    return process.env.npm_package_name || process.env.CI_PIPELINE_NAME || 'npm'
  },

  pipelineTags(): Record<string, string> {
    const branch = process.env.BUILD_BRANCH || process.env.CI_COMMIT_BRANCH
    const commit = process.env.BUILD_COMMIT || process.env.CI_COMMIT_SHA
    const repo = process.env.BUILD_REPO || process.env.CI_REPOSITORY
    const buildId = process.env.BUILD_ID
    const buildNumber = process.env.BUILD_NUMBER
    return pickStrings({
      definition_name:
        process.env.BUILD_DEFINITION_NAME || process.env.CI_PIPELINE_NAME || process.env.npm_package_name,
      package_name: process.env.npm_package_name,
      package_version: process.env.npm_package_version,
      build_id: buildId,
      build_number: buildNumber,
      branch,
      commit,
      repo,
      ci_provider: 'npm',
      runner_os: process.env.RUNNER_OS,
      runner_arch: process.env.RUNNER_ARCH,
      'ci.pipeline.id': process.env.CI_PIPELINE_ID || buildId,
      'ci.pipeline.name': process.env.CI_PIPELINE_NAME || process.env.npm_package_name,
      'ci.pipeline.run.id': process.env.CI_RUN_ID || buildId,
      'ci.pipeline.run.number': process.env.CI_RUN_NUMBER || buildNumber,
      'ci.pipeline.run.url': process.env.BUILD_URL || process.env.CI_PIPELINE_URL,
      'ci.pipeline.run.user': process.env.BUILD_REQUESTED_FOR || process.env.CI_TRIGGERING_ACTOR,
      'ci.pipeline.run.result': process.env.JOB_STATUS || process.env.CI_JOB_STATUS,
      'ci.pipeline.agent.name': process.env.AGENT_NAME || process.env.CI_RUNNER_NAME,
      'ci.job.id': process.env.CI_JOB_ID || buildId,
      'ci.job.name': process.env.CI_JOB_NAME || process.env.npm_lifecycle_event,
      'ci.job.status': process.env.JOB_STATUS || process.env.CI_JOB_STATUS,
      'ci.step.name': 'ci-apm-trace',
      'ci.build.ref': branch,
      'ci.build.commit': commit,
      'ci.build.repo': repo,
      'vcs.repository.url': process.env.BUILD_REPO_URI || process.env.CI_REPOSITORY_URL,
      'vcs.ref.head.name': process.env.BUILD_REF || branch,
      'vcs.commit.id': commit,
    })
  },

  pipelineCustom(): Record<string, unknown> {
    return pickValues({
      provider: 'npm',
      package_name: process.env.npm_package_name,
      package_version: process.env.npm_package_version,
      lifecycle_event: process.env.npm_lifecycle_event,
      lifecycle_script: process.env.npm_lifecycle_script,
      npm_version: npmVersion(),
      node_version: process.env.NODE_VERSION || process.version,
      node_execpath: process.env.npm_node_execpath,
      npm_execpath: process.env.npm_execpath,
      registry: process.env.npm_config_registry,
      cwd: process.env.INIT_CWD,
      definition_id: process.env.CI_PIPELINE_ID,
      definition_name: process.env.CI_PIPELINE_NAME,
      build_id: process.env.BUILD_ID,
      build_number: process.env.BUILD_NUMBER,
      build_url: process.env.BUILD_URL || process.env.CI_PIPELINE_URL,
      job_id: process.env.JOB_ID || process.env.CI_JOB_ID,
      job_name: process.env.JOB_NAME || process.env.CI_JOB_NAME,
      agent_name: process.env.AGENT_NAME || process.env.CI_RUNNER_NAME,
      repo: process.env.BUILD_REPO || process.env.CI_REPOSITORY,
      branch: process.env.BUILD_BRANCH || process.env.CI_COMMIT_BRANCH,
      commit: process.env.BUILD_COMMIT || process.env.CI_COMMIT_SHA,
    })
  },
}

export default npmProfile
