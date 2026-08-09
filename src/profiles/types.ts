export interface PipelineProfile {
  name: string
  applyEnv(env: NodeJS.ProcessEnv): void
  pipelineName(): string
  pipelineTags(): Record<string, string>
  pipelineCustom(): Record<string, unknown>
}
