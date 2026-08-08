export interface ApmInitOptions {
    serverUrl?: string;
    secretToken?: string;
    apiKey?: string;
    serviceName?: string;
    debug?: boolean;
}
export interface Transaction {
    result: string;
    setLabel(name: string, value: string): void;
    end(): void;
}
export interface Span {
    end(): void;
}
export type EventOutcome = 'success' | 'failure' | 'unknown';
export interface SpanEventOptions {
    traceId: string;
    spanId?: string;
    parentId: string;
    name: string;
    type: string;
    startMs: number;
    durationMs?: number;
    outcome?: EventOutcome;
    tags?: Record<string, string>;
}
export interface TransactionEventOptions {
    id: string;
    traceId: string;
    name: string;
    type: string;
    startMs: number;
    durationMs: number;
    result: string;
    outcome: EventOutcome;
    spanCount?: number;
    tags?: Record<string, string>;
}
export interface ErrorEventOptions {
    traceId: string;
    transactionId?: string;
    timestampMs?: number;
    message: string;
    type?: string;
    stack?: string;
    tags?: Record<string, string>;
}
export interface MetricEventOptions {
    timestampMs?: number;
    samples: Record<string, number>;
    tags?: Record<string, string>;
}
export interface ApmAgent {
    startTransaction(name: string, type: string): Transaction;
    startSpan(name: string, type: string): Span | null;
    captureError(error: Error): void;
    flush(): Promise<void>;
    sendSpan(event: SpanEventOptions): Promise<void>;
    sendTransaction(event: TransactionEventOptions): Promise<void>;
    sendError(event: ErrorEventOptions): Promise<void>;
    sendMetric(event: MetricEventOptions): Promise<void>;
}
export declare function initApm(options?: ApmInitOptions): ApmAgent;
export declare const apm: ApmAgent;
