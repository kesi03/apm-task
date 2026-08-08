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
const apm_1 = require("./apm");
const azure_common_1 = require("./azure-common");
async function run() {
    (0, azure_common_1.initAzureApm)();
    const traceName = tl.getInput('traceName', false) || 'azure-devops';
    const fail = tl.getBoolInput('fail', false);
    const jobStatus = tl.getVariable('Agent.JobStatus') || 'Succeeded';
    const failed = fail || jobStatus === 'Failed' || jobStatus === 'Canceled';
    const traceId = tl.getVariable('APM_TRACE_ID') || (0, azure_common_1.randomHex)(16);
    const transactionId = tl.getVariable('APM_TRANSACTION_ID') || (0, azure_common_1.randomHex)(8);
    const spanId = tl.getVariable('APM_SPAN_ID') || (0, azure_common_1.randomHex)(8);
    const startMsRaw = tl.getVariable('APM_JOB_START_MS');
    const startMs = startMsRaw ? Number(startMsRaw) : Date.now();
    const durationMs = startMsRaw ? Math.max(0, Date.now() - startMs) : 0;
    const tags = (0, azure_common_1.pipelineTags)();
    const buildNumber = tl.getVariable('Build.BuildNumber');
    const transactionName = buildNumber ? `${traceName}-${buildNumber}` : traceName;
    await apm_1.apm.sendSpan({
        traceId,
        spanId,
        parentId: transactionId,
        name: 'Job End',
        type: 'job',
        subtype: 'azure-pipelines',
        action: 'end',
        startMs,
        durationMs,
        outcome: failed ? 'failure' : 'success',
        tags,
    });
    await apm_1.apm.sendTransaction({
        id: transactionId,
        traceId,
        name: transactionName,
        type: 'pipeline',
        startMs,
        durationMs,
        result: failed ? 'failure' : 'success',
        outcome: failed ? 'failure' : 'success',
        spanCount: 3,
        user: (0, azure_common_1.pipelineUser)(),
        custom: (0, azure_common_1.pipelineCustom)(),
        session: { id: traceId },
        tags,
    });
    await apm_1.apm.sendLog({
        message: failed ? `${(0, azure_common_1.pipelineName)()} pipeline has failed: ${jobStatus}` : `${(0, azure_common_1.pipelineName)()} pipeline has ended`,
        level: failed ? 'error' : 'info',
        logger: 'ci-apm-trace',
        dataset: 'azure-pipelines',
        traceId,
        transactionId,
    });
    if (failed) {
        await apm_1.apm.sendError({
            traceId,
            transactionId,
            parentId: transactionId,
            message: `Pipeline failed: ${jobStatus}`,
            type: 'pipeline-failure',
            transaction: { name: transactionName, type: 'pipeline', sampled: true },
            user: (0, azure_common_1.pipelineUser)(),
            custom: (0, azure_common_1.pipelineCustom)(),
            tags,
        });
    }
    await apm_1.apm.sendMetric({
        timestampMs: Date.now(),
        samples: {
            'ci.job.duration.ms': { value: durationMs, unit: 'ms' },
            'ci.job.success': { value: failed ? 0 : 1, unit: 'bool' },
        },
        transaction: { name: transactionName, type: 'pipeline' },
        tags,
    });
    if (failed) {
        tl.setResult(tl.TaskResult.SucceededWithIssues, 'Elastic APM: pipeline failure recorded');
    }
    else {
        tl.setResult(tl.TaskResult.Succeeded, 'Elastic APM: trace sent');
    }
}
run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM trace failed: ${message}`);
});
//# sourceMappingURL=azure-postjob.js.map