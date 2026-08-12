import * as os from 'os'
import axios from 'axios'
import { randomBytes } from 'crypto'
import pkg from '../package.json'

export interface ApmInitOptions {
  serverUrl?: string
  secretToken?: string
  apiKey?: string
  serviceName?: string
  serviceVersion?: string
  serviceNode?: string
  serviceEnvironment?: string
  agentName?: string
  globalLabels?: Record<string, string | number | boolean>
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

export type EventOutcome = 'success' | 'failure' | 'unknown'

export interface UserContext {
  id?: string
  email?: string
  username?: string
  domain?: string
}

export interface SpanEventOptions {
  traceId: string
  spanId?: string
  parentId: string
  name: string
  type: string
  subtype?: string
  action?: string
  startMs: number
  durationMs?: number
  outcome?: EventOutcome
  stacktrace?: string
  tags?: Record<string, string>
}

export interface TransactionEventOptions {
  id: string
  traceId: string
  name: string
  type: string
  startMs: number
  durationMs: number
  result: string
  outcome: EventOutcome
  spanCount?: number
  parentId?: string
  user?: UserContext
  custom?: Record<string, unknown>
  session?: { id: string; sequence?: number }
  tags?: Record<string, string>
}

export interface ErrorEventOptions {
  traceId?: string
  transactionId?: string
  parentId?: string
  timestampMs?: number
  message: string
  type?: string
  code?: string
  module?: string
  culprit?: string
  handled?: boolean
  stack?: string
  transaction?: { name?: string; type?: string; sampled?: boolean }
  user?: UserContext
  custom?: Record<string, unknown>
  tags?: Record<string, string>
}

export interface MetricSample {
  value: number
  unit?: string
  type?: string
}

export interface MetricEventOptions {
  timestampMs?: number
  name?: string
  samples: Record<string, number | MetricSample>
  transaction?: { name?: string; type?: string }
  tags?: Record<string, string>
}

export interface LogEventOptions {
  message: string
  timestampMs?: number
  level?: string
  logger?: string
  dataset?: string
  traceId?: string
  transactionId?: string
  spanId?: string
}

export interface ApmAgent {
  startTransaction(name: string, type: string): Transaction
  startSpan(name: string, type: string): Span | null
  captureError(error: Error): void
  flush(): Promise<void>
  sendSpan(event: SpanEventOptions): Promise<void>
  sendTransaction(event: TransactionEventOptions): Promise<void>
  sendError(event: ErrorEventOptions): Promise<void>
  sendMetric(event: MetricEventOptions): Promise<void>
  sendLog(event: LogEventOptions): Promise<void>
  // optional convenience methods (partial parity with upstream agent)
  start?(options?: ApmInitOptions): ApmAgent
  destroy?(): void
  isStarted?(): boolean
  setUserContext?(context: UserContext): boolean
  setCustomContext?(context: Record<string, unknown>): boolean
  setLabel?(key: string, value: string | number | boolean): boolean
  addLabels?(labels: Record<string, string | number | boolean>): boolean
  setTransactionName?(name: string): boolean
  setTransactionOutcome?(outcome: EventOutcome): boolean
  setSpanOutcome?(outcome: EventOutcome): boolean
  setGlobalLabel?(key: string, value: string | number | boolean): void
  addErrorFilter?(fn: (obj: unknown) => unknown): void
  addTransactionFilter?(fn: (obj: unknown) => unknown): void
  addSpanFilter?(fn: (obj: unknown) => unknown): void
  addFilter?(fn: (obj: unknown) => unknown): void
  getServiceName?(): string | undefined
  getServiceVersion?(): string | undefined
  getServiceEnvironment?(): string | undefined
  getServiceNodeName?(): string | undefined
}

interface PendingSpan {
  id: string
  name: string
  type: string
  startMs: number
  durationMs: number
  outcome?: EventOutcome
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
  user?: UserContext
  custom?: Record<string, unknown>
}

function randomId(): string {
  return randomBytes(8).toString('hex')
}

function isElasticApiKey(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return false
  }
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8')
    return decoded.includes(':') && !decoded.includes('\uFFFD')
  } catch {
    return false
  }
}

