import { SpanStore } from './span-store';
/**
 * Helper to manage span storage for CLI phases (pre, main, post)
 */
export declare class CliSpanStoreManager {
    private store;
    constructor(store: SpanStore);
    /**
     * Send all stored spans and transaction to APM server
     */
    sendAllData(failed: boolean, jobStatus: string, traceName: string, user?: any, custom?: any, tags?: Record<string, string>): Promise<void>;
}
/**
 * Create a span store manager for CLI
 */
export declare function createCliSpanStoreManager(traceId: string, transactionId: string): CliSpanStoreManager;
/**
 * Get an existing span store (for post phase)
 */
export declare function getCliSpanStore(traceId: string, transactionId: string): SpanStore;
