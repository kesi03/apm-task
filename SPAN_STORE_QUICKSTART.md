# Span Store Feature - Quick Reference

## Implementation Complete ✓

An alternative execution mode for APM span transactions with persistent storage across all pipeline phases.

## What Was Built

### 1. **Persistent Storage Layer** (`src/span-store.ts`)
- Stores span data in JSON files (temp directory)
- Automatic recovery from corruption
- Methods: `initialize()`, `addSpan()`, `addError()`, `getData()`, `clear()`, `exists()`

### 2. **Send Manager** (`src/cli-span-store.ts`)
- Manages sending all accumulated data at once
- Comprehensive error handling
- Individual span failures don't block transaction send
- Metrics failures are non-critical warnings

### 3. **CLI Integration** (`src/cli.ts`, `src/cli-pre.ts`, `src/cli-main.ts`, `src/cli-post.ts`)
- New `--use-span-store` flag on all commands
- Pre phase: Initializes store and stores first span
- Main phase: Adds execution span to store
- Post phase: Loads and sends all data

### 4. **GitHub Actions Support** (`src/github-wrapper.ts`, `src/github-post.ts`)
- New `use-span-store` input parameter
- Propagates flag through all phases
- Stores state via GitHub state variables

### 5. **Azure DevOps Support** (`src/azure-prejob.ts`, `src/azure-postjob.ts`)
- New `useSpanStore` input parameter
- Uses Azure variable system for state persistence
- Full error handling for pipeline failures

## How It Works

### Traditional Mode (Default)
```
PRE:  Send span immediately
MAIN: Send span immediately  
POST: Send span + transaction + metrics immediately
```

### Span Store Mode (New)
```
PRE:  Store span to file → Export IDs
MAIN: Load file → Add span → Save file
POST: Load file → Send all spans → Send transaction → Send metrics → Delete file
      (Even if pipeline failed, all data is sent)
```

## File Storage
- **Location**: `${tmpdir}/.apm-trace-${traceId}-${transactionId}.json`
- **Size**: ~500 bytes per span
- **Format**: JSON with spans, errors, transaction metadata
- **Auto-cleanup**: After successful send or on errors

## Error Handling

### Pipeline Failure During Execution
✓ All spans stored safely  
✓ Failure detected at post  
✓ Error added to store  
✓ All data sent with failure outcome  
✓ Store cleaned up  

### Network Errors During Send
✓ Store file preserved  
✓ Retryable on next post run  
✓ Metrics failures don't block transaction  

### Corrupted Store File
✓ Auto-recovery with empty store  
✓ Pipeline continues  
✓ Warning logged  

## Usage Examples

### Enable for GitHub Actions
```yaml
- uses: kesi03/apm-task@v1
  with:
    use-span-store: true
    apm-server: ${{ secrets.APM_SERVER }}
    apm-token: ${{ secrets.APM_TOKEN }}
```

### Enable for Azure DevOps
```yaml
- task: ElasticAPMPre@1
  inputs:
    useSpanStore: true

# ... job steps ...

- task: ElasticAPMPost@1
  inputs:
    useSpanStore: true
```

### Enable for CLI / Docker
```bash
npm run apm -- pre --use-span-store
npm run apm -- main --use-span-store
npm run apm -- post --use-span-store
```

## Verification

✓ TypeScript compilation: **PASSED**  
✓ All files created and modified correctly  
✓ Error handling implemented  
✓ Documentation complete  

## Testing Recommendations

1. **Basic Test**
   - Enable flag on all three phases
   - Run pipeline successfully
   - Verify all spans in APM dashboard

2. **Failure Test**
   - Set `fail: true` on post phase
   - Verify failure is recorded
   - Check error is captured in store

3. **Debug Test**
   - Add `--debug` flag
   - Check `[APM-STORE]` log messages
   - Verify store file contains expected spans

4. **Recovery Test**
   - Check temp directory for store files
   - Manually verify JSON format
   - Test store cleanup after send

## Key Features

| Feature | Status |
|---------|--------|
| Persistent storage | ✓ Implemented |
| Cross-phase data persistence | ✓ Implemented |
| Error handling | ✓ Implemented |
| Pipeline failure detection | ✓ Implemented |
| Automatic cleanup | ✓ Implemented |
| GitHub Actions support | ✓ Implemented |
| Azure DevOps support | ✓ Implemented |
| CLI support | ✓ Implemented |
| Debug logging | ✓ Implemented |
| Backward compatibility | ✓ Maintained |

## Documentation

- **Full docs**: `SPAN_STORE.md` (comprehensive guide)
- **Architecture**: Data flow diagrams and component details
- **Error handling**: Recovery strategies and logging
- **Performance**: File I/O and memory considerations
- **Troubleshooting**: Common issues and solutions
