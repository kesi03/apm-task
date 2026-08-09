import { pickStrings, pickValues } from './common'
import { PipelineProfile } from './types'

function buildUrl(): string | undefined {
  const serverUrl = process.env.TEAMCITY_SERVER_URL
  const buildId = process.env.TEAMCITY_BUILD_ID
  const buildTypeId = process.env.TEAMCITY_BUILDCONF_ID
  if (serverUrl && buildId) {
    const base = serverUrl.replace(/\/+$/, '')
    return buildTypeId
      ? `${base}/viewLog.html?buildId=${buildId}&buildTypeId=${buildTypeId}`
      : `${base}/viewLog.html?buildId=${buildId}`
  }
  return process.env.BUILD_URL
}

export const teamCityProfile: PipelineProfile = {
  name: 'team-city',

  applyEnv(env: NodeJS.ProcessEnv): void {
    const set = (key: string, value: string | undefined): void => {
      if (value) {
        env[key] = value
      }
    }
    set('CI_PROVIDER', 'team-city')
    set('BUILD_ID', process.env.TEAMCITY_BUILD_ID)
    set('BUILD_NUMBER', process.env.BUILD_NUMBER)
    set('BUILD_BRANCH', process.env.BUILD_VCS_BRANCH || process.env.TEAMCITY_BUILD_BRANCH)
    set('BUILD_COMMIT', process.env.BUILD_VCS_NUMBER)
    set('BUILD_DEFINITION_NAME', process.env.TEAMCITY_BUILDCONF_NAME)
    set('BUILD_URL', buildUrl())
    set('JOB_ID', process.env.TEAMCITY_BUILD_ID)
    set('JOB_NAME', process.env.TEAMCITY_BUILDCONF_NAME)
    set('AGENT_NAME', process.env.AGENT_NAME)
  },

  pipelineName(): string {
    return process.env.TEAMCITY_BUILDCONF_NAME || 'team-city'
  },

  pipelineTags(): Record<string, string> {
    const branch = process.env.BUILD_VCS_BRANCH || process.env.TEAMCITY_BUILD_BRANCH
    const commit = process.env.BUILD_VCS_NUMBER
    return pickStrings({
      definition_name: process.env.TEAMCITY_BUILDCONF_NAME,
      build_id: process.env.TEAMCITY_BUILD_ID,
      build_number: process.env.BUILD_NUMBER,
      branch,
      commit,
      ci_provider: 'team-city',
      'ci.pipeline.id': process.env.TEAMCITY_BUILD_ID,
      'ci.pipeline.name': process.env.TEAMCITY_BUILDCONF_NAME,
      'ci.pipeline.run.id': process.env.TEAMCITY_BUILD_ID,
      'ci.pipeline.run.number': process.env.BUILD_NUMBER,
      'ci.pipeline.run.url': buildUrl(),
      'ci.pipeline.agent.name': process.env.AGENT_NAME,
      'ci.job.id': process.env.TEAMCITY_BUILD_ID,
      'ci.job.name': process.env.TEAMCITY_BUILDCONF_NAME,
      'ci.step.name': 'ci-apm-trace',
      'ci.build.ref': branch,
      'ci.build.commit': commit,
    })
  },

  pipelineCustom(): Record<string, unknown> {
    return pickValues({
      provider: 'team-city',
      definition_id: process.env.TEAMCITY_BUILDCONF_ID,
      definition_name: process.env.TEAMCITY_BUILDCONF_NAME,
      build_type_id: process.env.TEAMCITY_BUILDCONF_ID,
      project_id: process.env.TEAMCITY_PROJECT_ID,
      project_name: process.env.TEAMCITY_PROJECT_NAME,
      build_id: process.env.TEAMCITY_BUILD_ID,
      build_number: process.env.BUILD_NUMBER,
      build_url: buildUrl(),
      agent_name: process.env.AGENT_NAME,
      branch: process.env.BUILD_VCS_BRANCH || process.env.TEAMCITY_BUILD_BRANCH,
      commit: process.env.BUILD_VCS_NUMBER,
      server_version: process.env.TEAMCITY_VERSION,
    })
  },
}

export default teamCityProfile
