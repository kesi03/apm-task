#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = require("path");
const github_env_1 = require("./github-env");
function getInput(name) {
    const key = name.toUpperCase().replace(/ /g, '_');
    return process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, '_')}`] ?? undefined;
}
function getState(name) {
    return process.env[`STATE_${name}`] ?? '';
}
function main() {
    const traceName = getInput('trace-name') || 'github-action';
    const fail = (getInput('fail') || 'false').toLowerCase() === 'true';
    const debug = (getInput('debug') || 'false').toLowerCase() === 'true';
    const useSpanStore = (getInput('use-span-store') || 'false').toLowerCase() === 'true';
    const apmServer = getInput('apm-server');
    const apmToken = getInput('apm-token');
    const jobStatus = (getInput('__job-status') || 'success').toLowerCase();
    const env = { ...process.env };
    (0, github_env_1.applyGitHubEnv)(env);
    env.APM_CI_PLATFORM = 'github-action';
    for (const name of ['APM_TRACE_ID', 'APM_TRANSACTION_ID', 'APM_SPAN_ID', 'APM_JOB_START_MS', 'APM_USE_SPAN_STORE']) {
        const value = getState(name);
        if (value) {
            env[name] = value;
        }
    }
    if (apmServer) {
        env.ELASTIC_APM_SERVER_URL = apmServer;
    }
    if (apmToken) {
        env.ELASTIC_APM_SECRET_TOKEN = apmToken;
    }
    const failed = fail || jobStatus === 'failure' || jobStatus === 'cancelled' || getState('APM_FAILED') === 'true';
    env.JOB_STATUS = failed ? 'Failed' : 'Succeeded';
    const args = ['post', '--trace-name', traceName];
    if (debug) {
        args.push('--debug');
    }
    if (useSpanStore) {
        args.push('--use-span-store');
    }
    const cli = (0, path_1.resolve)(__dirname, 'cli.js');
    const result = (0, child_process_1.spawnSync)(process.execPath, [cli, ...args], { stdio: 'inherit', env });
    if (result.error) {
        console.error(`ci-apm-trace github post failed: ${result.error.message}`);
        process.exit(1);
    }
    process.exit(result.status ?? 1);
}
main();
//# sourceMappingURL=github-post.js.map