# ci-apm-trace

Sends CI pipeline traces to **Elastic APM**. The same core lifecycle logic powers four modes:

- **CLI** (Yargs) — run anywhere
- **GitHub Action** wrapper
- **Azure DevOps Task** wrapper
- **Docker** container

Every mode records a pipeline transaction with step spans and CI metadata labels, then ends the trace as success or failure.

## How it works

1. The CLI initializes the Elastic APM agent from environment variables.
2. A pipeline transaction is started with the name `--trace-name` (the build ID is appended when provided, e.g. `release-42`).
3. Each `addStep()` records a span under the pipeline transaction.
4. The trace ends as `success` or `failure` (with the error captured) and is flushed to APM Server.

The following labels are set on every trace when the corresponding value is available:

| Label | CLI option | Source |
| --- | --- | --- |
| `build_id` | `--build-id` | CLI / CI variable |
| `build_number` | `--build-number` | CLI / CI variable |
| `branch` | `--branch` | CLI / CI variable |
| `commit` | `--commit` | CLI / CI variable |
| `repo` | `--repo` | CLI / CI variable |
| `ci_provider` | `--ci-provider` | CLI / CI variable |
| `runner_os` | — | `RUNNER_OS` env var |
| `runner_arch` | — | `RUNNER_ARCH` env var |

## Requirements

- Node.js 18+ (20 recommended)
- An Elastic APM Server endpoint

## Installation & build

```bash
npm install
npm run build
```

The compiled output lands in `dist/`.

## Configuration

The APM agent reads these environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `ELASTIC_APM_SERVER_URL` | APM Server URL, e.g. `https://apm.example.com` | unset (agent inactive) |
| `ELASTIC_APM_SECRET_TOKEN` | APM Server secret token | unset |
| `ELASTIC_APM_SERVICE_NAME` | Service name shown in APM | `ci-apm-trace` |

The agent environment is always set to `ci`.

## CLI usage

```
Usage: ci-apm-trace [options]

Options:
  --trace-name      Name of the pipeline trace           [string] [default: "ci-pipeline"]
  --build-id        CI build/pipeline ID                 [string]
  --build-number    CI build number                      [string]
  --branch          Git branch                           [string]
  --commit          Git commit SHA                       [string]
  --repo            Repository name                      [string]
  --ci-provider     CI provider name                     [string]
  --fail            Simulate a pipeline failure          [boolean] [default: false]
```

Success (exit code 0):

```bash
ELASTIC_APM_SERVER_URL=https://apm.example.com \
ELASTIC_APM_SECRET_TOKEN=my-token \
ci-apm-trace \
  --trace-name release \
  --build-id 42 \
  --build-number 7 \
  --branch main \
  --commit abc123 \
  --repo acme/my-repo \
  --ci-provider cli
```

Failure (exit code 1, error captured in APM):

```bash
ELASTIC_APM_SERVER_URL=https://apm.example.com \
ci-apm-trace --trace-name release --build-id 42 --fail
```

Run without installing globally:

```bash
node dist/cli.js --trace-name my-pipeline --build-id 1
```

## GitHub Action

`action.yml` defines the inputs `trace-name` (default `github-action`) and `fail` (default `false`). The wrapper reads `GITHUB_RUN_ID`, `GITHUB_RUN_NUMBER`, `GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_REPOSITORY`, `RUNNER_OS`, and `RUNNER_ARCH` automatically.

Example workflow:

```yaml
name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm ci && npm run build

      - name: Send pipeline trace to APM
        uses: your-org/ci-apm-trace@v1
        with:
          trace-name: ci-build
        env:
          ELASTIC_APM_SERVER_URL: ${{ secrets.ELASTIC_APM_SERVER_URL }}
          ELASTIC_APM_SECRET_TOKEN: ${{ secrets.ELASTIC_APM_SECRET_TOKEN }}
```

Force a failure trace for testing:

```yaml
      - name: Simulate failure trace
        uses: your-org/ci-apm-trace@v1
        with:
          trace-name: smoke-test
          fail: 'true'
```

## Azure DevOps

`task.json` defines the inputs `traceName` (default `azure-devops`) and `fail` (default `false`). The wrapper reads `Build.BuildId`, `Build.BuildNumber`, `Build.SourceBranchName`, `Build.SourceVersion`, `Build.Repository.Name`, `Agent.OS`, and `Agent.OSArchitecture` automatically.

Example pipeline:

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
      fail: false
    env:
      ELASTIC_APM_SERVER_URL: $(ELASTIC_APM_SERVER_URL)
      ELASTIC_APM_SECRET_TOKEN: $(ELASTIC_APM_SECRET_TOKEN)
```

Set the `ELASTIC_APM_SERVER_URL` and `ELASTIC_APM_SECRET_TOKEN` as pipeline variables (mark the token as secret). To distribute the task as an extension, publish `task.json` and the compiled `dist/` via `tfx`/`vsce` with a `vss-extension.json` manifest.

## Docker

Build the image:

```bash
docker build -t ci-apm-trace .
```

Run the CLI inside the container:

```bash
docker run --rm \
  -e ELASTIC_APM_SERVER_URL=http://apm:8200 \
  -e ELASTIC_APM_SECRET_TOKEN=xyz \
  ci-apm-trace \
  --trace-name docker \
  --build-id 123 \
  --branch main \
  --commit abc123 \
  --repo my-repo \
  --ci-provider docker
```

Force a failure trace:

```bash
docker run --rm \
  -e ELASTIC_APM_SERVER_URL=http://apm:8200 \
  -e ELASTIC_APM_SECRET_TOKEN=xyz \
  ci-apm-trace --trace-name docker --build-id 123 --fail
```

The container exits with the CLI's exit code (0 on success, 1 on failure).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Trace ended successfully |
| `1` | Trace ended as a failure (`--fail` or an error occurred) |

## Proxy support

The Elastic APM Node.js agent does not honor `HTTP_PROXY`/`HTTPS_PROXY` environment variables. If a proxy is required, configure it at the network layer where the CLI runs (runner/agent/container egress).
