import { apm } from './apm'
import { initCliApm, pipelineName, pipelineTags, providerName, randomHex } from './cli-common'

export interface CliPreOptions {
  traceName: string
  debug: boolean
}

export async function runPre(options: CliPreOptions): Promise<void> {
  initCliApm({ debug: options.debug })

  const traceId = process.env.APM_TRACE_ID || randomHex(16)
  const transactionId = randomHex(8)
  const spanId = randomHex(8)
  const startMs = Date.now()

  process.env.APM_TRACE_ID = traceId
  process.env.APM_TRANSACTION_ID = transactionId
  process.env.APM_SPAN_ID = spanId
  process.env.APM_JOB_START_MS = String(startMs)

  await apm.sendSpan({
    traceId,
    spanId,
    parentId: transactionId,
    name: 'Job Start',
    type: 'job',
    subtype: providerName(),
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

  process.stdout.write(`export APM_TRACE_ID=${traceId}\n`)
  process.stdout.write(`export APM_TRANSACTION_ID=${transactionId}\n`)
  process.stdout.write(`export APM_SPAN_ID=${spanId}\n`)
  process.stdout.write(`export APM_JOB_START_MS=${startMs}\n`)
}
