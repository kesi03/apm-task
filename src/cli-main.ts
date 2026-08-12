import { apm } from './apm'
import { initCliApm, pipelineTags, providerName, randomHex } from './cli-common'
import { SpanStore } from './span-store'

export interface CliMainOptions {
  traceName: string
  debug: boolean
  useSpanStore?: boolean
}

export async function runMain(options: CliMainOptions): Promise<void> {
  initCliApm({ debug: options.debug })

  const traceId = process.env.APM_TRACE_ID || randomHex(16)
  const transactionId = process.env.APM_TRANSACTION_ID || randomHex(8)
  const useSpanStore = process.env.APM_USE_SPAN_STORE === 'true' || options.useSpanStore

  const mainSpan = {
    traceId,
    spanId: randomHex(8),
    parentId: transactionId,
    name: 'Main Task Execution',
    type: 'task',
    subtype: providerName(),
    action: 'execute',
    startMs: Date.now(),
    tags: pipelineTags(),
  }

  if (useSpanStore) {
    // Alternative mode: store span instead of sending immediately
    const store = new SpanStore(traceId, transactionId)
    store.addSpan(mainSpan)
    console.log(`[APM-STORE] Added main task span to store for ${traceId}`)
  } else {
    // Original mode: send immediately
    await apm.sendSpan(mainSpan)

    await apm.sendLog({
      message: `${options.traceName} task executed`,
      level: 'info',
      logger: 'ci-apm-trace',
      traceId,
      transactionId,
    })
  }
}
