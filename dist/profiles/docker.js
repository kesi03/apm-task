"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerProfile = void 0;
const common_1 = require("./common");
exports.dockerProfile = {
    name: 'docker',
    applyEnv(env) {
        const set = (key, value) => {
            if (value) {
                env[key] = value;
            }
        };
        set('CI_PROVIDER', 'docker');
        set('BUILD_ID', process.env.HOSTNAME);
        set('AGENT_NAME', process.env.HOSTNAME);
        set('RUNNER_OS', process.platform);
        set('RUNNER_ARCH', process.arch);
    },
    pipelineName() {
        return process.env.CI_PIPELINE_NAME || 'docker';
    },
    pipelineTags() {
        return (0, common_1.pickStrings)({
            build_id: process.env.HOSTNAME,
            ci_provider: 'docker',
            runner_os: process.platform,
            runner_arch: process.arch,
            'ci.pipeline.agent.name': process.env.HOSTNAME,
            'ci.step.name': 'ci-apm-trace',
        });
    },
    pipelineCustom() {
        return (0, common_1.pickValues)({
            provider: 'docker',
            container_id: process.env.HOSTNAME,
            hostname: process.env.HOSTNAME,
            ci: process.env.CI,
            image: process.env.IMAGE_NAME,
            platform: process.platform,
            arch: process.arch,
            node_version: process.version,
        });
    },
};
exports.default = exports.dockerProfile;
//# sourceMappingURL=docker.js.map