import { apm } from './apm'
import { sendEcsMetrics } from './ecs-metrics'
import {
  initCliApm,
  pipelineCustom,
  pipelineName,
  pipelineTags,
  pipelineUser,
  providerName,
  randomHex,
  serviceName,
} from './cli-common'

export interface CliPostOptions {
  traceName: string
  fail: boolean
  debug: boolean
}

export async function runPost(options: CliPostOptions): Promise<void> {
  initCliApm({ debug: options.debug })

  const jobStatus = process.env.JOB_STATUS || 'Succeeded'
  const failed = options.fail || jobStatus === 'Failed' || jobStatus === 'Canceled'

  const traceId = process.env.APM_TRACE_ID || randomHex(16)
  const transactionId = process.env.APM_TRANSACTION_ID || randomHex(8)
  const spanId = process.env.APM_SPAN_ID || randomHex(8)
  const startMsRaw = process.env.APM_JOB_START_MS
  const startMs = startMsRaw ? Number(startMsRaw) : Date.now()
  const durationMs = startMsRaw ? Math.max(0, Date.now() - startMs) : 0
  const tags = pipelineTags()
  const buildNumber = process.env.BUILD_NUMBER
  const transactionName = buildNumber ? `${options.traceName}-${buildNumber}` : options.traceName

  await apm.sendSpan({
    traceId,
    spanId,
    parentId: transactionId,
    name: 'Job End',
    type: 'job',
    subtype: providerName(),
    action: 'end',
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
    user: pipelineUser(),
    custom: pipelineCustom(),
    session: { id: traceId },
    tags,
  })

  await apm.sendLog({
    message: failed ? `${pipelineName()} pipeline has failed: ${jobStatus}` : `${pipelineName()} pipeline has ended`,
    level: failed ? 'error' : 'info',
    logger: 'ci-apm-trace',
    dataset: 'ci',
    traceId,
    transactionId,
  })

  if (failed) {
    await apm.sendError({
      traceId,
      transactionId,
      parentId: transactionId,
      message: `Pipeline failed: ${jobStatus}`,
      type: 'pipeline-failure',
      transaction: { name: transactionName, type: 'pipeline', sampled: true },
      user: pipelineUser(),
      custom: pipelineCustom(),
      tags,
    })
  }

  await apm.sendMetric({
    timestampMs: Date.now(),
    samples: {
      'ci.job.duration.ms': { value: durationMs, unit: 'ms' },
      'ci.job.success': { value: failed ? 0 : 1, unit: 'bool' },
    },
    transaction: { name: transactionName, type: 'pipeline' },
    tags,
  })

  await sendEcsMetrics(apm, {
    serviceName: serviceName(),
    serviceVersion: buildNumber,
    transaction: { name: transactionName, type: 'pipeline' },
    tags,
  })
}
