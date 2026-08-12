import { apm } from './apm'
import { initCliApm, pipelineName, pipelineTags, providerName, randomHex } from './cli-common'
import { SpanStore } from './span-store'

export interface CliPreOptions {
  traceName: string
  debug: boolean
  useSpanStore?: boolean
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
  process.env.APM_USE_SPAN_STORE = options.useSpanStore ? 'true' : 'false'

  if (options.useSpanStore) {
    // Alternative mode: store span data instead of sending immediately
    const store = new SpanStore(traceId, transactionId)
    store.initialize(options.traceName, startMs)
    store.addSpan({
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
    console.log(`[APM-STORE] Initialized span store for ${traceId}`)
  } else {
    // Original mode: send immediately
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
  }

  process.stdout.write(`export APM_TRACE_ID=${traceId}\n`)
  process.stdout.write(`export APM_TRANSACTION_ID=${transactionId}\n`)
  process.stdout.write(`export APM_SPAN_ID=${spanId}\n`)
  process.stdout.write(`export APM_JOB_START_MS=${startMs}\n`)
}
