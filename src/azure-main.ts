import * as tl from 'azure-pipelines-task-lib'
import { apm } from './apm'
import { initAzureApm, pipelineTags, randomHex } from './azure-common'

async function run(): Promise<void> {
  initAzureApm()

  const traceId = tl.getVariable('APM_TRACE_ID') || randomHex(16)
  const transactionId = tl.getVariable('APM_TRANSACTION_ID') || randomHex(8)

  await apm.sendSpan({
    traceId,
    spanId: randomHex(8),
    parentId: transactionId,
    name: 'Main Task Execution',
    type: 'task',
    subtype: 'azure-pipelines',
    action: 'execute',
    startMs: Date.now(),
    tags: pipelineTags(),
  })

  tl.setResult(tl.TaskResult.Succeeded, 'Elastic APM: custom span sent')
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM custom span failed: ${message}`)
})
