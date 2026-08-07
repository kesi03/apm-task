import axios from 'axios'
import { randomBytes } from 'crypto'
import pkg from '../package.json'

export interface ApmInitOptions {
  serverUrl?: string
  secretToken?: string
  apiKey?: string
  serviceName?: string
  debug?: boolean
}

export interface Transaction {
  result: string
  setLabel(name: string, value: string): void
  end(): void
}

export interface Span {
  end(): void
}

export interface ApmAgent {
  startTransaction(name: string, type: string): Transaction
  startSpan(name: string, type: string): Span | null
  captureError(error: Error): void
  flush(): Promise<void>
}

interface PendingSpan {
  id: string
  name: string
  type: string
  startMs: number
  durationMs: number
}

interface PendingError {
  id: string
  timestampUs: number
  message: string
  type: string
  stacktrace?: StackFrame[]
}

interface StackFrame {
  filename: string
  function?: string
  lineno?: number
  colno?: number
}

interface PendingTransaction {
  id: string
  traceId: string
  name: string
  type: string
  startMs: number
  durationMs: number
  result: string
  labels: Record<string, string>
  spans: PendingSpan[]
  errors: PendingError[]
  ended: boolean
}

function randomId(): string {
  return randomBytes(8).toString('hex')
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined
}

function roundMs(ms: number): number {
  return Math.round(ms * 1000) / 1000
}

function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = []
  for (const rawLine of stack.split('\n')) {
    const match = /^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/.exec(rawLine.trim())
    if (!match) {
      continue
    }
    const [, fn, file, lineNo, colNo] = match
    frames.push({
      filename: file,
      ...(fn && fn !== '<anonymous>' ? { function: fn } : {}),
      lineno: parseInt(lineNo, 10),
      colno: parseInt(colNo, 10),
    })
  }
  return frames
}

class ApmClient implements ApmAgent {
  private readonly serverUrl: string | undefined
  private readonly secretToken: string | undefined
  private readonly apiKey: string | undefined
  private readonly serviceName: string
  private readonly debug: boolean
  private readonly transactions: PendingTransaction[] = []
  private currentTransaction: PendingTransaction | null = null

  constructor(options: ApmInitOptions = {}) {
    this.serverUrl = nonEmpty(options.serverUrl ?? process.env.ELASTIC_APM_SERVER_URL)
    this.secretToken = nonEmpty(options.secretToken ?? process.env.ELASTIC_APM_SECRET_TOKEN)
    this.apiKey = nonEmpty(options.apiKey ?? process.env.ELASTIC_APM_API_KEY)
    this.serviceName = nonEmpty(options.serviceName ?? process.env.ELASTIC_APM_SERVICE_NAME) ?? 'ci-apm-trace'
    const envDebug = (process.env.ELASTIC_APM_DEBUG ?? '').toLowerCase()
    this.debug = Boolean(options.debug ?? (envDebug === 'true' || envDebug === '1'))
  }

  startTransaction(name: string, type: string): Transaction {
    const transaction: PendingTransaction = {
      id: randomId(),
      traceId: randomId() + randomId(),
      name,
      type,
      startMs: Date.now(),
      durationMs: 0,
      result: 'unknown',
      labels: {},
      spans: [],
      errors: [],
      ended: false,
    }
    this.transactions.push(transaction)
    this.currentTransaction = transaction
    return {
      setLabel(label, value) {
        transaction.labels[label] = value
      },
      end() {
        if (!transaction.ended) {
          transaction.durationMs = Date.now() - transaction.startMs
          transaction.ended = true
        }
      },
      get result() {
        return transaction.result
      },
      set result(value: string) {
        transaction.result = value
      },
    }
  }

  startSpan(name: string, type: string): Span | null {
    if (!this.currentTransaction) {
      return null
    }
    const span: PendingSpan = {
      id: randomId(),
      name,
      type,
      startMs: Date.now(),
      durationMs: 0,
    }
    this.currentTransaction.spans.push(span)
    return {
      end() {
        span.durationMs = Date.now() - span.startMs
      },
    }
  }

