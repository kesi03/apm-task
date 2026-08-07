#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = require("path");
function getInput(name) {
    return process.env[`INPUT_${name.toUpperCase()}`] ?? undefined;
}
function addArg(args, flag, value) {
    if (value) {
        args.push(flag, value);
    }
}
function main() {
    const args = [];
    const traceName = getInput('trace-name') || 'github-action';
    const fail = (getInput('fail') || 'false').toLowerCase() === 'true';
    const apmServer = getInput('apm-server');
    const apmToken = getInput('apm-token');
    addArg(args, '--trace-name', traceName);
    addArg(args, '--build-id', process.env.GITHUB_RUN_ID);
    addArg(args, '--build-number', process.env.GITHUB_RUN_NUMBER);
    addArg(args, '--branch', process.env.GITHUB_REF_NAME);
    addArg(args, '--commit', process.env.GITHUB_SHA);
    addArg(args, '--repo', process.env.GITHUB_REPOSITORY);
    addArg(args, '--ci-provider', 'github-actions');
    if (fail) {
        args.push('--fail');
    }
    const env = {
        ...process.env,
    };
    if (apmServer) {
        env.ELASTIC_APM_SERVER_URL = apmServer;
    }
    if (apmToken) {
        env.ELASTIC_APM_SECRET_TOKEN = apmToken;
    }
    const cli = (0, path_1.resolve)(__dirname, 'cli.js');
    const result = (0, child_process_1.spawnSync)(process.execPath, [cli, ...args], { stdio: 'inherit', env });
    if (result.error) {
        console.error(`ci-apm-trace github wrapper failed: ${result.error.message}`);
        process.exit(1);
    }
    process.exit(result.status ?? 1);
}
main();
//# sourceMappingURL=github-wrapper.js.map