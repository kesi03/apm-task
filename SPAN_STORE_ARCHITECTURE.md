# Span Store Architecture & Comparison

## Execution Flow Comparison

### Traditional Mode (Default Behavior)
```
┌──────────────────────────────────────────────────────────────────┐
│ Pipeline Execution                                               │
└──────────────────────────────────────────────────────────────────┘

PRE PHASE
┌─────────────────────────────────────┐
│ 1. Generate IDs                     │
│    - traceId, transactionId, spanId │
│ 2. Send "Job Start" span → APM      │ ──► Network Call
│ 3. Export IDs to environment        │
└─────────────────────────────────────┘
         │
         ▼
MAIN PHASE
┌─────────────────────────────────────┐
│ 1. Get IDs from environment         │
│ 2. Execute task/tests               │
│ 3. Send "Main Task" span → APM      │ ──► Network Call
└─────────────────────────────────────┘
         │
         ▼
POST PHASE (Always runs)
┌─────────────────────────────────────┐
│ 1. Get IDs from environment         │
│ 2. Check job status                 │
│ 3. Send "Job End" span → APM        │ ──► Network Call
│ 4. Send Transaction → APM           │ ──► Network Call
│ 5. Send Errors (if failed) → APM    │ ──► Network Call
│ 6. Send Metrics → APM               │ ──► Network Call
└─────────────────────────────────────┘

Issues:
⚠ Multiple network calls (4+)
⚠ If main fails, APM may not get all data
⚠ Network issues mid-pipeline = lost spans
```

### Span Store Mode (Alternative Behavior)
```
┌──────────────────────────────────────────────────────────────────┐
│ Pipeline Execution (with Span Store)                             │
└──────────────────────────────────────────────────────────────────┘

PRE PHASE
┌──────────────────────────────────────┐
│ 1. Generate IDs                      │
│    - traceId, transactionId, spanId  │
│ 2. Initialize store file in /tmp     │ ──► Local Disk I/O
│    .apm-trace-{id}.json              │
│ 3. Store "Job Start" span            │ ──► Local Disk I/O
│ 4. Export IDs to environment         │
└──────────────────────────────────────┘
         │ (IDs + Span stored)
         ▼
MAIN PHASE
┌──────────────────────────────────────┐
│ 1. Get IDs from environment          │
│ 2. Execute task/tests                │
│ 3. Load store file                   │ ──► Local Disk I/O
│ 4. Add "Main Task" span              │ ──► Local Disk I/O
│ 5. Save store file                   │
└──────────────────────────────────────┘
         │ (Spans accumulated)
         ▼
POST PHASE (Always runs)
┌──────────────────────────────────────────┐
│ 1. Get IDs from environment              │
│ 2. Check job status                      │
│ 3. Load store file with all spans        │ ──► Local Disk I/O
│ 4. Add "Job End" span                    │
│ 5. If failed: Add Error to store         │ ──► Local Disk I/O
│ 6. Send ALL spans together → APM         │ ──► Single Network Call
│ 7. Send Transaction → APM                │ ──► Single Network Call
│ 8. Send Metrics → APM                    │ ──► Single Network Call
│ 9. Delete store file                     │ ──► Local Disk I/O
└──────────────────────────────────────────┘

Benefits:
✓ Single consolidated network call for all spans
✓ Failure data preserved even if main phase fails
✓ All data guaranteed to be sent at end
✓ Reduced network round trips
✓ Local storage handles temporary network issues
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI / GitHub / Azure                    │
│              (Orchestrates the three phases)                │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐────────────┐
    │                 │            │
    ▼                 ▼            ▼
┌────────┐        ┌────────┐  ┌─────────┐
│ cli-pre│        │cli-main│  │cli-post │
└────────┘        └────────┘  └─────────┘
    │                 │            │
    │     flag:       │            │
    │  use-span-store │            │
    │                 │            │
    └─────────────┬───┴────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │     SpanStore               │
    │  (Persistent Storage)       │
    │                             │
    │ • File: /tmp/.apm-trace-*   │
    │ • JSON format               │
    │ • Auto-recovery             │
    │ • Auto-cleanup              │
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │  CliSpanStoreManager        │
    │  (Send Orchestrator)        │
    │                             │
    │ • Load spans from store     │
    │ • Send spans (resilient)    │
    │ • Send transaction          │
    │ • Send metrics              │
    │ • Error handling            │
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │    APM Agent / Server       │
    │  (Elastic/DataDog/etc)      │
    │                             │
    │ • Receives all spans        │
    │ • Receives transaction      │
    │ • Receives errors           │
    └─────────────────────────────┘
```

## State Persistence Across Phases

### GitHub Actions (via State)
```
PRE:   Save to GitHub state
       ├─ APM_TRACE_ID
       ├─ APM_TRANSACTION_ID
       ├─ APM_SPAN_ID
       ├─ APM_JOB_START_MS
       └─ APM_USE_SPAN_STORE

       Span stored to file: /tmp/.apm-trace-{traceId}-{txId}.json

MAIN:  Restore from state → Load store file → Add spans → Save file

POST:  Restore from state → Load store file → Send all → Delete file
```

