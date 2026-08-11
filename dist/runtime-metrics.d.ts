import { ApmAgent } from './apm';
export interface RuntimeMetricsOptions {
    serviceName: string;
    serviceVersion?: string;
    transaction?: {
        name?: string;
        type?: string;
    };
    tags?: Record<string, string>;
}
export declare function sendRuntimeMetrics(agent: ApmAgent, options: RuntimeMetricsOptions): Promise<void>;
