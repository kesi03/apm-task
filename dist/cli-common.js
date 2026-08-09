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
exports.getCiPlatform = getCiPlatform;
exports.selectedProfile = selectedProfile;
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
const profiles_1 = require("./profiles");
function isTruthy(value) {
    const v = (value ?? '').toLowerCase();
    return v === 'true' || v === '1';
}
function getCiPlatform() {
    return process.env.APM_CI_PLATFORM?.trim() || undefined;
}
function selectedProfile() {
    return (0, profiles_1.getProfile)(getCiPlatform());
}
function getEnvConfig() {
    const profile = selectedProfile();
    profile.applyEnv(process.env);
    return {
        serverUrl: process.env.ELASTIC_APM_SERVER_URL,
        secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
        apiKey: process.env.ELASTIC_APM_API_KEY,
        serviceName: process.env.ELASTIC_APM_SERVICE_NAME || profile.name,
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
    return selectedProfile().name;
}
function pipelineName() {
    return selectedProfile().pipelineName();
}
function pipelineTags() {
    return selectedProfile().pipelineTags();
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
    return selectedProfile().pipelineCustom();
}
//# sourceMappingURL=cli-common.js.map