### Azure DevOps (via Pipeline Variables)
```
PRE:   Set Azure variables
       ├─ APM_TRACE_ID
       ├─ APM_TRANSACTION_ID
       ├─ APM_SPAN_ID
       ├─ APM_JOB_START_MS
       └─ APM_USE_SPAN_STORE

       Span stored to file: /tmp/.apm-trace-{traceId}-{txId}.json

MAIN:  Read variables → Load store file → Add spans → Save file

POST:  Read variables → Load store file → Send all → Delete file
```

### CLI / Direct Execution (via Environment)
```
PRE:   Export environment variables
       ├─ export APM_TRACE_ID
       ├─ export APM_TRANSACTION_ID
       ├─ export APM_SPAN_ID
       ├─ export APM_JOB_START_MS
       └─ export APM_USE_SPAN_STORE

       Span stored to file: /tmp/.apm-trace-{traceId}-{txId}.json

MAIN:  Read exported env vars → Load store file → Add spans → Save file

POST:  Read exported env vars → Load store file → Send all → Delete file
```

## Error Handling Flow

```
Span Add Fails
  │
  ├─► Log warning
  ├─► Continue execution
  └─► Data lost (local only)

Send Span Fails
  │
  ├─► Log error
  ├─► Skip that span
  ├─► Continue with next span
  └─► Transaction still sent

Send Transaction Fails
  │
  ├─► Log error
  ├─► Preserve store file
  ├─► Pipeline fails (critical)
  └─► User can retry manually

Send Metrics Fails
  │
  ├─► Log warning
  ├─► Store file cleaned up
  └─► Don't fail pipeline

Store File Corruption
  │
  ├─► Log warning
  ├─► Create new empty store
  └─► Continue with fresh data
```

## Data Flow Timeline

### Successful Execution Timeline

```
Time  Event
────────────────────────────────────────────────────────
T=0ms  [PRE]
       ├─ Generate IDs
       ├─ Create store file: /tmp/.apm-trace-abc-def.json
       ├─ Write: { spans: [JobStart], ... }
       └─ Export: APM_TRACE_ID=abc, ...

T=100ms [MAIN]
        ├─ Load store file
        ├─ Add MainTask span
        ├─ Write: { spans: [JobStart, MainTask], ... }
        └─ Execute tests...

T=5000ms [Tests complete]

T=5100ms [POST]
         ├─ Load store file
         ├─ Add JobEnd span
         ├─ Write: { spans: [JobStart, MainTask, JobEnd], ... }
         ├─ Send span: JobStart → APM ✓
         ├─ Send span: MainTask → APM ✓
         ├─ Send span: JobEnd → APM ✓
         ├─ Send transaction → APM ✓
         ├─ Send metrics → APM ✓
         └─ Delete /tmp/.apm-trace-abc-def.json

T=5200ms Complete ✓
         └─ All data sent, store cleaned up
```

### Failure Scenario Timeline

```
Time  Event
─────────────────────────────────────────────────────
T=0ms  [PRE]
       ├─ Generate IDs
       ├─ Create store file
       └─ Export IDs

T=100ms [MAIN]
        ├─ Load store file
        ├─ Add MainTask span
        └─ Execute tests...

T=500ms [TEST FAILURE] ✗
        └─ Exit code 1

T=600ms [POST] (runs anyway)
        ├─ Load store file
        ├─ Detect failure: JOB_STATUS=Failed
        ├─ Add JobEnd span with outcome:failure
        ├─ Add Error to store
        ├─ Send span: JobStart → APM ✓
        ├─ Send span: MainTask → APM ✓
        ├─ Send span: JobEnd → APM ✓
        ├─ Send transaction (result:failure) → APM ✓
        ├─ Send error → APM ✓
        ├─ Send metrics (success=0) → APM ✓
        └─ Delete /tmp/.apm-trace-abc-def.json

T=700ms Complete
        └─ All data sent including failure info ✓
```

## Key Advantages

| Aspect | Traditional | Span Store |
|--------|------------|-----------|
| Network calls | Multiple (4+) | Consolidated (1 for spans) |
| Data on failure | May lose spans | All spans preserved |
| Network resilience | Moderate | High (local persistence) |
| Multi-phase coordination | Environment vars | File + environment vars |
| Recovery on failure | Manual retry | Automatic (store preserved) |
| Overhead | Network latency | Disk I/O (minimal) |

## Memory & Storage Impact

```
Per Pipeline Run:
├─ Store file: ~500 bytes per span
├─ Example: 10 spans = 5 KB
├─ Example: 100 spans = 50 KB
└─ Cleanup: Auto-deleted after send

Memory During Send:
├─ Load store into memory
├─ Example: 10 spans = ~10 KB
├─ Example: 100 spans = ~100 KB
└─ Released after send

No accumulation: Each pipeline cleans up
```