  captureError(error: Error): void {
    if (!this.currentTransaction) {
      return
    }
    const frames = error.stack ? parseStack(error.stack) : []
    this.currentTransaction.errors.push({
      id: randomBytes(16).toString('hex'),
      timestampUs: Date.now() * 1000,
      message: error.message,
      type: error.name || 'Error',
      ...(frames.length > 0 ? { stacktrace: frames } : {}),
    })
  }

  async flush(): Promise<void> {
    if (!this.serverUrl) {
      this.transactions.length = 0
      this.currentTransaction = null
      return
    }
    const pending = this.transactions.splice(0, this.transactions.length)
    this.currentTransaction = null
    if (pending.length === 0) {
      return
    }
    const url = `${this.serverUrl.replace(/\/+$/, '')}/intake/v2/events`
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-ndjson',
      'User-Agent': `ci-apm-trace/${pkg.version}`,
    }
    if (this.apiKey) {
      headers['Authorization'] = `ApiKey ${this.apiKey}`
    } else if (this.secretToken) {
      headers['Authorization'] = `Bearer ${this.secretToken}`
    }
    try {
      const response = await axios.post(url, this.serialize(pending), { headers, timeout: 10000 })
      if (this.debug) {
        this.logServerResponse(response.status, response.data)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`ci-apm-trace: failed to send traces to ${this.serverUrl}: ${message}`)
      if (this.debug && axios.isAxiosError(error)) {
        this.logServerResponse(error.response?.status, error.response?.data)
      }
    }
  }

  private logServerResponse(status: number | undefined, data: unknown): void {
    if (status === undefined) {
      return
    }
    const body = data !== undefined && data !== '' ? `: ${JSON.stringify(data)}` : ' (no response body)'
    console.log(`ci-apm-trace: APM server responded with status ${status}${body}`)
  }

  private serialize(transactions: PendingTransaction[]): string {
    const lines: string[] = [
      JSON.stringify({
        metadata: {
          service: {
            name: this.serviceName,
            environment: 'ci',
            agent: {
              name: 'ci-apm-trace',
              version: pkg.version,
            },
          },
        },
      }),
    ]
    for (const t of transactions) {
      for (const span of t.spans) {
        lines.push(
          JSON.stringify({
            span: {
              id: span.id,
              trace_id: t.traceId,
              transaction_id: t.id,
              parent_id: t.id,
              name: span.name,
              type: span.type,
              timestamp: span.startMs * 1000,
              duration: roundMs(span.durationMs),
              outcome: 'success',
            },
          })
        )
      }
      for (const err of t.errors) {
        lines.push(
          JSON.stringify({
            error: {
              id: err.id,
              trace_id: t.traceId,
              transaction_id: t.id,
              timestamp: err.timestampUs,
              exception: {
                message: err.message,
                type: err.type,
                stacktrace: err.stacktrace,
              },
            },
          })
        )
      }
      lines.push(
        JSON.stringify({
          transaction: {
            id: t.id,
            trace_id: t.traceId,
            name: t.name,
            type: t.type,
            result: t.result,
            outcome:
              t.result === 'failure'
                ? 'failure'
                : t.result === 'success'
                  ? 'success'
                  : 'unknown',
            timestamp: t.startMs * 1000,
            duration: roundMs(t.durationMs),
            sampled: true,
            span_count: { started: t.spans.length },
            ...(Object.keys(t.labels).length > 0 ? { context: { tags: t.labels } } : {}),
          },
        })
      )
    }
    return `${lines.join('\n')}\n`
  }
}

let current: ApmAgent = new ApmClient()

export function initApm(options: ApmInitOptions = {}): ApmAgent {
  current = new ApmClient(options)
  return current
}

export const apm: ApmAgent = {
  startTransaction: (name, type) => current.startTransaction(name, type),
  startSpan: (name, type) => current.startSpan(name, type),
  captureError: (error) => current.captureError(error),
  flush: () => current.flush(),
}
