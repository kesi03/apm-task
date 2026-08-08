import * as tl from 'azure-pipelines-task-lib'
import { apm } from './apm'
import { initAzureApm, pipelineTags, randomHex } from './azure-common'

async function run(): Promise<void> {
  initAzureApm()

  const traceName = tl.getInput('traceName', false) || 'azure-devops'
  const fail = tl.getBoolInput('fail', false)
  const jobStatus = tl.getVariable('Agent.JobStatus') || 'Succeeded'
  const failed = fail || jobStatus === 'Failed' || jobStatus === 'Canceled'

  const traceId = tl.getVariable('APM_TRACE_ID') || randomHex(16)
  const transactionId = tl.getVariable('APM_TRANSACTION_ID') || randomHex(8)
  const spanId = tl.getVariable('APM_SPAN_ID') || randomHex(8)
  const startMsRaw = tl.getVariable('APM_JOB_START_MS')
  const startMs = startMsRaw ? Number(startMsRaw) : Date.now()
  const durationMs = startMsRaw ? Math.max(0, Date.now() - startMs) : 0
  const tags = pipelineTags()
  const buildNumber = tl.getVariable('Build.BuildNumber')
  const transactionName = buildNumber ? `${traceName}-${buildNumber}` : traceName

  await apm.sendSpan({
    traceId,
    spanId,
    parentId: transactionId,
    name: 'Job End',
    type: 'job',
    startMs,
    durationMs,
    outcome: failed ? 'failure' : 'success',
    tags,
  })

  await apm.sendTransaction({
    id: transactionId,
    traceId,
    name: transactionName,
    type: 'pipeline',
    startMs,
    durationMs,
    result: failed ? 'failure' : 'success',
    outcome: failed ? 'failure' : 'success',
    spanCount: 3,
    tags,
  })

  if (failed) {
    await apm.sendError({
      traceId,
      transactionId: traceId,
      message: `Pipeline failed: ${jobStatus}`,
      type: 'pipeline-failure',
      tags,
    })
  }

  await apm.sendMetric({
    timestampMs: Date.now(),
    samples: {
      'ci.job.duration.ms': durationMs,
      'ci.job.success': failed ? 0 : 1,
    },
    tags,
  })

  if (failed) {
    tl.setResult(tl.TaskResult.SucceededWithIssues, 'Elastic APM: pipeline failure recorded')
  } else {
    tl.setResult(tl.TaskResult.Succeeded, 'Elastic APM: trace sent')
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  tl.setResult(tl.TaskResult.SucceededWithIssues, `Elastic APM trace failed: ${message}`)
})
