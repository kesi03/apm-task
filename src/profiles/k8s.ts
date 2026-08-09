import { pickStrings, pickValues } from './common'
import { PipelineProfile } from './types'

function podName(): string | undefined {
  return process.env.MY_POD_NAME || process.env.KUBERNETES_POD_NAME || process.env.HOSTNAME
}

export const k8sProfile: PipelineProfile = {
  name: 'k8s',

  applyEnv(env: NodeJS.ProcessEnv): void {
    const set = (key: string, value: string | undefined): void => {
      if (value) {
        env[key] = value
      }
    }
    const name = podName()
    set('CI_PROVIDER', 'k8s')
    set('BUILD_ID', name)
    set('AGENT_NAME', name)
    set('RUNNER_OS', process.platform)
    set('RUNNER_ARCH', process.arch)
  },

  pipelineName(): string {
    return process.env.CI_PIPELINE_NAME || 'k8s'
  },

  pipelineTags(): Record<string, string> {
    return pickStrings({
      build_id: podName(),
      ci_provider: 'k8s',
      runner_os: process.platform,
      runner_arch: process.arch,
      'ci.pipeline.agent.name': podName(),
      'ci.step.name': 'ci-apm-trace',
    })
  },

  pipelineCustom(): Record<string, unknown> {
    return pickValues({
      provider: 'k8s',
      pod_name: podName(),
      pod_namespace: process.env.MY_POD_NAMESPACE || process.env.KUBERNETES_POD_NAMESPACE,
      pod_ip: process.env.MY_POD_IP,
      node_name: process.env.MY_NODE_NAME,
      cluster_host: process.env.KUBERNETES_SERVICE_HOST,
      cluster_port: process.env.KUBERNETES_SERVICE_PORT,
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
    })
  },
}

export default k8sProfile
