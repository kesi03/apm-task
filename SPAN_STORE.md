# APM Span Store - Alternative Execution Mode

## Overview

The span store feature provides an alternative way to collect and send APM data across pipeline phases. Instead of sending span data immediately during each phase, all span data is accumulated in memory/file and sent together during the post phase.

**Use Cases:**
- Pipelines that fail early and need to ensure all data is sent despite failures
- Scenarios requiring guaranteed data collection even if network issues occur
- Need to aggregate and correlate all spans in one transaction
- Workflows that require custom span data validation before sending

## Architecture

### Components

1. **SpanStore** (`span-store.ts`)
   - Persists span data to a JSON file in the system temp directory
   - File path: `${tmpdir}/.apm-trace-${traceId}-${transactionId}.json`
   - Provides methods to add spans, errors, and retrieve all data
   - Auto-recovers if store file is corrupted or missing
   - Automatic cleanup after successful send

2. **CliSpanStoreManager** (`cli-span-store.ts`)
   - High-level manager for sending accumulated data
   - Handles error recovery and partial sends
   - Logs detailed information about data being sent
   - Ensures transaction is sent even if individual spans fail

### Data Flow

#### Traditional Mode (Default - `--use-span-store=false`)
```
PRE:  Generate IDs → Send Job Start span → Export IDs
MAIN: Get IDs → Send Main Task span
POST: Get IDs → Send Job End span → Send Transaction → Send Metrics
```

#### Span Store Mode (Alternative - `--use-span-store=true`)
```
PRE:  Generate IDs → Store Job Start span → Export IDs
                     Initialize store file
MAIN: Get IDs → Store Main Task span → Store to same file
POST: Get IDs → Load all spans from store → Send all spans → Send Transaction → Send Metrics
                → Cleanup store file
```

## File Storage Format

The span store is saved as JSON with the following structure:

```json
{
  "traceId": "abc123...",
  "transactionId": "def456...",
  "name": "pipeline-name",
  "startMs": 1692892800000,
  "spans": [
    {
      "traceId": "abc123...",
      "spanId": "span001",
      "parentId": "def456...",
      "name": "Job Start",
      "type": "job",
      "subtype": "azure-pipelines",
      "action": "start",
      "startMs": 1692892800000,
      "tags": { "ci.provider": "azure-devops" }
    }
  ],
  "errors": [
    {
      "traceId": "abc123...",
      "transactionId": "def456...",
      "message": "Pipeline failed: Failed",
      "type": "pipeline-failure"
    }
  ],
  "labels": {}
}
```

## Usage

### GitHub Actions

Add the `use-span-store` input to your workflow:

```yaml
- uses: kesi03/apm-task@v1
  with:
    trace-name: 'my-pipeline'
    apm-server: ${{ secrets.APM_SERVER }}
    apm-token: ${{ secrets.APM_TOKEN }}
    use-span-store: true  # Enable span store mode
```

### Azure DevOps Pipeline

Add the `useSpanStore` parameter to both pre and post jobs:

```yaml
jobs:
- job: PreJob
  steps:
  - task: ElasticAPMPre@1
    inputs:
      useSpanStore: true

- job: MainJob
  dependsOn: PreJob
  steps:
  - script: echo "Running tests"

- job: PostJob
  dependsOn: MainJob
  condition: always()
  steps:
  - task: ElasticAPMPost@1
    inputs:
      useSpanStore: true
```

### CLI / Docker / npm

```bash
# Pre phase - store spans instead of sending
npm run apm -- pre --trace-name my-pipeline --use-span-store

# Main phase - add span to store
npm run apm -- main --trace-name my-pipeline --use-span-store

# Post phase - send all spans together
npm run apm -- post --trace-name my-pipeline --use-span-store
```

### Environment Variables

The following environment variables control span store behavior:

- `APM_USE_SPAN_STORE`: Set to `'true'` to enable (auto-set by pre phase)
- `APM_TRACE_ID`: Trace identifier (set by pre phase)
- `APM_TRANSACTION_ID`: Transaction identifier (set by pre phase)
- `APM_JOB_START_MS`: Pipeline start time in milliseconds (set by pre phase)

## Error Handling

### Resilience Features

1. **Span Storage Failures**
   - Spans that fail to store are logged as warnings
   - Pipeline continues execution
   - Post phase attempts to send whatever data is available

