"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMain = runMain;
const apm_1 = require("./apm");
const cli_common_1 = require("./cli-common");
const span_store_1 = require("./span-store");
async function runMain(options) {
    (0, cli_common_1.initCliApm)({ debug: options.debug });
    const traceId = process.env.APM_TRACE_ID || (0, cli_common_1.randomHex)(16);
    const transactionId = process.env.APM_TRANSACTION_ID || (0, cli_common_1.randomHex)(8);
    const useSpanStore = process.env.APM_USE_SPAN_STORE === 'true' || options.useSpanStore;
    const mainSpan = {
        traceId,
        spanId: (0, cli_common_1.randomHex)(8),
        parentId: transactionId,
        name: 'Main Task Execution',
        type: 'task',
        subtype: (0, cli_common_1.providerName)(),
        action: 'execute',
        startMs: Date.now(),
        tags: (0, cli_common_1.pipelineTags)(),
    };
    if (useSpanStore) {
        // Alternative mode: store span instead of sending immediately
        const store = new span_store_1.SpanStore(traceId, transactionId);
        store.addSpan(mainSpan);
        console.log(`[APM-STORE] Added main task span to store for ${traceId}`);
    }
    else {
        // Original mode: send immediately
        await apm_1.apm.sendSpan(mainSpan);
        await apm_1.apm.sendLog({
            message: `${options.traceName} task executed`,
            level: 'info',
            logger: 'ci-apm-trace',
            traceId,
            transactionId,
        });
    }
}
//# sourceMappingURL=cli-main.js.map