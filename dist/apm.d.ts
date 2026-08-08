export interface ApmInitOptions {
    serverUrl?: string;
    secretToken?: string;
    apiKey?: string;
    serviceName?: string;
    serviceVersion?: string;
    serviceNode?: string;
    serviceEnvironment?: string;
    globalLabels?: Record<string, string | number | boolean>;
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
export interface UserContext {
    id?: string;
    email?: string;
    username?: string;
    domain?: string;
}
export interface SpanEventOptions {
    traceId: string;
    spanId?: string;
    parentId: string;
    name: string;
    type: string;
    subtype?: string;
    action?: string;
    startMs: number;
    durationMs?: number;
    outcome?: EventOutcome;
    stacktrace?: string;
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
    parentId?: string;
    user?: UserContext;
    custom?: Record<string, unknown>;
    session?: {
        id: string;
        sequence?: number;
    };
    tags?: Record<string, string>;
}
export interface ErrorEventOptions {
    traceId?: string;
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
    user?: UserContext;
    custom?: Record<string, unknown>;
    tags?: Record<string, string>;
}
export interface MetricSample {
    value: number;
    unit?: string;
    type?: string;
}
export interface MetricEventOptions {
    timestampMs?: number;
    samples: Record<string, number | MetricSample>;
    transaction?: {
        name?: string;
        type?: string;
    };
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
