import { ApmAgent } from './apm';
export interface PipelineLabels {
    buildId?: string;
    buildNumber?: string;
    branch?: string;
    commit?: string;
    repo?: string;
    ciProvider?: string;
    runnerOs?: string;
    runnerArch?: string;
}
export interface PipelineLifecycle {
    startPipeline(name: string, labels?: PipelineLabels): void;
    addStep(name: string): void;
    endPipelineSuccess(): Promise<void>;
    endPipelineFailure(error: Error): Promise<void>;
}
export declare function createLifecycle(agent?: ApmAgent): PipelineLifecycle;
