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
const tl = __importStar(require("azure-pipelines-task-lib"));
const child_process_1 = require("child_process");
const path_1 = require("path");
function addArg(args, flag, value) {
    if (value) {
        args.push(flag, value);
    }
}
function main() {
    try {
        const traceName = tl.getInput('traceName', false) || 'azure-devops';
        const fail = tl.getBoolInput('fail', false);
        const args = ['--trace-name', traceName];
        addArg(args, '--build-id', tl.getVariable('Build.BuildId'));
        addArg(args, '--build-number', tl.getVariable('Build.BuildNumber'));
        addArg(args, '--branch', tl.getVariable('Build.SourceBranchName'));
        addArg(args, '--commit', tl.getVariable('Build.SourceVersion'));
        addArg(args, '--repo', tl.getVariable('Build.Repository.Name'));
        addArg(args, '--ci-provider', 'azure-devops');
        if (fail) {
            args.push('--fail');
        }
        const env = {
            ...process.env,
            RUNNER_OS: tl.getVariable('Agent.OS') ?? process.env.RUNNER_OS ?? '',
            RUNNER_ARCH: tl.getVariable('Agent.OSArchitecture') ?? process.env.RUNNER_ARCH ?? '',
        };
        const cli = (0, path_1.resolve)(__dirname, 'cli.js');
        const result = (0, child_process_1.spawnSync)(process.execPath, [cli, ...args], { stdio: 'inherit', env });
        if (result.error) {
            tl.setResult(tl.TaskResult.Failed, `CI APM trace failed: ${result.error.message}`);
            return;
        }
        if (result.status === 0) {
            tl.setResult(tl.TaskResult.Succeeded, 'CI APM trace completed');
        }
        else {
            tl.setResult(tl.TaskResult.Failed, `CI APM trace failed with exit code ${result.status}`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tl.setResult(tl.TaskResult.Failed, `CI APM trace failed: ${message}`);
    }
}
main();
//# sourceMappingURL=azure-wrapper.js.map