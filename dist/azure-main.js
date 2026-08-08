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
    const traceId = tl.getVariable('APM_TRACE_ID') || (0, azure_common_1.randomHex)(16);
    const transactionId = tl.getVariable('APM_TRANSACTION_ID') || (0, azure_common_1.randomHex)(8);
    const traceName = tl.getInput('traceName', false) || 'azure-devops';
    await apm_1.apm.sendSpan({
        traceId,
        spanId: (0, azure_common_1.randomHex)(8),
        parentId: transactionId,
        name: 'Main Task Execution',
        type: 'task',
        subtype: 'azure-pipelines',
        action: 'execute',
        startMs: Date.now(),
        tags: (0, azure_common_1.pipelineTags)(),
    });
    await apm_1.apm.sendLog({
        message: `${traceName} task executed`,
        level: 'info',
        logger: 'ci-apm-trace',
        traceId,
        transactionId,
    });
    tl.setResult(tl.TaskResult.Succeeded, 'Elastic APM: custom span sent');
}
run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM custom span failed: ${message}`);
});
//# sourceMappingURL=azure-main.js.map