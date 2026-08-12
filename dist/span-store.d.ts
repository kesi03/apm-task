export interface StoredSpan {
    traceId: string;
    spanId: string;
    parentId: string;
    name: string;
    type: string;
    subtype?: string;
    action?: string;
    startMs: number;
    durationMs?: number;
    outcome?: 'success' | 'failure' | 'unknown';
    tags?: Record<string, string>;
    stacktrace?: string;
}
export interface StoredError {
    traceId: string;
    transactionId?: string;
    parentId?: string;
    timestampMs?: number;
    message: string;
    type?: string;
    code?: string;
    module?: string;
    culprit?: string;
    handled?: boolean;
    stack?: string;
    transaction?: {
        name?: string;
        type?: string;
        sampled?: boolean;
    };
    custom?: Record<string, unknown>;
    tags?: Record<string, string>;
}
export interface TransactionStoreData {
    traceId: string;
    transactionId: string;
    name: string;
    startMs: number;
    spans: StoredSpan[];
    errors: StoredError[];
    labels?: Record<string, string>;
}
export declare class SpanStore {
    private storePath;
    private traceId;
    private transactionId;
    constructor(traceId: string, transactionId: string, storeDir?: string);
    /**
     * Initialize the store with transaction data
     */
    initialize(name: string, startMs: number, labels?: Record<string, string>): void;
    /**
     * Add a span to the store
     */
    addSpan(span: StoredSpan): void;
    /**
     * Add an error to the store
     */
    addError(error: StoredError): void;
    /**
     * Get all stored data
     */
    getData(): TransactionStoreData;
    /**
     * Clear the store (cleanup after sending)
     */
    clear(): void;
    /**
     * Check if store exists
     */
    exists(): boolean;
    private read;
    private write;
}
