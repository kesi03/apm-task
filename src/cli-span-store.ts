import { SpanStore, TransactionStoreData, StoredSpan, StoredError } from './span-store'
import { apm } from './apm'
import { ApmAgent } from './apm'

/**
 * Helper to manage span storage for CLI phases (pre, main, post)
 */
export class CliSpanStoreManager {
  constructor(private store: SpanStore) {}

  /**
   * Send all stored spans and transaction to APM server
   */
  async sendAllData(
    failed: boolean,
    jobStatus: string,
    traceName: string,
    user?: any,
    custom?: any,
    tags?: Record<string, string>
  ): Promise<void> {
    const data = this.store.getData()

    try {
      // Send all spans first
      for (const span of data.spans) {
        try {
          await apm.sendSpan({
            traceId: span.traceId,
            spanId: span.spanId,
            parentId: span.parentId,
            name: span.name,
            type: span.type,
            subtype: span.subtype,
            action: span.action,
            startMs: span.startMs,
            durationMs: span.durationMs,
            outcome: span.outcome,
            tags: span.tags,
            stacktrace: span.stacktrace,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`Failed to send span "${span.name}": ${message}`)
        }
      }

      // Send all errors
      for (const error of data.errors) {
        try {
          await apm.sendError({
            traceId: error.traceId,
            transactionId: error.transactionId,
            parentId: error.parentId,
            timestampMs: error.timestampMs,
            message: error.message,
            type: error.type,
            code: error.code,
            module: error.module,
            culprit: error.culprit,
            handled: error.handled,
            stack: error.stack,
            transaction: error.transaction,
            custom: error.custom,
            tags: error.tags,
          })
        } catch (sendError) {
          const message = sendError instanceof Error ? sendError.message : String(sendError)
          console.error(`Failed to send error: ${message}`)
        }
      }

      // Send transaction
      const durationMs = Math.max(0, Date.now() - data.startMs)
      try {
        await apm.sendTransaction({
          id: data.transactionId,
          traceId: data.traceId,
          name: data.name,
          type: 'pipeline',
          startMs: data.startMs,
          durationMs,
          result: failed ? 'failure' : 'success',
          outcome: failed ? 'failure' : 'success',
          spanCount: data.spans.length,
          user,
          custom,
          session: { id: data.traceId },
          tags,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`Failed to send transaction: ${message}`)
        throw error // Re-throw as transaction send is critical
      }

      // Cleanup after successful send
      this.store.clear()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error sending stored data: ${message}`)
      // Don't clear on error - let it retry on next post
      throw error
    }
  }
}

/**
 * Create a span store manager for CLI
 */
export function createCliSpanStoreManager(traceId: string, transactionId: string): CliSpanStoreManager {
  const store = new SpanStore(traceId, transactionId)
  return new CliSpanStoreManager(store)
}

/**
 * Get an existing span store (for post phase)
 */
export function getCliSpanStore(traceId: string, transactionId: string): SpanStore {
  return new SpanStore(traceId, transactionId)
}
