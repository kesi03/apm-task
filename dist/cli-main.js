"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMain = runMain;
const apm_1 = require("./apm");
const cli_common_1 = require("./cli-common");
async function runMain(options) {
    (0, cli_common_1.initCliApm)({ debug: options.debug });
    const traceId = process.env.APM_TRACE_ID || (0, cli_common_1.randomHex)(16);
    const transactionId = process.env.APM_TRANSACTION_ID || (0, cli_common_1.randomHex)(8);
    await apm_1.apm.sendSpan({
        traceId,
        spanId: (0, cli_common_1.randomHex)(8),
        parentId: transactionId,
        name: 'Main Task Execution',
        type: 'task',
        subtype: (0, cli_common_1.providerName)(),
        action: 'execute',
        startMs: Date.now(),
        tags: (0, cli_common_1.pipelineTags)(),
    });
    await apm_1.apm.sendLog({
        message: `${options.traceName} task executed`,
        level: 'info',
        logger: 'ci-apm-trace',
        traceId,
        transactionId,
    });
}
//# sourceMappingURL=cli-main.js.map