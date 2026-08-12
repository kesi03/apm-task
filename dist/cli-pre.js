"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPre = runPre;
const apm_1 = require("./apm");
const cli_common_1 = require("./cli-common");
const span_store_1 = require("./span-store");
async function runPre(options) {
    (0, cli_common_1.initCliApm)({ debug: options.debug });
    const traceId = process.env.APM_TRACE_ID || (0, cli_common_1.randomHex)(16);
    const transactionId = (0, cli_common_1.randomHex)(8);
    const spanId = (0, cli_common_1.randomHex)(8);
    const startMs = Date.now();
    process.env.APM_TRACE_ID = traceId;
    process.env.APM_TRANSACTION_ID = transactionId;
    process.env.APM_SPAN_ID = spanId;
    process.env.APM_JOB_START_MS = String(startMs);
    process.env.APM_USE_SPAN_STORE = options.useSpanStore ? 'true' : 'false';
    if (options.useSpanStore) {
        // Alternative mode: store span data instead of sending immediately
        const store = new span_store_1.SpanStore(traceId, transactionId);
        store.initialize(options.traceName, startMs);
        store.addSpan({
            traceId,
            spanId,
            parentId: transactionId,
            name: 'Job Start',
            type: 'job',
            subtype: (0, cli_common_1.providerName)(),
            action: 'start',
            startMs,
            tags: (0, cli_common_1.pipelineTags)(),
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
            subtype: (0, cli_common_1.providerName)(),
            action: 'start',
            startMs,
            tags: (0, cli_common_1.pipelineTags)(),
        });
        await apm_1.apm.sendLog({
            message: `${(0, cli_common_1.pipelineName)()} pipeline has started`,
            level: 'info',
            logger: 'ci-apm-trace',
            traceId,
            transactionId,
        });
    }
    process.stdout.write(`export APM_TRACE_ID=${traceId}\n`);
    process.stdout.write(`export APM_TRANSACTION_ID=${transactionId}\n`);
    process.stdout.write(`export APM_SPAN_ID=${spanId}\n`);
    process.stdout.write(`export APM_JOB_START_MS=${startMs}\n`);
}
//# sourceMappingURL=cli-pre.js.map