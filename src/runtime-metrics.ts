import { ApmAgent } from './apm'

export interface RuntimeMetricsOptions {
  serviceName: string
  serviceVersion?: string
  transaction?: { name?: string; type?: string }
  tags?: Record<string, string>
}

interface ProcessWithInternalCounters {
  _getActiveHandles?: () => unknown[]
  _getActiveRequests?: () => unknown[]
}

function countActive(source: (() => unknown[]) | undefined): number {
  if (typeof source !== 'function') {
    return 0
  }
  try {
    const items = source.call(process)
    return Array.isArray(items) ? items.length : 0
  } catch {
    return 0
  }
}

function sampleEventLoopDelay(windowMs = 300): Promise<number> {
  return new Promise((resolve) => {
    const baselineMs = 1
    let last = process.hrtime.bigint()
    const samples: number[] = []
    const deadline = Date.now() + windowMs
    const finish = (): void => {
      const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0
      resolve(Math.max(0, avg - baselineMs))
    }
    const timer = setTimeout(finish, windowMs)
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
    const tick = (): void => {
      const now = process.hrtime.bigint()
      const delayMs = Number((now - last) / 1000000n)
      last = now
      samples.push(delayMs)
      if (Date.now() >= deadline) {
        clearTimeout(timer)
        finish()
      } else {
        setImmediate(tick)
      }
    }
    setImmediate(tick)
  })
}

export async function sendRuntimeMetrics(
  agent: ApmAgent,
  options: RuntimeMetricsOptions
): Promise<void> {
  try {
    const memory = process.memoryUsage()
    const internalProcess = process as unknown as ProcessWithInternalCounters
    const eventLoopDelay = await sampleEventLoopDelay()

    await agent.sendMetric({
      name: 'nodejs',
      timestampMs: Date.now(),
      samples: {
        'nodejs.memory.heap.allocated.bytes': memory.heapTotal,
        'nodejs.memory.heap.used.bytes': memory.heapUsed,
        'nodejs.memory.external.bytes': memory.external,
        'nodejs.memory.arrayBuffers.bytes': memory.arrayBuffers ?? 0,
        'nodejs.handles.active': countActive(internalProcess._getActiveHandles),
        'nodejs.requests.active': countActive(internalProcess._getActiveRequests),
        'nodejs.eventloop.delay.avg.ms': eventLoopDelay,
      },
      transaction: options.transaction,
      tags: {
        'metricset.name': 'nodejs',
        ...options.tags,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`ci-apm-trace: failed to collect/send Node.js runtime metrics: ${message}`)
  }
}
