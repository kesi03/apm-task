"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpanStore = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
class SpanStore {
    constructor(traceId, transactionId, storeDir) {
        this.traceId = traceId;
        this.transactionId = transactionId;
        const dir = storeDir || (0, os_1.tmpdir)();
        this.storePath = (0, path_1.join)(dir, `.apm-trace-${traceId}-${transactionId}.json`);
    }
    /**
     * Initialize the store with transaction data
     */
    initialize(name, startMs, labels) {
        const data = {
            traceId: this.traceId,
            transactionId: this.transactionId,
            name,
            startMs,
            spans: [],
            errors: [],
            labels,
        };
        this.write(data);
    }
    /**
     * Add a span to the store
     */
    addSpan(span) {
        const data = this.read();
        data.spans.push(span);
        this.write(data);
    }
    /**
     * Add an error to the store
     */
    addError(error) {
        const data = this.read();
        data.errors.push(error);
        this.write(data);
    }
    /**
     * Get all stored data
     */
    getData() {
        return this.read();
    }
    /**
     * Clear the store (cleanup after sending)
     */
    clear() {
        try {
            if ((0, fs_1.existsSync)(this.storePath)) {
                (0, fs_1.unlinkSync)(this.storePath);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to clear span store: ${message}`);
        }
    }
    /**
     * Check if store exists
     */
    exists() {
        return (0, fs_1.existsSync)(this.storePath);
    }
    read() {
        try {
            if (!(0, fs_1.existsSync)(this.storePath)) {
                return {
                    traceId: this.traceId,
                    transactionId: this.transactionId,
                    name: 'unknown',
                    startMs: Date.now(),
                    spans: [],
                    errors: [],
                };
            }
            const content = (0, fs_1.readFileSync)(this.storePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to read span store: ${message}`);
            return {
                traceId: this.traceId,
                transactionId: this.transactionId,
                name: 'unknown',
                startMs: Date.now(),
                spans: [],
                errors: [],
            };
        }
    }
    write(data) {
        try {
            (0, fs_1.writeFileSync)(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to write span store: ${message}`);
        }
    }
}
exports.SpanStore = SpanStore;
//# sourceMappingURL=span-store.js.map