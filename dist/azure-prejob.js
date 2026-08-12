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
const span_store_1 = require("./span-store");
async function run() {
    (0, azure_common_1.initAzureApm)();
    const useSpanStore = (tl.getInput('useSpanStore', false) || 'false').toLowerCase() === 'true';
    const traceId = tl.getVariable('APM_TRACE_ID') || (0, azure_common_1.randomHex)(16);
    const transactionId = (0, azure_common_1.randomHex)(8);
    const spanId = (0, azure_common_1.randomHex)(8);
    const startMs = Date.now();
    tl.setVariable('APM_TRACE_ID', traceId);
    tl.setVariable('APM_TRANSACTION_ID', transactionId);
    tl.setVariable('APM_SPAN_ID', spanId);
    tl.setVariable('APM_JOB_START_MS', String(startMs));
    tl.setVariable('APM_USE_SPAN_STORE', useSpanStore ? 'true' : 'false');
    if (useSpanStore) {
        // Alternative mode: store span data instead of sending immediately
        const store = new span_store_1.SpanStore(traceId, transactionId);
        store.initialize('azure-devops', startMs);
        store.addSpan({
            traceId,
            spanId,
            parentId: transactionId,
            name: 'Job Start',
            type: 'job',
            subtype: 'azure-pipelines',
            action: 'start',
            startMs,
            tags: (0, azure_common_1.pipelineTags)(),
        });
        console.log(`[APM-STORE] Initialized span store for ${traceId}`);
    }
    else {
        // Original mode: send immediately
        await apm_1.apm.sendSpan({
            traceId,
            spanId,
            parentId: transactionId,
            name: 'Job Start',
            type: 'job',
            subtype: 'azure-pipelines',
            action: 'start',
            startMs,
            tags: (0, azure_common_1.pipelineTags)(),
        });
        await apm_1.apm.sendLog({
            message: `${(0, azure_common_1.pipelineName)()} pipeline has started`,
            level: 'info',
            logger: 'ci-apm-trace',
            traceId,
            transactionId,
        });
    }
    console.log('Elastic APM: job span started');
}
run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM pre-job span failed: ${message}`);
});
//# sourceMappingURL=azure-prejob.js.map