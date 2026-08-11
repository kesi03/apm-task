import { ApmAgent } from './apm';
import { PipelineProfile } from './profiles/types';
export interface CliEndpointConfig {
    serverUrl?: string;
    secretToken?: string;
    apiKey?: string;
    serviceName: string;
    debug: boolean;
}
export declare function getCiPlatform(): string | undefined;
export declare function selectedProfile(): PipelineProfile;
export declare function getEnvConfig(): CliEndpointConfig;
export declare function initCliApm(options?: {
    debug?: boolean;
}): ApmAgent;
export declare function randomHex(bytes: number): string;
export declare function providerName(): string;
export declare function serviceName(): string;
export declare function pipelineName(): string;
export declare function pipelineTags(): Record<string, string>;
export declare function pipelineUser(): {
    id?: string;
    email?: string;
    username?: string;
};
export declare function pipelineCustom(): Record<string, unknown>;
