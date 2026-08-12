"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliSpanStoreManager = void 0;
exports.createCliSpanStoreManager = createCliSpanStoreManager;
exports.getCliSpanStore = getCliSpanStore;
const span_store_1 = require("./span-store");
const apm_1 = require("./apm");
/**
 * Helper to manage span storage for CLI phases (pre, main, post)
 */
class CliSpanStoreManager {
    constructor(store) {
        this.store = store;
    }
    /**
     * Send all stored spans and transaction to APM server
     */
    async sendAllData(failed, jobStatus, traceName, user, custom, tags) {
        const data = this.store.getData();
        try {
            // Send all spans first
            for (const span of data.spans) {
                try {
                    await apm_1.apm.sendSpan({
                        traceId: span.traceId,
                        spanId: span.spanId,
                        parentId: span.parentId,
                        name: span.name,
                        type: span.type,
                        subtype: span.subtype,
                        action: span.action,
                        startMs: span.startMs,
                        durationMs: span.durationMs,
                        outcome: span.outcome,
                        tags: span.tags,
                        stacktrace: span.stacktrace,
                    });
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`Failed to send span "${span.name}": ${message}`);
                }
            }
            // Send all errors
            for (const error of data.errors) {
                try {
                    await apm_1.apm.sendError({
                        traceId: error.traceId,
                        transactionId: error.transactionId,
                        parentId: error.parentId,
                        timestampMs: error.timestampMs,
                        message: error.message,
                        type: error.type,
                        code: error.code,
                        module: error.module,
                        culprit: error.culprit,
                        handled: error.handled,
                        stack: error.stack,
                        transaction: error.transaction,
                        custom: error.custom,
                        tags: error.tags,
                    });
                }
                catch (sendError) {
                    const message = sendError instanceof Error ? sendError.message : String(sendError);
                    console.error(`Failed to send error: ${message}`);
                }
            }
            // Send transaction
            const durationMs = Math.max(0, Date.now() - data.startMs);
            try {
                await apm_1.apm.sendTransaction({
                    id: data.transactionId,
                    traceId: data.traceId,
                    name: data.name,
                    type: 'pipeline',
                    startMs: data.startMs,
                    durationMs,
                    result: failed ? 'failure' : 'success',
                    outcome: failed ? 'failure' : 'success',
                    spanCount: data.spans.length,
                    user,
                    custom,
                    session: { id: data.traceId },
                    tags,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Failed to send transaction: ${message}`);
                throw error; // Re-throw as transaction send is critical
            }
            // Cleanup after successful send
            this.store.clear();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error sending stored data: ${message}`);
            // Don't clear on error - let it retry on next post
            throw error;
        }
    }
}
exports.CliSpanStoreManager = CliSpanStoreManager;
/**
 * Create a span store manager for CLI
 */
function createCliSpanStoreManager(traceId, transactionId) {
    const store = new span_store_1.SpanStore(traceId, transactionId);
    return new CliSpanStoreManager(store);
}
/**
 * Get an existing span store (for post phase)
 */
function getCliSpanStore(traceId, transactionId) {
    return new span_store_1.SpanStore(traceId, transactionId);
}
//# sourceMappingURL=cli-span-store.js.map