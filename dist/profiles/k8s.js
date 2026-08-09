"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.k8sProfile = void 0;
const common_1 = require("./common");
function podName() {
    return process.env.MY_POD_NAME || process.env.KUBERNETES_POD_NAME || process.env.HOSTNAME;
}
exports.k8sProfile = {
    name: 'k8s',
    applyEnv(env) {
        const set = (key, value) => {
            if (value) {
                env[key] = value;
            }
        };
        const name = podName();
        set('CI_PROVIDER', 'k8s');
        set('BUILD_ID', name);
        set('AGENT_NAME', name);
        set('RUNNER_OS', process.platform);
        set('RUNNER_ARCH', process.arch);
    },
    pipelineName() {
        return process.env.CI_PIPELINE_NAME || 'k8s';
    },
    pipelineTags() {
        return (0, common_1.pickStrings)({
            build_id: podName(),
            ci_provider: 'k8s',
            runner_os: process.platform,
            runner_arch: process.arch,
            'ci.pipeline.agent.name': podName(),
            'ci.step.name': 'ci-apm-trace',
        });
    },
    pipelineCustom() {
        return (0, common_1.pickValues)({
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
        });
    },
};
exports.default = exports.k8sProfile;
//# sourceMappingURL=k8s.js.map