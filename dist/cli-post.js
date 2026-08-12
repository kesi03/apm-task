"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPost = runPost;
const apm_1 = require("./apm");
const ecs_metrics_1 = require("./ecs-metrics");
const runtime_metrics_1 = require("./runtime-metrics");
const cli_common_1 = require("./cli-common");
const span_store_1 = require("./span-store");
const cli_span_store_1 = require("./cli-span-store");
async function runPost(options) {
    (0, cli_common_1.initCliApm)({ debug: options.debug });
    const jobStatus = process.env.JOB_STATUS || 'Succeeded';
    const failed = options.fail || jobStatus === 'Failed' || jobStatus === 'Canceled';
    const traceId = process.env.APM_TRACE_ID || (0, cli_common_1.randomHex)(16);
    const transactionId = process.env.APM_TRANSACTION_ID || (0, cli_common_1.randomHex)(8);
    const spanId = process.env.APM_SPAN_ID || (0, cli_common_1.randomHex)(8);
    const startMsRaw = process.env.APM_JOB_START_MS;
    const startMs = startMsRaw ? Number(startMsRaw) : Date.now();
    const durationMs = startMsRaw ? Math.max(0, Date.now() - startMs) : 0;
    const tags = (0, cli_common_1.pipelineTags)();
    const buildNumber = process.env.BUILD_NUMBER;
    const transactionName = buildNumber ? `${options.traceName}-${buildNumber}` : options.traceName;
    const useSpanStore = process.env.APM_USE_SPAN_STORE === 'true' || options.useSpanStore;
    if (useSpanStore) {
        // Alternative mode: send all accumulated spans from store
        const store = new span_store_1.SpanStore(traceId, transactionId);
        const manager = new cli_span_store_1.CliSpanStoreManager(store);
        try {
            // Add the final job-end span to the store before sending everything
            if (store.exists()) {
                store.addSpan({
                    traceId,
                    spanId,
                    parentId: transactionId,
                    name: 'Job End',
                    type: 'job',
                    subtype: (0, cli_common_1.providerName)(),
                    action: 'end',
                    startMs,
                    durationMs,
                    outcome: failed ? 'failure' : 'success',
                    tags,
                });
                if (failed) {
                    store.addError({
                        traceId,
                        transactionId,
                        parentId: transactionId,
                        message: `Pipeline failed: ${jobStatus}`,
                        type: 'pipeline-failure',
                        transaction: { name: transactionName, type: 'pipeline', sampled: true },
                        custom: (0, cli_common_1.pipelineCustom)(),
                        tags,
                    });
                }
            }
            console.log(`[APM-STORE] Sending ${store.getData().spans.length} spans and transaction from store`);
            await manager.sendAllData(failed, jobStatus, transactionName, (0, cli_common_1.pipelineUser)(), (0, cli_common_1.pipelineCustom)(), tags);
            console.log('[APM-STORE] Successfully sent all stored data');
            // Send metrics after transaction
            try {
                await apm_1.apm.sendMetric({
                    timestampMs: Date.now(),
                    samples: {
                        'ci.job.duration.ms': { value: durationMs, unit: 'ms' },
                        'ci.job.success': { value: failed ? 0 : 1, unit: 'bool' },
                    },
                    transaction: { name: transactionName, type: 'pipeline' },
                    tags,
                });
                await (0, ecs_metrics_1.sendEcsMetrics)(apm_1.apm, {
                    serviceName: (0, cli_common_1.serviceName)(),
                    serviceVersion: buildNumber,
                    transaction: { name: transactionName, type: 'pipeline' },
                    tags,
                });
                await (0, runtime_metrics_1.sendRuntimeMetrics)(apm_1.apm, {
                    serviceName: (0, cli_common_1.serviceName)(),
                    serviceVersion: buildNumber,
                    transaction: { name: transactionName, type: 'pipeline' },
                    tags,
                });
            }
            catch (metricsError) {
                const message = metricsError instanceof Error ? metricsError.message : String(metricsError);
                console.warn(`[APM-STORE] Failed to send metrics: ${message}`);
                // Don't fail on metrics errors
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[APM-STORE] Failed to send stored data: ${message}`);
            throw error;
        }
    }
    else {
        // Original mode: send spans immediately
        await apm_1.apm.sendSpan({
            traceId,
            spanId,
            parentId: transactionId,
            name: 'Job End',
            type: 'job',
            subtype: (0, cli_common_1.providerName)(),
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
            user: (0, cli_common_1.pipelineUser)(),
            custom: (0, cli_common_1.pipelineCustom)(),
            session: { id: traceId },
            tags,
        });
        await apm_1.apm.sendLog({
            message: failed ? `${(0, cli_common_1.pipelineName)()} pipeline has failed: ${jobStatus}` : `${(0, cli_common_1.pipelineName)()} pipeline has ended`,
            level: failed ? 'error' : 'info',
            logger: 'ci-apm-trace',
            dataset: 'ci',
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
                user: (0, cli_common_1.pipelineUser)(),
                custom: (0, cli_common_1.pipelineCustom)(),
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
        await (0, ecs_metrics_1.sendEcsMetrics)(apm_1.apm, {
            serviceName: (0, cli_common_1.serviceName)(),
            serviceVersion: buildNumber,
            transaction: { name: transactionName, type: 'pipeline' },
            tags,
        });
        await (0, runtime_metrics_1.sendRuntimeMetrics)(apm_1.apm, {
            serviceName: (0, cli_common_1.serviceName)(),
            serviceVersion: buildNumber,
            transaction: { name: transactionName, type: 'pipeline' },
            tags,
        });
    }
}
//# sourceMappingURL=cli-post.js.map