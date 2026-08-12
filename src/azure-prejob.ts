import * as tl from 'azure-pipelines-task-lib'
import { apm } from './apm'
import { initAzureApm, pipelineName, pipelineTags, randomHex } from './azure-common'
import { SpanStore } from './span-store'

async function run(): Promise<void> {
  initAzureApm()

  const useSpanStore = (tl.getInput('useSpanStore', false) || 'false').toLowerCase() === 'true'
  const traceId = tl.getVariable('APM_TRACE_ID') || randomHex(16)
  const transactionId = randomHex(8)
  const spanId = randomHex(8)
  const startMs = Date.now()

  tl.setVariable('APM_TRACE_ID', traceId)
  tl.setVariable('APM_TRANSACTION_ID', transactionId)
  tl.setVariable('APM_SPAN_ID', spanId)
  tl.setVariable('APM_JOB_START_MS', String(startMs))
  tl.setVariable('APM_USE_SPAN_STORE', useSpanStore ? 'true' : 'false')

  if (useSpanStore) {
    // Alternative mode: store span data instead of sending immediately
    const store = new SpanStore(traceId, transactionId)
    store.initialize('azure-devops', startMs)
    store.addSpan({
      traceId,
      spanId,
      parentId: transactionId,
      name: 'Job Start',
      type: 'job',
      subtype: 'azure-pipelines',
      action: 'start',
      startMs,
      tags: pipelineTags(),
    })
    console.log(`[APM-STORE] Initialized span store for ${traceId}`)
  } else {
    // Original mode: send immediately
    await apm.sendSpan({
      traceId,
      spanId,
      parentId: transactionId,
      name: 'Job Start',
      type: 'job',
      subtype: 'azure-pipelines',
      action: 'start',
      startMs,
      tags: pipelineTags(),
    })

    await apm.sendLog({
      message: `${pipelineName()} pipeline has started`,
      level: 'info',
      logger: 'ci-apm-trace',
      traceId,
      transactionId,
    })
  }

  console.log('Elastic APM: job span started')
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM pre-job span failed: ${message}`)
})