2. **Send Failures**
   - Individual span send failures are logged but don't stop processing
   - Transaction send is critical; failure will abort
   - Metrics send failures are logged as warnings and don't cause abort
   - Store file is preserved if send fails (allows retry)

3. **Corrupted Store**
   - Automatically recovers by creating new empty store
   - Logs warning about corruption
   - Continues with fresh data collection

4. **Missing Pre Phase**
   - If store doesn't exist, post phase generates new IDs
   - Logs warning that pre-phase may have failed
   - Still sends collected data

### Pipeline Failure Handling

If the pipeline fails during main phase:

1. All previously stored spans remain intact
2. Post phase detects failure via `JOB_STATUS` variable
3. Failure error is added to store
4. All data is sent with `outcome: 'failure'`
5. Transaction is marked as failed
6. Store is cleaned up after successful send

## Implementation Details

### Span Store Class

```typescript
class SpanStore {
  constructor(traceId: string, transactionId: string, storeDir?: string)
  initialize(name: string, startMs: number, labels?: Record<string, string>): void
  addSpan(span: StoredSpan): void
  addError(error: StoredError): void
  getData(): TransactionStoreData
  clear(): void
  exists(): boolean
}
```

### Manager Class

```typescript
class CliSpanStoreManager {
  constructor(store: SpanStore)
  async sendAllData(
    failed: boolean,
    jobStatus: string,
    traceName: string,
    user?: any,
    custom?: any,
    tags?: Record<string, string>
  ): Promise<void>
}
```

## Performance Considerations

### File I/O
- Store is written to disk on each `addSpan()` call
- File size grows linearly with number of spans
- Typical overhead: ~500 bytes per span
- Recommended: < 1000 spans per transaction

### Memory
- Full store data is loaded into memory during post phase
- Typical memory: ~1-2 MB for 1000 spans
- Store file is deleted after successful send

### Network
- All spans sent in sequence (not parallel)
- Single transaction payload reduces round trips
- Typical request size: 50-100 KB for average pipeline

## Debugging

### Enable Debug Mode

```bash
npm run apm -- pre --trace-name my-pipeline --use-span-store --debug
npm run apm -- post --trace-name my-pipeline --use-span-store --debug
```

### Check Store File

The store file location is: `${tmpdir}/.apm-trace-${traceId}-${transactionId}.json`

On Linux/macOS:
```bash
ls -la /tmp/.apm-trace-*
cat /tmp/.apm-trace-abc123-def456.json | jq .
```

On Windows:
```bash
dir %TEMP%\.apm-trace-*
type %TEMP%\.apm-trace-abc123-def456.json
```

### Logs to Look For

- `[APM-STORE] Initialized span store for {traceId}` - Pre phase started storing
- `[APM-STORE] Added main task span to store` - Main phase added data
- `[APM-STORE] Sending {count} spans and transaction from store` - Post phase sending
- `[APM-STORE] Successfully sent all stored data` - Success
- `[APM-STORE] Failed to send stored data: {error}` - Failure (store file preserved)

## Backward Compatibility

- Default behavior remains unchanged (immediate send)
- Existing pipelines work without modification
- Feature is opt-in via `--use-span-store` flag
- No breaking changes to existing APIs

## Migration Guide

To migrate an existing pipeline to use span store mode:

1. Add `--use-span-store` or `use-span-store: true` to all three phases
2. Test in a non-critical environment first
3. Monitor logs for `[APM-STORE]` messages
4. Verify all spans are collected and sent
5. Check APM dashboard for trace completeness

## Troubleshooting

### Issue: Store file not found in post phase

**Cause**: Pre phase may have failed silently

**Solution**: 
- Check pre phase logs for errors
- Verify `APM_TRACE_ID` and `APM_TRANSACTION_ID` are exported
- Ensure temp directory is writable

### Issue: Some spans not sent

**Cause**: Store file was not persisted, or pre-phase failed

**Solution**:
- Increase debug logging
- Check temp directory permissions
- Ensure main phase is using exported IDs from pre

### Issue: High memory usage in post phase

**Cause**: Too many spans accumulated (>10,000)

**Solution**:
- Consider reducing span granularity
- Use conditional span creation based on environment
- Monitor span count in debug logs

## Future Enhancements

Potential improvements:
- Compress store file to reduce disk usage
- Batch send with automatic retry
- Span deduplication before send
- Configurable store location
- Store cleanup policies (auto-delete old files)
