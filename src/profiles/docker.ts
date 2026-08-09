import { pickStrings, pickValues } from './common'
import { PipelineProfile } from './types'

export const dockerProfile: PipelineProfile = {
  name: 'docker',

  applyEnv(env: NodeJS.ProcessEnv): void {
    const set = (key: string, value: string | undefined): void => {
      if (value) {
        env[key] = value
      }
    }
    set('CI_PROVIDER', 'docker')
    set('BUILD_ID', process.env.HOSTNAME)
    set('AGENT_NAME', process.env.HOSTNAME)
    set('RUNNER_OS', process.platform)
    set('RUNNER_ARCH', process.arch)
  },

  pipelineName(): string {
    return process.env.CI_PIPELINE_NAME || 'docker'
  },

  pipelineTags(): Record<string, string> {
    return pickStrings({
      build_id: process.env.HOSTNAME,
      ci_provider: 'docker',
      runner_os: process.platform,
      runner_arch: process.arch,
      'ci.pipeline.agent.name': process.env.HOSTNAME,
      'ci.step.name': 'ci-apm-trace',
    })
  },

  pipelineCustom(): Record<string, unknown> {
    return pickValues({
      provider: 'docker',
      container_id: process.env.HOSTNAME,
      hostname: process.env.HOSTNAME,
      ci: process.env.CI,
      image: process.env.IMAGE_NAME,
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
    })
  },
}

export default dockerProfile
