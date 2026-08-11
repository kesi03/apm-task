import { ApmAgent } from './apm';
export declare const ECS_VERSION = "8.11.0";
export interface FilesystemEntry {
    mount_point: string;
    total: number;
    used: number;
    available: number;
    used_pct: number;
}
export interface EcsMetricsRecord {
    '@timestamp': string;
    'ecs.version': string;
    'event.kind': string;
    'event.category': string;
    'event.type': string;
    'metricset.name': string;
    'service.name': string;
    'service.version': string;
    'agent.name': string;
    'host.name': string;
    'host.architecture': string;
    'host.os.name': string;
    'host.os.version': string;
    'system.cpu.cores': number;
    'system.cpu.total.pct': number;
    'system.cpu.user.pct': number;
    'system.cpu.system.pct': number;
    'system.memory.total': number;
    'system.memory.actual.free': number;
    'system.memory.actual.used': number;
    'system.memory.used.pct': number;
    'system.filesystem': FilesystemEntry[];
}
export declare function buildEcsMetricsRecord(serviceName: string, serviceVersion?: string): Promise<EcsMetricsRecord>;
export interface EcsMetricsOptions {
    serviceName: string;
    serviceVersion?: string;
    transaction?: {
        name?: string;
        type?: string;
    };
    tags?: Record<string, string>;
}
export declare function sendEcsMetrics(agent: ApmAgent, options: EcsMetricsOptions): Promise<void>;