function normalizeServerUrl(value: string): { url: string; corrected: boolean } {
  try {
    const parsed = new URL(value)
    if (/\.ingest\./.test(parsed.hostname) && parsed.hostname.endsWith('.elastic.cloud')) {
      parsed.hostname = parsed.hostname.replace(/\.ingest\./, '.apm.')
      return { url: parsed.toString().replace(/\/+$/, ''), corrected: true }
    }
    return { url: value.replace(/\/+$/, ''), corrected: false }
  } catch {
    return { url: value.replace(/\/+$/, ''), corrected: false }
  }
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
  private readonly serviceVersion: string | undefined
  private readonly serviceNode: string | undefined
  private readonly serviceEnvironment: string
  private readonly agentName: string
  private readonly globalLabels: Record<string, string | number | boolean>
  private readonly ephemeralId: string
  private readonly debug: boolean
  private readonly transactions: PendingTransaction[] = []
  private currentTransaction: PendingTransaction | null = null

  constructor(options: ApmInitOptions = {}) {
    const rawServerUrl = nonEmpty(options.serverUrl ?? process.env.ELASTIC_APM_SERVER_URL)
    let serverUrl: string | undefined
    if (rawServerUrl) {
      const normalized = normalizeServerUrl(rawServerUrl)
      serverUrl = normalized.url
      if (normalized.corrected) {
        console.warn(
          `ci-apm-trace: '${rawServerUrl}' is the Elasticsearch/OTel ingest endpoint, not an APM Server URL; using '${normalized.url}' instead.`
        )
      }
    }
    this.serverUrl = serverUrl
    const secretToken = nonEmpty(options.secretToken ?? process.env.ELASTIC_APM_SECRET_TOKEN)
    const apiKey = nonEmpty(options.apiKey ?? process.env.ELASTIC_APM_API_KEY)
    if (apiKey) {
      this.apiKey = apiKey
    } else if (secretToken && isElasticApiKey(secretToken)) {
      this.apiKey = secretToken
    }
    this.secretToken = this.apiKey ? undefined : secretToken
    this.serviceName = nonEmpty(options.serviceName ?? process.env.ELASTIC_APM_SERVICE_NAME) ?? 'ci-apm-trace'
    this.serviceVersion = nonEmpty(options.serviceVersion ?? process.env.ELASTIC_APM_SERVICE_VERSION)
    this.serviceNode = nonEmpty(options.serviceNode)
    this.serviceEnvironment = nonEmpty(options.serviceEnvironment ?? process.env.ELASTIC_APM_ENVIRONMENT) ?? 'ci'
    this.agentName = nonEmpty(options.agentName) ?? 'nodejs'
    this.globalLabels = options.globalLabels ?? {}
    this.ephemeralId = randomId()
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
    await this.post(this.serialize(pending))
  }

  async sendSpan(event: SpanEventOptions): Promise<void> {
    const span: Record<string, unknown> = {
      id: event.spanId ?? randomId(),
      trace_id: event.traceId,
      parent_id: event.parentId,
      name: event.name,
      type: event.type,
      timestamp: event.startMs * 1000,
      duration: roundMs(event.durationMs ?? 0),
      outcome: event.outcome ?? 'success',
      sample_rate: 1,
    }
    if (event.subtype) {
      span.subtype = event.subtype
    }
    if (event.action) {
      span.action = event.action
    }
    if (event.stacktrace) {
      const frames = parseStack(event.stacktrace)
      if (frames.length > 0) {
        span.stacktrace = frames
      }
    }
    if (event.tags && Object.keys(event.tags).length > 0) {
      span.context = { tags: event.tags }
    }
    await this.post(`${this.metadataLine()}\n${JSON.stringify({ span })}\n`)
  }

  async sendTransaction(event: TransactionEventOptions): Promise<void> {
    const transaction: Record<string, unknown> = {
      id: event.id,
      trace_id: event.traceId,
      name: event.name,
      type: event.type,
      result: event.result,
      outcome: event.outcome,
      timestamp: event.startMs * 1000,
      duration: roundMs(event.durationMs),
      sampled: true,
      sample_rate: 1,
      span_count: { started: event.spanCount ?? 0 },
    }
    if (event.parentId) {
      transaction.parent_id = event.parentId
    }
    if (event.session && (event.session.id || event.session.sequence !== undefined)) {
      transaction.session = this.compact({ ...event.session })
    }
    const context: Record<string, unknown> = {}
    if (event.tags && Object.keys(event.tags).length > 0) {
      context.tags = event.tags
    }
    if (event.user) {
      context.user = this.compact({ ...event.user })
    }
    if (event.custom && Object.keys(event.custom).length > 0) {
      context.custom = this.compact({ ...event.custom })
    }
    if (Object.keys(context).length > 0) {
      transaction.context = context
    }
    await this.post(`${this.metadataLine()}\n${JSON.stringify({ transaction })}\n`)
  }

  async sendError(event: ErrorEventOptions): Promise<void> {
    const exception: Record<string, unknown> = this.compact({
      message: event.message,
      type: event.type ?? 'Error',
      handled: event.handled ?? true,
      code: event.code,
      module: event.module,
    })
    if (event.stack) {
      const frames = parseStack(event.stack)
      if (frames.length > 0) {
        exception.stacktrace = frames
      }
    }
    const error: Record<string, unknown> = {
      id: randomBytes(16).toString('hex'),
      timestamp: (event.timestampMs ?? Date.now()) * 1000,
      exception,
    }
    if (event.traceId) {
      error.trace_id = event.traceId
    }
    if (event.transactionId) {
      error.transaction_id = event.transactionId
    }
    error.parent_id = event.parentId ?? event.transactionId ?? (event.traceId ? event.traceId : undefined)
    if (error.parent_id === undefined) {
      delete error.parent_id
    }
    if (event.culprit) {
      error.culprit = event.culprit
    }
    if (event.transaction) {
      const transaction = this.compact({ ...event.transaction })
      if (Object.keys(transaction).length > 0) {
        error.transaction = transaction
      }
    }
    const context: Record<string, unknown> = {}
    if (event.tags && Object.keys(event.tags).length > 0) {
      context.tags = event.tags
    }
    if (event.user) {
      context.user = this.compact({ ...event.user })
    }
    if (event.custom && Object.keys(event.custom).length > 0) {
      context.custom = this.compact({ ...event.custom })
    }
    if (Object.keys(context).length > 0) {
      error.context = context
    }
    await this.post(`${this.metadataLine()}\n${JSON.stringify({ error })}\n`)
  }

  async sendMetric(event: MetricEventOptions): Promise<void> {
    const samples: Record<string, Record<string, unknown>> = {}
    for (const [name, sample] of Object.entries(event.samples)) {
      samples[name] = typeof sample === 'number' ? { value: sample } : this.compact({ ...sample })
    }
    const metricset: Record<string, unknown> = {
      samples,
      timestamp: (event.timestampMs ?? Date.now()) * 1000,
    }
    if (event.name) {
      metricset.name = event.name
    }
    if (event.transaction) {
      const transaction = this.compact({ ...event.transaction })
      if (Object.keys(transaction).length > 0) {
        metricset.transaction = transaction
      }
    }
    if (event.tags && Object.keys(event.tags).length > 0) {
      metricset.tags = event.tags
    }
    await this.post(`${this.metadataLine()}\n${JSON.stringify({ metricset })}\n`)
  }

  async sendLog(event: LogEventOptions): Promise<void> {
    const log: Record<string, unknown> = this.compact({
      message: event.message,
      '@timestamp': (event.timestampMs ?? Date.now()) * 1000,
      'trace.id': event.traceId,
      'transaction.id': event.transactionId,
      'span.id': event.spanId,
      'log.level': event.level,
      'log.logger': event.logger,
      'event.dataset': event.dataset,
    })
    await this.post(`${this.metadataLine()}\n${JSON.stringify({ log })}\n`)
  }

  private async post(payload: string): Promise<void> {
    if (!this.serverUrl) {
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
      const response = await axios.post(url, payload, { headers, timeout: 10000 })
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

  private metadataLine(): string {
    const service: Record<string, unknown> = this.compact({
      name: this.serviceName,
      version: this.serviceVersion,
      environment: this.serviceEnvironment,
      node: this.serviceNode ? { configured_name: this.serviceNode } : undefined,
      agent: {
        name: this.agentName,
        version: pkg.version,
        ephemeral_id: this.ephemeralId,
      },
      language: {
        name: 'javascript',
        version: process.versions.node,
      },
      runtime: {
        name: 'node',
        version: process.versions.node,
      },
    })
    const metadata: Record<string, unknown> = this.compact({
      service,
      labels: Object.keys(this.globalLabels).length > 0 ? this.globalLabels : undefined,
      system: {
        architecture: process.arch,
        hostname: os.hostname(),
        platform: process.platform,
      },
      process: {
        pid: process.pid,
        title: process.title,
      },
    })
    return JSON.stringify({ metadata })
  }

  private compact(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        out[key] = value
      }
    }
    return out
  }

  private logServerResponse(status: number | undefined, data: unknown): void {
    if (status === undefined) {
      return
    }
    const body = data !== undefined && data !== '' ? `: ${JSON.stringify(data)}` : ' (no response body)'
    console.log(`ci-apm-trace: APM server responded with status ${status}${body}`)
  }

  // Filters (kept for parity with upstream agent API; currently stored but not applied)
  private errorFilters: Array<(...args: unknown[]) => unknown> = []
  private transactionFilters: Array<(...args: unknown[]) => unknown> = []
  private spanFilters: Array<(...args: unknown[]) => unknown> = []

  destroy(): void {
    this.transactions.length = 0
    this.currentTransaction = null
  }

  setUserContext(context: UserContext): boolean {
    if (!this.currentTransaction) return false
    this.currentTransaction.user = { ...context }
    return true
  }

  setCustomContext(context: Record<string, unknown>): boolean {
    if (!this.currentTransaction) return false
    this.currentTransaction.custom = { ...context }
    return true
  }

  setTransactionName(name: string): boolean {
    if (!this.currentTransaction) return false
    this.currentTransaction.name = name
    return true
  }

  setTransactionOutcome(outcome: EventOutcome): boolean {
    if (!this.currentTransaction) return false
    this.currentTransaction.result = outcome
    return true
  }

  setSpanOutcome(outcome: EventOutcome): boolean {
    if (!this.currentTransaction) return false
    const last = this.currentTransaction.spans[this.currentTransaction.spans.length - 1]
    if (!last) return false
    last.outcome = outcome
    return true
  }

  setLabel(key: string, value: string | number | boolean): boolean {
    if (!this.currentTransaction) return false
    this.currentTransaction.labels[String(key)] = String(value)
    return true
  }

  addLabels(labels: Record<string, string | number | boolean>): boolean {
    if (!this.currentTransaction) return false
    for (const [k, v] of Object.entries(labels)) {
      this.currentTransaction.labels[k] = String(v)
    }
    return true
  }

  setGlobalLabel(key: string, value: string | number | boolean): void {
    this.globalLabels[key] = value
  }

  addErrorFilter(fn: (obj: unknown) => unknown): void {
    if (typeof fn !== 'function') return
    this.errorFilters.push(fn)
  }

  addTransactionFilter(fn: (obj: unknown) => unknown): void {
    if (typeof fn !== 'function') return
    this.transactionFilters.push(fn)
  }

  addSpanFilter(fn: (obj: unknown) => unknown): void {
    if (typeof fn !== 'function') return
    this.spanFilters.push(fn)
  }

  addFilter(fn: (obj: unknown) => unknown): void {
    this.addErrorFilter(fn)
    this.addTransactionFilter(fn)
    this.addSpanFilter(fn)
  }

  getServiceName(): string | undefined {
    return this.serviceName
  }

  getServiceVersion(): string | undefined {
    return this.serviceVersion
  }

  getServiceEnvironment(): string | undefined {
    return this.serviceEnvironment
  }

  getServiceNodeName(): string | undefined {
    return this.serviceNode
  }

  private serialize(transactions: PendingTransaction[]): string {
    const lines: string[] = [this.metadataLine()]
    for (const t of transactions) {
      for (const span of t.spans) {
        const spanObj: Record<string, unknown> = {
          id: span.id,
          trace_id: t.traceId,
          parent_id: t.id,
          name: span.name,
          type: span.type,
          timestamp: span.startMs * 1000,
          duration: roundMs(span.durationMs),
          outcome: span.outcome ?? 'success',
        }
        lines.push(JSON.stringify({ span: spanObj }))
      }
      for (const err of t.errors) {
        lines.push(
          JSON.stringify({
            error: {
              id: err.id,
              trace_id: t.traceId,
              transaction_id: t.id,
              parent_id: t.id,
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
      const txContext: Record<string, unknown> = {}
      if (Object.keys(t.labels).length > 0) txContext.tags = t.labels
      if (t.user) txContext.user = this.compact({ ...t.user })
      if (t.custom && Object.keys(t.custom).length > 0) txContext.custom = this.compact({ ...t.custom })

      const transactionObj: Record<string, unknown> = {
        id: t.id,
        trace_id: t.traceId,
        name: t.name,
        type: t.type,
        result: t.result,
        outcome: t.result === 'failure' ? 'failure' : t.result === 'success' ? 'success' : 'unknown',
        timestamp: t.startMs * 1000,
        duration: roundMs(t.durationMs),
        sampled: true,
        span_count: { started: t.spans.length },
      }
      if (Object.keys(txContext).length > 0) transactionObj.context = txContext
      lines.push(JSON.stringify({ transaction: transactionObj }))
    }
    return `${lines.join('\n')}\n`
  }
}

let current: ApmAgent = new ApmClient()
let started = false

export function initApm(options: ApmInitOptions = {}): ApmAgent {
  current = new ApmClient(options)
  started = true
  return current
}

export const apm: ApmAgent = {
  startTransaction: (name, type) => current.startTransaction(name, type),
  startSpan: (name, type) => current.startSpan(name, type),
  captureError: (error) => current.captureError(error),
  flush: () => current.flush(),
  sendSpan: (event) => current.sendSpan(event),
  sendTransaction: (event) => current.sendTransaction(event),
  sendError: (event) => current.sendError(event),
  sendMetric: (event) => current.sendMetric(event),
  sendLog: (event) => current.sendLog(event),
  // parity helpers
  start: (options?: ApmInitOptions) => initApm(options),
  destroy: () => {
    if ((current as any).destroy) (current as any).destroy()
    started = false
  },
  isStarted: () => started,
  setUserContext: (ctx: UserContext) => (current as any).setUserContext ? (current as any).setUserContext(ctx) : false,
  setCustomContext: (ctx: Record<string, unknown>) => (current as any).setCustomContext ? (current as any).setCustomContext(ctx) : false,
  setLabel: (k: string, v: string | number | boolean) => (current as any).setLabel ? (current as any).setLabel(k, v) : false,
  addLabels: (labels: Record<string, string | number | boolean>) => (current as any).addLabels ? (current as any).addLabels(labels) : false,
  setTransactionName: (name: string) => (current as any).setTransactionName ? (current as any).setTransactionName(name) : false,
  setTransactionOutcome: (o: EventOutcome) => (current as any).setTransactionOutcome ? (current as any).setTransactionOutcome(o) : false,
  setSpanOutcome: (o: EventOutcome) => (current as any).setSpanOutcome ? (current as any).setSpanOutcome(o) : false,
  setGlobalLabel: (k: string, v: string | number | boolean) => (current as any).setGlobalLabel ? (current as any).setGlobalLabel(k, v) : undefined,
  addErrorFilter: (fn: (obj: unknown) => unknown) => (current as any).addErrorFilter ? (current as any).addErrorFilter(fn) : undefined,
  addTransactionFilter: (fn: (obj: unknown) => unknown) => (current as any).addTransactionFilter ? (current as any).addTransactionFilter(fn) : undefined,
  addSpanFilter: (fn: (obj: unknown) => unknown) => (current as any).addSpanFilter ? (current as any).addSpanFilter(fn) : undefined,
  addFilter: (fn: (obj: unknown) => unknown) => (current as any).addFilter ? (current as any).addFilter(fn) : undefined,
  getServiceName: () => (current as any).getServiceName ? (current as any).getServiceName() : undefined,
  getServiceVersion: () => (current as any).getServiceVersion ? (current as any).getServiceVersion() : undefined,
  getServiceEnvironment: () => (current as any).getServiceEnvironment ? (current as any).getServiceEnvironment() : undefined,
  getServiceNodeName: () => (current as any).getServiceNodeName ? (current as any).getServiceNodeName() : undefined,
}
