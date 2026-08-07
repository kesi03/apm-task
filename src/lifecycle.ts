import { apm, ApmAgent, Span, Transaction } from './apm'

export interface PipelineLabels {
  buildId?: string
  buildNumber?: string
  branch?: string
  commit?: string
  repo?: string
  ciProvider?: string
  runnerOs?: string
  runnerArch?: string
}

export interface PipelineLifecycle {
  startPipeline(name: string, labels?: PipelineLabels): void
  addStep(name: string): void
  endPipelineSuccess(): Promise<void>
  endPipelineFailure(error: Error): Promise<void>
}

export function createLifecycle(agent: ApmAgent = apm): PipelineLifecycle {
  let transaction: Transaction | null = null
  let currentSpan: Span | null = null

  function endStep(): void {
    if (currentSpan) {
      currentSpan.end()
      currentSpan = null
    }
  }

  function setLabels(labels: PipelineLabels): void {
    if (!transaction) {
      return
    }
    if (labels.buildId) {
      transaction.setLabel('build_id', labels.buildId)
    }
    if (labels.buildNumber) {
      transaction.setLabel('build_number', labels.buildNumber)
    }
    if (labels.branch) {
      transaction.setLabel('branch', labels.branch)
    }
    if (labels.commit) {
      transaction.setLabel('commit', labels.commit)
    }
    if (labels.repo) {
      transaction.setLabel('repo', labels.repo)
    }
    if (labels.ciProvider) {
      transaction.setLabel('ci_provider', labels.ciProvider)
    }
    if (labels.runnerOs) {
      transaction.setLabel('runner_os', labels.runnerOs)
    }
    if (labels.runnerArch) {
      transaction.setLabel('runner_arch', labels.runnerArch)
    }
  }

  return {
    startPipeline(name, labels = {}) {
      endStep()
      const traceName = labels.buildId ? `${name}-${labels.buildId}` : name
      transaction = agent.startTransaction(traceName, 'pipeline')
      setLabels(labels)
    },

    addStep(name) {
      endStep()
      if (transaction) {
        currentSpan = agent.startSpan(name, 'step') ?? null
      }
    },

    async endPipelineSuccess() {
      endStep()
      if (transaction) {
        transaction.result = 'success'
        transaction.end()
      }
      transaction = null
      await agent.flush()
    },

    async endPipelineFailure(error) {
      endStep()
      if (transaction) {
        agent.captureError(error)
        transaction.result = 'failure'
        transaction.end()
      }
      transaction = null
      await agent.flush()
    },
  }
}
