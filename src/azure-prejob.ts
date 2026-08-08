import * as tl from 'azure-pipelines-task-lib'
import { apm } from './apm'
import { initAzureApm, pipelineTags, randomHex } from './azure-common'

async function run(): Promise<void> {
  initAzureApm()

  const traceId = tl.getVariable('APM_TRACE_ID') || randomHex(16)
  const spanId = randomHex(8)
  const startMs = Date.now()

  tl.setVariable('APM_TRACE_ID', traceId)
  tl.setVariable('APM_SPAN_ID', spanId)
  tl.setVariable('APM_JOB_START_MS', String(startMs))

  await apm.sendSpan({
    traceId,
    transactionId: traceId,
    spanId,
    name: 'Job Start',
    type: 'job',
    startMs,
    tags: pipelineTags(),
  })

  console.log('Elastic APM: job span started')
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM pre-job span failed: ${message}`)
})
