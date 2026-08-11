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
exports.TOKEN_PARAM = exports.ENDPOINT_INPUT = void 0;
exports.getEndpointConfig = getEndpointConfig;
exports.initAzureApm = initAzureApm;
exports.randomHex = randomHex;
exports.getTraceId = getTraceId;
exports.pipelineName = pipelineName;
exports.pipelineTags = pipelineTags;
exports.pipelineUser = pipelineUser;
exports.pipelineCustom = pipelineCustom;
const tl = __importStar(require("azure-pipelines-task-lib"));
const crypto_1 = require("crypto");
const apm_1 = require("./apm");
exports.ENDPOINT_INPUT = 'apmConnection';
exports.TOKEN_PARAM = 'apitoken';
function getEndpointConfig() {
    const endpointId = tl.getInput(exports.ENDPOINT_INPUT, false);
    let serverUrl;
    let secretToken;
    try {
        serverUrl = endpointId ? (tl.getEndpointUrl(endpointId, false) ?? undefined) : undefined;
    }
    catch {
        // no connection bound in this run
    }
    try {
        if (endpointId) {
            const auth = tl.getEndpointAuthorization(endpointId, false);
            secretToken = auth?.parameters?.[exports.TOKEN_PARAM] ?? auth?.parameters?.apmSecretToken;
        }
    }
    catch {
        // APM Server may not require a token
    }
    const envDebug = (process.env.ELASTIC_APM_DEBUG ?? '').toLowerCase();
    return {
        serverUrl: serverUrl || process.env.ELASTIC_APM_SERVER_URL,
        secretToken: secretToken || process.env.ELASTIC_APM_SECRET_TOKEN,
        serviceName: 'azure-devops',
        debug: tl.getBoolInput('debug', false) || envDebug === 'true' || envDebug === '1',
    };
}
function initAzureApm() {
    const config = getEndpointConfig();
    tl.debug(`Elastic APM server URL: ${config.serverUrl ? 'configured' : 'NOT SET (trace will be a no-op)'}`);
    tl.debug(`Elastic APM secret token: ${config.secretToken ? 'configured' : 'not set'}`);
    tl.debug(`Elastic APM debug: ${config.debug}`);
    return (0, apm_1.initApm)({
        serverUrl: config.serverUrl,
        secretToken: config.secretToken,
        serviceName: config.serviceName,
        serviceVersion: tl.getVariable('Build.BuildNumber'),
        serviceNode: tl.getVariable('Agent.Name'),
        debug: config.debug,
        globalLabels: pipelineTags(),
    });
}
function randomHex(bytes) {
    return (0, crypto_1.randomBytes)(bytes).toString('hex');
}
function getTraceId() {
    return tl.getVariable('APM_TRACE_ID') || randomHex(16);
}
function pipelineName() {
    return tl.getVariable('Build.DefinitionName') || 'azure-pipelines';
}
function pipelineTags() {
    const tags = {};
    const add = (key, value) => {
        if (value) {
            tags[key] = value;
        }
    };
    add('definition_name', tl.getVariable('Build.DefinitionName'));
    add('build_id', tl.getVariable('Build.BuildId'));
    add('build_number', tl.getVariable('Build.BuildNumber'));
    add('branch', tl.getVariable('Build.SourceBranchName'));
    add('commit', tl.getVariable('Build.SourceVersion'));
    add('repo', tl.getVariable('Build.Repository.Name'));
    add('ci_provider', 'azure-devops');
    add('runner_os', tl.getVariable('Agent.OS'));
    add('runner_arch', tl.getVariable('Agent.OSArchitecture'));
    add('ci.pipeline.id', tl.getVariable('Build.DefinitionId'));
    add('ci.pipeline.name', tl.getVariable('Build.DefinitionName'));
    add('ci.pipeline.run.id', tl.getVariable('Build.BuildId'));
    add('ci.pipeline.run.number', tl.getVariable('Build.BuildNumber'));
    add('ci.pipeline.run.url', buildUrl());
    add('ci.pipeline.run.user', tl.getVariable('Build.RequestedFor'));
    add('ci.pipeline.run.result', tl.getVariable('Agent.JobStatus'));
    add('ci.pipeline.agent.name', tl.getVariable('Agent.Name'));
    add('ci.job.id', tl.getVariable('System.JobId'));
    add('ci.job.name', tl.getVariable('System.JobName'));
    add('ci.job.status', tl.getVariable('Agent.JobStatus'));
    add('ci.step.name', 'CiApmTrace');
    add('ci.build.ref', tl.getVariable('Build.SourceBranchName'));
    add('ci.build.commit', tl.getVariable('Build.SourceVersion'));
    add('ci.build.repo', tl.getVariable('Build.Repository.Name'));
    add('vcs.repository.url', tl.getVariable('Build.Repository.Uri'));
    add('vcs.ref.head.name', tl.getVariable('Build.SourceBranch'));
    add('vcs.commit.id', tl.getVariable('Build.SourceVersion'));
    return tags;
}
function buildUrl() {
    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    const project = tl.getVariable('System.TeamProject');
    const buildId = tl.getVariable('Build.BuildId');
    if (collectionUri && project && buildId) {
        return `${collectionUri.replace(/\/+$/, '')}/${project}/_build/results?buildId=${buildId}`;
    }
    return tl.getVariable('Build.BuildUri');
}
function pipelineUser() {
    const user = {};
    const id = tl.getVariable('Build.RequestedForId');
    const email = tl.getVariable('Build.RequestedForEmail');
    const username = tl.getVariable('Build.RequestedFor');
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
    add('definition_id', tl.getVariable('Build.DefinitionId'));
    add('definition_name', tl.getVariable('Build.DefinitionName'));
    add('build_id', tl.getVariable('Build.BuildId'));
    add('build_number', tl.getVariable('Build.BuildNumber'));
    add('build_url', buildUrl());
    add('queued_by', tl.getVariable('Build.QueuedBy'));
    add('requested_for', tl.getVariable('Build.RequestedFor'));
    add('agent_name', tl.getVariable('Agent.Name'));
    add('agent_version', tl.getVariable('Agent.Version'));
    add('job_id', tl.getVariable('System.JobId'));
    add('job_name', tl.getVariable('System.JobName'));
    add('project', tl.getVariable('System.TeamProject'));
    add('collection_uri', tl.getVariable('System.TeamFoundationCollectionUri'));
    add('repo_uri', tl.getVariable('Build.Repository.Uri'));
    return custom;
}
//# sourceMappingURL=azure-common.js.map