#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const lifecycle_1 = require("./lifecycle");
const cli_common_1 = require("./cli-common");
const cli_pre_1 = require("./cli-pre");
const cli_main_1 = require("./cli-main");
const cli_post_1 = require("./cli-post");
const dotenv_1 = require("./dotenv");
function applyCiPlatform(value) {
    if (value) {
        process.env.APM_CI_PLATFORM = value;
    }
}
function applyEnv(args) {
    applyCiPlatform(args['ci_platform']);
    if (args['build-id']) {
        process.env.BUILD_ID = args['build-id'];
    }
    if (args['build-number']) {
        process.env.BUILD_NUMBER = args['build-number'];
    }
    if (args.branch) {
        process.env.BUILD_BRANCH = args.branch;
    }
    if (args.commit) {
        process.env.BUILD_COMMIT = args.commit;
    }
    if (args.repo) {
        process.env.BUILD_REPO = args.repo;
    }
    if (args['ci-provider']) {
        process.env.CI_PROVIDER = args['ci-provider'];
    }
}
function resolveEnvFile(argv) {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--env-file') {
            return argv[i + 1];
        }
        if (arg.startsWith('--env-file=')) {
            return arg.slice('--env-file='.length);
        }
    }
    return undefined;
}
function loadEnv() {
    const envFile = resolveEnvFile(process.argv);
    if (envFile !== undefined) {
        if (envFile) {
            (0, dotenv_1.loadEnvFile)((0, path_1.resolve)(envFile));
        }
        return;
    }
    (0, dotenv_1.loadEnvFile)((0, path_1.resolve)('.env'));
}
async function runFlat(args) {
    applyEnv(args);
    (0, cli_common_1.initCliApm)({ debug: args.debug });
    const lifecycle = (0, lifecycle_1.createLifecycle)();
    const labels = {
        buildId: args['build-id'],
        buildNumber: args['build-number'],
        branch: args.branch,
        commit: args.commit,
        repo: args.repo,
        ciProvider: args['ci-provider'],
        runnerOs: process.env.RUNNER_OS,
        runnerArch: process.env.RUNNER_ARCH,
    };
    lifecycle.startPipeline(args['trace-name'], labels);
    lifecycle.addStep('cli-run');
    if (args.fail) {
        process.exitCode = 1;
        await lifecycle.endPipelineFailure(new Error('Pipeline failed because --fail was set'));
    }
    else {
        process.exitCode = 0;
        await lifecycle.endPipelineSuccess();
    }
}
async function main() {
    loadEnv();
    const parser = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .scriptName('ci-apm-trace')
        .command('pre', 'Start the trace: generate IDs and emit APM_* environment variables for main/post', (y) => y.options({
        'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
        },
        debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
        },
        'use-span-store': {
            type: 'boolean',
            default: false,
            description: 'Store spans in memory/file and send all at post (alternative mode)',
        },
    }), async (argv) => {
        const args = argv;
        applyCiPlatform(args['ci_platform']);
        try {
            await (0, cli_pre_1.runPre)({ traceName: args['trace-name'], debug: args.debug, useSpanStore: args['use-span-store'] ?? false });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`ci-apm-trace pre failed: ${message}`);
            process.exitCode = 1;
        }
    })
        .command('main', 'Record the main task execution span under the running trace', (y) => y.options({
        'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
        },
        debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
        },
        'use-span-store': {
            type: 'boolean',
            default: false,
            description: 'Store spans in memory/file and send all at post (alternative mode)',
        },
    }), async (argv) => {
        const args = argv;
        applyCiPlatform(args['ci_platform']);
        try {
            await (0, cli_main_1.runMain)({ traceName: args['trace-name'], debug: args.debug, useSpanStore: args['use-span-store'] ?? false });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`ci-apm-trace main failed: ${message}`);
            process.exitCode = 1;
        }
    })
        .command('post', 'End the trace: transaction, error, and metrics for the completed pipeline', (y) => y.options({
        'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
        },
        fail: {
            type: 'boolean',
            default: false,
            description: 'Simulate a pipeline failure',
        },
        debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
        },
        'use-span-store': {
            type: 'boolean',
            default: false,
            description: 'Store spans in memory/file and send all at post (alternative mode)',
        },
    }), async (argv) => {
        const args = argv;
        applyCiPlatform(args['ci_platform']);
        try {
            await (0, cli_post_1.runPost)({ traceName: args['trace-name'], fail: args.fail, debug: args.debug, useSpanStore: args['use-span-store'] ?? false });
            process.exitCode = args.fail ? 1 : 0;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`ci-apm-trace post failed: ${message}`);
            process.exitCode = 1;
        }
    })
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
        'ci_platform': {
            type: 'string',
            default: process.env.APM_CI_PLATFORM,
            description: 'CI platform profile to use (npm, github-action, azure-devops, team-city, jenkins, docker, k8s, task)',
        },
        'env-file': {
            type: 'string',
            description: 'Path to an .env file to load (default: .env in the current directory)',
        },
        'use-span-store': {
            type: 'boolean',
            default: false,
            description: 'Store spans in memory/file and send all at post (alternative mode)',
        },
        fail: {
            type: 'boolean',
            default: false,
            description: 'Simulate a pipeline failure',
        },
        debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
        },
    })
        .help();
    const argv = (await parser.parseAsync());
    if (argv._.length === 0) {
        await runFlat(argv);
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ci-apm-trace failed: ${message}`);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map