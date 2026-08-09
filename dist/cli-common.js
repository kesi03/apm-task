"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvConfig = getEnvConfig;
exports.initCliApm = initCliApm;
exports.randomHex = randomHex;
exports.providerName = providerName;
exports.pipelineName = pipelineName;
exports.pipelineTags = pipelineTags;
exports.pipelineUser = pipelineUser;
exports.pipelineCustom = pipelineCustom;
const crypto_1 = require("crypto");
const os = __importStar(require("os"));
const apm_1 = require("./apm");
function isTruthy(value) {
    const v = (value ?? '').toLowerCase();
    return v === 'true' || v === '1';
}
function getEnvConfig() {
    return {
        serverUrl: process.env.ELASTIC_APM_SERVER_URL,
        secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
        apiKey: process.env.ELASTIC_APM_API_KEY,
        serviceName: process.env.ELASTIC_APM_SERVICE_NAME || (process.env.GITHUB_ACTIONS === 'true' ? 'github-action' : 'cli'),
        debug: isTruthy(process.env.ELASTIC_APM_DEBUG),
    };
}
function initCliApm(options = {}) {
    const config = getEnvConfig();
    return (0, apm_1.initApm)({
        serverUrl: config.serverUrl,
        secretToken: config.secretToken,
        apiKey: config.apiKey,
        serviceName: config.serviceName,
        serviceVersion: process.env.BUILD_NUMBER,
        serviceNode: process.env.AGENT_NAME || process.env.RUNNER_NAME || os.hostname(),
        debug: config.debug || Boolean(options.debug),
        globalLabels: pipelineTags(),
    });
}
function randomHex(bytes) {
    return (0, crypto_1.randomBytes)(bytes).toString('hex');
}
function providerName() {
    return process.env.CI_PROVIDER || 'cli';
}
function pipelineName() {
    return process.env.BUILD_DEFINITION_NAME || process.env.CI_PIPELINE_NAME || 'ci-pipeline';
}
function pipelineTags() {
    const tags = {};
    const add = (key, value) => {
        if (value) {
            tags[key] = value;
        }
    };
    const buildId = process.env.BUILD_ID;
    const buildNumber = process.env.BUILD_NUMBER;
    const branch = process.env.BUILD_BRANCH;
    const commit = process.env.BUILD_COMMIT;
    const repo = process.env.BUILD_REPO;
    const provider = providerName();
    add('definition_name', pipelineName());
    add('build_id', buildId);
    add('build_number', buildNumber);
    add('branch', branch);
    add('commit', commit);
    add('repo', repo);
    add('ci_provider', provider);
    add('runner_os', process.env.RUNNER_OS);
    add('runner_arch', process.env.RUNNER_ARCH);
    add('ci.pipeline.id', buildId);
    add('ci.pipeline.name', pipelineName());
    add('ci.pipeline.run.id', buildId);
    add('ci.pipeline.run.number', buildNumber);
    add('ci.pipeline.run.url', process.env.BUILD_URL);
    add('ci.pipeline.run.user', process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR);
    add('ci.pipeline.run.result', process.env.JOB_STATUS);
    add('ci.pipeline.agent.name', process.env.AGENT_NAME || process.env.RUNNER_NAME);
    add('ci.job.id', process.env.JOB_ID);
    add('ci.job.name', process.env.JOB_NAME);
    add('ci.job.status', process.env.JOB_STATUS);
    add('ci.step.name', 'ci-apm-trace');
    add('ci.build.ref', branch);
    add('ci.build.commit', commit);
    add('ci.build.repo', repo);
    add('vcs.repository.url', process.env.BUILD_REPO_URI);
    add('vcs.ref.head.name', process.env.BUILD_REF || branch);
    add('vcs.commit.id', commit);
    return tags;
}
function pipelineUser() {
    const user = {};
    const username = process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR;
    const id = process.env.GITHUB_ACTOR_ID || process.env.BUILD_REQUESTED_FOR_ID;
    const email = process.env.GITHUB_ACTOR_EMAIL || process.env.BUILD_REQUESTED_FOR_EMAIL;
    if (id) {
        user.id = id;
    }
    if (email) {
        user.email = email;
    }
    if (username) {
        user.username = username;
    }
    return user;
}
function pipelineCustom() {
    const custom = {};
    const add = (key, value) => {
        if (value) {
            custom[key] = value;
        }
    };
    add('definition_id', process.env.BUILD_DEFINITION_ID);
    add('definition_name', pipelineName());
    add('build_id', process.env.BUILD_ID);
    add('build_number', process.env.BUILD_NUMBER);
    add('build_url', process.env.BUILD_URL);
    add('requested_for', process.env.GITHUB_ACTOR || process.env.BUILD_REQUESTED_FOR);
    add('agent_name', process.env.AGENT_NAME || process.env.RUNNER_NAME);
    add('agent_version', process.env.AGENT_VERSION);
    add('job_id', process.env.JOB_ID);
    add('job_name', process.env.JOB_NAME);
    add('repo_uri', process.env.BUILD_REPO_URI);
    return custom;
}
//# sourceMappingURL=cli-common.js.map