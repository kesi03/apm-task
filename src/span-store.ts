import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface StoredSpan {
  traceId: string
  spanId: string
  parentId: string
  name: string
  type: string
  subtype?: string
  action?: string
  startMs: number
  durationMs?: number
  outcome?: 'success' | 'failure' | 'unknown'
  tags?: Record<string, string>
  stacktrace?: string
}

export interface StoredError {
  traceId: string
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
  custom?: Record<string, unknown>
  tags?: Record<string, string>
}

export interface TransactionStoreData {
  traceId: string
  transactionId: string
  name: string
  startMs: number
  spans: StoredSpan[]
  errors: StoredError[]
  labels?: Record<string, string>
}

export class SpanStore {
  private storePath: string
  private traceId: string
  private transactionId: string

  constructor(traceId: string, transactionId: string, storeDir?: string) {
    this.traceId = traceId
    this.transactionId = transactionId
    const dir = storeDir || tmpdir()
    this.storePath = join(dir, `.apm-trace-${traceId}-${transactionId}.json`)
  }

  /**
   * Initialize the store with transaction data
   */
  initialize(name: string, startMs: number, labels?: Record<string, string>): void {
    const data: TransactionStoreData = {
      traceId: this.traceId,
      transactionId: this.transactionId,
      name,
      startMs,
      spans: [],
      errors: [],
      labels,
    }
    this.write(data)
  }

  /**
   * Add a span to the store
   */
  addSpan(span: StoredSpan): void {
    const data = this.read()
    data.spans.push(span)
    this.write(data)
  }

  /**
   * Add an error to the store
   */
  addError(error: StoredError): void {
    const data = this.read()
    data.errors.push(error)
    this.write(data)
  }

  /**
   * Get all stored data
   */
  getData(): TransactionStoreData {
    return this.read()
  }

  /**
   * Clear the store (cleanup after sending)
   */
  clear(): void {
    try {
      if (existsSync(this.storePath)) {
        unlinkSync(this.storePath)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to clear span store: ${message}`)
    }
  }

  /**
   * Check if store exists
   */
  exists(): boolean {
    return existsSync(this.storePath)
  }

  private read(): TransactionStoreData {
    try {
      if (!existsSync(this.storePath)) {
        return {
          traceId: this.traceId,
          transactionId: this.transactionId,
          name: 'unknown',
          startMs: Date.now(),
          spans: [],
          errors: [],
        }
      }
      const content = readFileSync(this.storePath, 'utf-8')
      return JSON.parse(content) as TransactionStoreData
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to read span store: ${message}`)
      return {
        traceId: this.traceId,
        transactionId: this.transactionId,
        name: 'unknown',
        startMs: Date.now(),
        spans: [],
        errors: [],
      }
    }
  }

  private write(data: TransactionStoreData): void {
    try {
      writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to write span store: ${message}`)
    }
  }
}
