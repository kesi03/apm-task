#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const apm_1 = require("./apm");
const lifecycle_1 = require("./lifecycle");
async function main() {
    const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .options({
        'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
        },
        'build-id': {
            type: 'string',
            description: 'CI build/pipeline ID',
        },
        'build-number': {
            type: 'string',
            description: 'CI build number',
        },
        branch: {
            type: 'string',
            description: 'Git branch',
        },
        commit: {
            type: 'string',
            description: 'Git commit SHA',
        },
        repo: {
            type: 'string',
            description: 'Repository name',
        },
        'ci-provider': {
            type: 'string',
            description: 'CI provider name',
        },
        fail: {
            type: 'boolean',
            default: false,
            description: 'Simulate a pipeline failure',
        },
    })
        .parseSync();
    if (argv['build-id']) {
        process.env.BUILD_ID = argv['build-id'];
    }
    if (argv['build-number']) {
        process.env.BUILD_NUMBER = argv['build-number'];
    }
    if (argv.branch) {
        process.env.BUILD_BRANCH = argv.branch;
    }
    if (argv.commit) {
        process.env.BUILD_COMMIT = argv.commit;
    }
    if (argv.repo) {
        process.env.BUILD_REPO = argv.repo;
    }
    if (argv['ci-provider']) {
        process.env.CI_PROVIDER = argv['ci-provider'];
    }
    (0, apm_1.initApm)();
    const lifecycle = (0, lifecycle_1.createLifecycle)();
    const labels = {
        buildId: argv['build-id'],
        buildNumber: argv['build-number'],
        branch: argv.branch,
        commit: argv.commit,
        repo: argv.repo,
        ciProvider: argv['ci-provider'],
        runnerOs: process.env.RUNNER_OS,
        runnerArch: process.env.RUNNER_ARCH,
    };
    lifecycle.startPipeline(argv['trace-name'], labels);
    lifecycle.addStep('cli-run');
    if (argv.fail) {
        process.exitCode = 1;
        await lifecycle.endPipelineFailure(new Error('Pipeline failed because --fail was set'));
        process.exit(1);
    }
    else {
        process.exitCode = 0;
        await lifecycle.endPipelineSuccess();
        process.exit(0);
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ci-apm-trace failed: ${message}`);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map