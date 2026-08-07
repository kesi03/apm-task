# CI APM Trace

Sends **CI pipeline traces to [Elastic APM](https://www.elastic.co/apm)** from your Azure Pipelines.

Every pipeline run records an APM transaction (named from the `traceName` input, with the build ID appended) carrying CI metadata labels, then ends the trace as **success** or **failure** — including the build that runs it.

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
      traceName: 'azure-pipeline'
```

Set the following **secret pipeline variables** so the agent can talk to APM Server:

| Variable | Description |
| --- | --- |
| `ELASTIC_APM_SERVER_URL` | APM Server URL, e.g. `https://apm.example.com` |
| `ELASTIC_APM_SECRET_TOKEN` | APM Server secret token |

The variables are picked up automatically from the environment; no extra wiring is needed beyond marking the token as secret.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `traceName` | string | `azure-devops` | Name of the pipeline trace |
| `fail` | boolean | `false` | Force the trace to end as a failure (for testing) |

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
| Failed | Trace ended as a failure (`fail: true` or an error occurred) |

## Source & feedback

Built from the open source [`ci-apm-trace`](https://github.com/your-org/ci-apm-trace) repository. Please report issues and feature requests there.
