# CI APM Trace

Sends **CI pipeline traces to [Elastic APM](https://www.elastic.co/apm)** from your Azure Pipelines.

The `CiApmTrace@1` task opens a **Job Start** span before the job (`PreJob` handler), records a **Main Task Execution** span, and closes the **Job End** span afterwards while sending the wrapping pipeline transaction — named from the `traceName` input with the build ID appended — plus **errors** when the job fails and **metrics** (`ci.job.duration.ms`, `ci.job.success`) on every run.

## Also available as

The same client also runs on other platforms without the Azure extension:

- **npm / CLI** — `npm install -g @mockholm/ci-apm-trace` and run `ci-apm-trace` anywhere, including directly in Azure Pipelines with `--ci_platform azure-devops`.
- **Docker** — `docker run mockholm/ci-apm-trace ...` (published image, no build needed).
- **Kubernetes** — a ready-made Job manifest (`k8s.yml`).
- **GitHub Action** — a native `uses:` step for GitHub Actions.
- **go-task** — a `Taskfile` wraps the CLI for local runs and CI orchestration.

See the repository README for details and the ready-made npm/task/docker client pipelines for Azure Pipelines.

## Set up

1. Install the extension into your organization.
2. Create the connection: **Project settings > Pipelines > Service connections > New service connection > Elastic APM**.
   - **APM Server URL** — e.g. `https://apm.example.com:8200`
   - **APM Secret Token** — the token configured on the APM Server (leave blank if unauthenticated)
3. Add the task to a job and select the connection in the `apmConnection` input.

## Quick start

```yaml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - script: npm ci && npm run build

  - task: CiApmTrace@1
    displayName: 'Send pipeline trace to APM'
    inputs:
      apmConnection: 'Elastic APM'
      traceName: 'azure-pipeline'
```

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `apmConnection` | connectedService:apm | — | The Elastic APM service connection (required) |
| `traceName` | string | `azure-devops` | Name of the pipeline trace |
| `fail` | boolean | `false` | Force the trace to end as a failure (for testing) |
| `debug` | boolean | `false` | Show the APM server response body in the build log |

> **Migrating from v1.0.x:** the `apmServer` and `apmToken` inputs were replaced by the `apmConnection` service connection. Update existing pipelines to select the connection instead of passing those inputs.

## Automatically captured metadata

| Label | Source |
| --- | --- |
| `build_id` | `Build.BuildId` |
| `build_number` | `Build.BuildNumber` |
| `branch` | `Build.SourceBranchName` |
| `commit` | `Build.SourceVersion` |
| `repo` | `Build.Repository.Name` |
| `ci_provider` | `azure-devops` |
| `runner_os` | `Agent.OS` |
| `runner_arch` | `Agent.OSArchitecture` |

## Exit / result codes

| Result | Meaning |
| --- | --- |
| Succeeded | Trace ended successfully (exit 0) |
| Succeeded with issues | Trace ended as a failure (`fail: true` or an error occurred) |

## Source & feedback

Built from the open source [`ci-apm-trace`](https://github.com/mockholm/ci-apm-trace) repository. Please report issues and feature requests there.
