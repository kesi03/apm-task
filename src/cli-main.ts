import { apm } from './apm'
import { initCliApm, pipelineTags, providerName, randomHex } from './cli-common'

export interface CliMainOptions {
  traceName: string
  debug: boolean
}

export async function runMain(options: CliMainOptions): Promise<void> {
  initCliApm({ debug: options.debug })

  const traceId = process.env.APM_TRACE_ID || randomHex(16)
  const transactionId = process.env.APM_TRANSACTION_ID || randomHex(8)

  await apm.sendSpan({
    traceId,
    spanId: randomHex(8),
    parentId: transactionId,
    name: 'Main Task Execution',
    type: 'task',
    subtype: providerName(),
    action: 'execute',
    startMs: Date.now(),
    tags: pipelineTags(),
  })

  await apm.sendLog({
    message: `${options.traceName} task executed`,
    level: 'info',
    logger: 'ci-apm-trace',
    traceId,
    transactionId,
  })
}
