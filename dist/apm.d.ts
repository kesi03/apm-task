export interface ApmInitOptions {
    serverUrl?: string;
    secretToken?: string;
    apiKey?: string;
    serviceName?: string;
}
export interface Transaction {
    result: string;
    setLabel(name: string, value: string): void;
    end(): void;
}
export interface Span {
    end(): void;
}
export interface ApmAgent {
    startTransaction(name: string, type: string): Transaction;
    startSpan(name: string, type: string): Span | null;
    captureError(error: Error): void;
    flush(): Promise<void>;
}
export declare function initApm(options?: ApmInitOptions): ApmAgent;
export declare const apm: ApmAgent;
