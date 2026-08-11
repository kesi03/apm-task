#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const github_env_1 = require("./github-env");
function getInput(name) {
    const key = name.toUpperCase().replace(/ /g, '_');
    return process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, '_')}`] ?? undefined;
}
function saveState(name, value) {
    const file = process.env.GITHUB_STATE;
    if (!file) {
        return;
    }
    (0, fs_1.appendFileSync)(file, `${name}=${value}\n`);
}
function buildEnv(apmServer, apmToken) {
    const env = { ...process.env };
    (0, github_env_1.applyGitHubEnv)(env);
    env.APM_CI_PLATFORM = 'github-action';
    if (apmServer) {
        env.ELASTIC_APM_SERVER_URL = apmServer;
    }
    if (apmToken) {
        env.ELASTIC_APM_SECRET_TOKEN = apmToken;
    }
    return env;
}
function runCli(args, env, capture = false) {
    const cli = (0, path_1.resolve)(__dirname, 'cli.js');
    const result = (0, child_process_1.spawnSync)(process.execPath, [cli, ...args], {
        stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
        env,
    });
    if (result.error) {
        console.error(`ci-apm-trace github wrapper failed: ${result.error.message}`);
        process.exit(1);
    }
    return { status: result.status, stdout: result.stdout ? result.stdout.toString() : '' };
}
function parseExports(stdout) {
    const state = {};
    for (const line of stdout.split('\n')) {
        const match = line.match(/^export (APM_\w+)=(.+)$/);
        if (match) {
            state[match[1]] = match[2];
        }
    }
    return state;
}
function main() {
    const traceName = getInput('trace-name') || 'github-action';
    const fail = (getInput('fail') || 'false').toLowerCase() === 'true';
    const debug = (getInput('debug') || 'false').toLowerCase() === 'true';
    const apmServer = getInput('apm-server');
    const apmToken = getInput('apm-token');
    const env = buildEnv(apmServer, apmToken);
    const preArgs = ['pre', '--trace-name', traceName];
    if (debug) {
        preArgs.push('--debug');
    }
    const pre = runCli(preArgs, env, true);
    if (pre.status !== 0) {
        process.exit(pre.status ?? 1);
    }
    const state = parseExports(pre.stdout);
    for (const [key, value] of Object.entries(state)) {
        saveState(key, value);
        env[key] = value;
    }
    saveState('APM_FAILED', fail ? 'true' : 'false');
    const mainArgs = ['main', '--trace-name', traceName];
    if (debug) {
        mainArgs.push('--debug');
    }
    const run = runCli(mainArgs, env);
    if (run.status !== 0) {
        process.exit(run.status ?? 1);
    }
    if (fail) {
        process.exitCode = 1;
    }
}
main();
//# sourceMappingURL=github-wrapper.js.map