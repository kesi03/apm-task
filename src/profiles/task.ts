import { pickStrings, pickValues } from './common'
import { PipelineProfile } from './types'

export const taskProfile: PipelineProfile = {
  name: 'task',

  applyEnv(env: NodeJS.ProcessEnv): void {
    const set = (key: string, value: string | undefined): void => {
      if (value) {
        env[key] = value
      }
    }
    set('CI_PROVIDER', process.env.CI_PROVIDER || 'task')
    set('BUILD_ID', process.env.BUILD_ID || process.env.CI_PIPELINE_ID || process.env.CI_RUN_ID || process.env.CI_JOB_ID)
    set('BUILD_NUMBER', process.env.BUILD_NUMBER || process.env.CI_RUN_NUMBER || process.env.CI_PIPELINE_RUN_NUMBER)
    set('BUILD_BRANCH', process.env.BUILD_BRANCH || process.env.CI_COMMIT_BRANCH)
    set('BUILD_COMMIT', process.env.BUILD_COMMIT || process.env.CI_COMMIT_SHA)
    set('BUILD_REPO', process.env.BUILD_REPO || process.env.CI_REPOSITORY)
    set('BUILD_REPO_URI', process.env.BUILD_REPO_URI || process.env.CI_REPOSITORY_URL)
    set('BUILD_URL', process.env.BUILD_URL || process.env.CI_PIPELINE_URL || process.env.CI_JOB_URL)
    set('BUILD_REF', process.env.BUILD_REF || process.env.CI_COMMIT_BRANCH)
    set('BUILD_DEFINITION_NAME', process.env.BUILD_DEFINITION_NAME || process.env.CI_PIPELINE_NAME)
    set('JOB_ID', process.env.JOB_ID || process.env.CI_JOB_ID || process.env.CI_RUN_ID)
    set('JOB_NAME', process.env.JOB_NAME || process.env.CI_JOB_NAME || process.env.CI_TASK_NAME)
    set('JOB_STATUS', process.env.JOB_STATUS || process.env.CI_JOB_STATUS)
    set('BUILD_REQUESTED_FOR', process.env.BUILD_REQUESTED_FOR || process.env.CI_TRIGGERING_ACTOR)
    set('AGENT_NAME', process.env.AGENT_NAME || process.env.CI_RUNNER_NAME || process.env.RUNNER_NAME)
    set('RUNNER_OS', process.env.RUNNER_OS || process.env.CI_RUNNER_OS)
    set('RUNNER_ARCH', process.env.RUNNER_ARCH || process.env.CI_RUNNER_ARCH)
  },

  pipelineName(): string {
    return process.env.CI_PIPELINE_NAME || process.env.BUILD_DEFINITION_NAME || 'ci-pipeline'
  },

  pipelineTags(): Record<string, string> {
    const branch = process.env.BUILD_BRANCH || process.env.CI_COMMIT_BRANCH
    const commit = process.env.BUILD_COMMIT || process.env.CI_COMMIT_SHA
    const repo = process.env.BUILD_REPO || process.env.CI_REPOSITORY
    const buildId = process.env.BUILD_ID
    const buildNumber = process.env.BUILD_NUMBER
    return pickStrings({
      definition_name: process.env.BUILD_DEFINITION_NAME || process.env.CI_PIPELINE_NAME,
      build_id: buildId,
      build_number: buildNumber,
      branch,
      commit,
      repo,
      ci_provider: process.env.CI_PROVIDER || 'task',
      runner_os: process.env.RUNNER_OS,
      runner_arch: process.env.RUNNER_ARCH,
      'ci.pipeline.id': process.env.CI_PIPELINE_ID || buildId,
      'ci.pipeline.name': process.env.CI_PIPELINE_NAME || process.env.BUILD_DEFINITION_NAME,
      'ci.pipeline.run.id': process.env.CI_RUN_ID || buildId,
      'ci.pipeline.run.number': process.env.CI_RUN_NUMBER || buildNumber,
      'ci.pipeline.run.url': process.env.BUILD_URL || process.env.CI_PIPELINE_URL,
      'ci.pipeline.run.user': process.env.BUILD_REQUESTED_FOR || process.env.CI_TRIGGERING_ACTOR,
      'ci.pipeline.run.result': process.env.JOB_STATUS || process.env.CI_JOB_STATUS,
      'ci.pipeline.agent.name': process.env.AGENT_NAME || process.env.CI_RUNNER_NAME,
      'ci.job.id': process.env.CI_JOB_ID || buildId,
      'ci.job.name': process.env.CI_JOB_NAME || process.env.CI_TASK_NAME,
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
      provider: process.env.CI_PROVIDER || 'task',
      definition_id: process.env.CI_PIPELINE_ID,
      definition_name: process.env.CI_PIPELINE_NAME || process.env.BUILD_DEFINITION_NAME,
      build_id: process.env.BUILD_ID,
      build_number: process.env.BUILD_NUMBER,
      build_url: process.env.BUILD_URL || process.env.CI_PIPELINE_URL,
      task_id: process.env.CI_TASK_ID,
      task_name: process.env.CI_TASK_NAME,
      step_name: process.env.CI_STEP_NAME,
      requested_for: process.env.BUILD_REQUESTED_FOR || process.env.CI_TRIGGERING_ACTOR,
      agent_name: process.env.AGENT_NAME || process.env.CI_RUNNER_NAME,
      agent_version: process.env.AGENT_VERSION,
      job_id: process.env.JOB_ID || process.env.CI_JOB_ID,
      job_name: process.env.JOB_NAME || process.env.CI_JOB_NAME,
      job_status: process.env.JOB_STATUS || process.env.CI_JOB_STATUS,
      project: process.env.CI_PROJECT,
      repo_uri: process.env.BUILD_REPO_URI || process.env.CI_REPOSITORY_URL,
      repo: process.env.BUILD_REPO || process.env.CI_REPOSITORY,
      branch: process.env.BUILD_BRANCH || process.env.CI_COMMIT_BRANCH,
      commit: process.env.BUILD_COMMIT || process.env.CI_COMMIT_SHA,
      server_url: process.env.CI_SERVER_URL,
    })
  },
}

export default taskProfile
