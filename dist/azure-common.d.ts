import { ApmAgent } from './apm';
export declare const ENDPOINT_INPUT = "apmConnection";
export declare const TOKEN_PARAM = "apitoken";
export interface AzureEndpointConfig {
    serverUrl?: string;
    secretToken?: string;
    serviceName: string;
    debug: boolean;
}
export declare function getEndpointConfig(): AzureEndpointConfig;
export declare function initAzureApm(): ApmAgent;
export declare function randomHex(bytes: number): string;
export declare function getTraceId(): string;
export declare function pipelineTags(): Record<string, string>;
