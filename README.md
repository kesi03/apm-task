# ci-apm-trace

Sends CI pipeline traces to **Elastic APM**. The same core lifecycle logic powers four modes:

- **CLI** (Yargs) — run anywhere
- **GitHub Action** wrapper
- **Azure DevOps Task** wrapper
- **Docker** container

Every mode records a pipeline transaction with step spans and CI metadata labels, then ends the trace as success or failure. The Azure DevOps task additionally splits each job into `Job Start` / custom / `Job End` spans across its `PreJob`/main/`PostJob` handlers (see the [Azure DevOps](#azure-devops) section), and the CLI mirrors that split with `pre`/`main`/`post` subcommands (see [CLI usage](#cli-usage)).

## How it works

1. The CLI initializes the APM client from environment variables.
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

The CLI reads the following environment variables. All are optional — without
`ELASTIC_APM_SERVER_URL` the client stays inactive and nothing is sent.

### APM Server connection

| Variable | Description | Default |
| --- | --- | --- |
| `ELASTIC_APM_SERVER_URL` | APM Server URL, e.g. `https://apm.example.com` | unset (client inactive) |
| `ELASTIC_APM_SECRET_TOKEN` | APM Server secret token | unset |
| `ELASTIC_APM_API_KEY` | APM Server API key (overrides the secret token) | unset |
| `ELASTIC_APM_SERVICE_NAME` | Service name shown in APM | `cli` |
| `ELASTIC_APM_DEBUG` | Print the APM server response body (`true`/`1`) | `false` |

The service environment is always set to `ci`. The Azure task defaults the
service name to `azure-devops`; the service version defaults to the build
number (`BUILD_NUMBER` / `Build.BuildNumber`).

### Trace state (handed between `pre`, `main`, and `post`)

| Variable | Set by | Read by | Purpose |
| --- | --- | --- | --- |
| `APM_TRACE_ID` | `pre` | `main`, `post` | Trace ID |
| `APM_TRANSACTION_ID` | `pre` | `main`, `post` | Pipeline transaction ID |
| `APM_SPAN_ID` | `pre` | `post` | Job End span ID |
| `APM_JOB_START_MS` | `pre` | `post` | Job start time (epoch ms); `post` derives the duration from it |

### Optional CI metadata

The following variables enrich the trace with labels (`build_id`, `branch`,
`commit`, ...), `ci.*`/`vcs.*` tags, the APM user, and custom fields. The Azure
task sets the `Build.*`/`Agent.*` equivalents automatically; the CLI and GitHub
wrapper read the `GITHUB_*` / `RUNNER_*` / `BUILD_*` variants instead.

| Variable | Used for | Notes / fallback |
| --- | --- | --- |
| `CI_PROVIDER` | `ci_provider` label and span subtype | `cli` |
| `BUILD_DEFINITION_NAME`, `CI_PIPELINE_NAME` | `definition_name`, `ci.pipeline.name`, log messages | `ci-pipeline` |
| `BUILD_ID` | `build_id`, `ci.pipeline.id`, `ci.pipeline.run.id` | — |
| `BUILD_NUMBER` | `build_number`, `ci.pipeline.run.number`, service version | — |
| `BUILD_BRANCH` | `branch`, `ci.build.ref` | — |
| `BUILD_COMMIT` | `commit`, `ci.build.commit`, `vcs.commit.id` | — |
| `BUILD_REPO` | `repo`, `ci.build.repo` | — |
| `BUILD_REPO_URI` | `vcs.repository.url`, custom `repo_uri` | — |
| `BUILD_REF` | `vcs.ref.head.name` | falls back to `BUILD_BRANCH` |
| `BUILD_URL` | `ci.pipeline.run.url`, custom `build_url` | — |
| `BUILD_DEFINITION_ID` | custom `definition_id` | — |
| `JOB_STATUS` | `ci.job.status`, `ci.pipeline.run.result` | `post` treats `Failed`/`Canceled` as a failure; else `Succeeded` |
| `JOB_ID` | `ci.job.id`, custom `job_id` | — |
| `JOB_NAME` | `ci.job.name`, custom `job_name` | — |
| `RUNNER_OS` | `runner_os` | — |
| `RUNNER_ARCH` | `runner_arch` | — |
| `AGENT_NAME`, `RUNNER_NAME` | `ci.pipeline.agent.name`, custom `agent_name`, service node | hostname |
| `AGENT_VERSION` | custom `agent_version` | — |
| `GITHUB_ACTOR`, `BUILD_REQUESTED_FOR` | `ci.pipeline.run.user`, user `username`, custom `requested_for` | — |
| `GITHUB_ACTOR_ID`, `BUILD_REQUESTED_FOR_ID` | user `id` | — |
| `GITHUB_ACTOR_EMAIL`, `BUILD_REQUESTED_FOR_EMAIL` | user `email` | — |

## CLI usage

The CLI is a yargs command client with two modes: a **one-shot** mode for
tracing a single run, and a `pre`/`main`/`post` mode for splitting a trace
across several pipeline steps (the CLI equivalent of the Azure task's
PreJob/main/PostJob handlers).

```
ci-apm-trace [command]

Commands:
  ci-apm-trace pre   Start the trace: generate IDs and emit APM_* environment
                     variables for main/post
  ci-apm-trace main  Record the main task execution span under the running trace
  ci-apm-trace post  End the trace: transaction, error, and metrics for the
                     completed pipeline

Options:
  --trace-name    Name of the pipeline trace   [string] [default: "ci-pipeline"]
  --build-id      CI build/pipeline ID                                  [string]
  --build-number  CI build number                                       [string]
  --branch        Git branch                                            [string]
  --commit        Git commit SHA                                        [string]
  --repo          Repository name                                       [string]
  --ci-provider   CI provider name                                      [string]
  --fail          Simulate a pipeline failure         [boolean] [default: false]
  --debug         Show the APM server response in the output
                                                      [boolean] [default: false]
  --help          Show help                                            [boolean]
```

### One-shot mode

Runs the whole trace (start → step → end) in a single process. Use this when
you only need to trace one pipeline step or a job's main command.

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

### pre/main/post mode

For multi-step pipelines, split the trace across commands. `pre` generates the
trace IDs and prints `export APM_*` lines for the shell to source; `main` and
`post` read them back from the environment:

```bash
# Step 1: start the trace (capture and persist the IDs)
eval "$(node dist/cli.js pre --trace-name release)"

# Step 2: after the pipeline work, record the "Main Task Execution" span
node dist/cli.js main --trace-name release

# Step 3: end the trace (transaction, metrics, and error on failure)
node dist/cli.js post --trace-name release
node dist/cli.js post --trace-name release --fail   # exits 1
```

In CI, persist the four `APM_*` variables produced by `pre` across the steps
(GitHub Actions `$GITHUB_ENV`, Azure pipeline variables, etc.) instead of
`eval`. The `pre`/`main`/`post` subcommands accept `--debug`, and `post`
accepts `--fail`:

| Command | Options |
| --- | --- |
| `pre` | `--trace-name` (default `ci-pipeline`), `--debug` |
| `main` | `--trace-name` (default `ci-pipeline`), `--debug` |
| `post` | `--trace-name` (default `ci-pipeline`), `--fail`, `--debug` |

`post` also honors `JOB_STATUS=Failed|Canceled` to end the trace as a failure
and `BUILD_NUMBER` to append to the transaction name. See
[Trace state](#trace-state-handed-between-pre-main-and-post) for the variables
passed between commands and [Configuration](#configuration) for the connection
and CI metadata variables.

## GitHub Action

`action.yml` defines the inputs `trace-name` (default `github-action`), `fail` (default `false`), `debug` (default `false`), `apm-server`, and `apm-token`. The wrapper reads `GITHUB_RUN_ID`, `GITHUB_RUN_NUMBER`, `GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_REPOSITORY`, `RUNNER_OS`, and `RUNNER_ARCH` automatically. The `apm-server` and `apm-token` inputs override the `ELASTIC_APM_SERVER_URL` / `ELASTIC_APM_SECRET_TOKEN` environment variables.

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
          apm-server: ${{ secrets.ELASTIC_APM_SERVER_URL }}
          apm-token: ${{ secrets.ELASTIC_APM_SECRET_TOKEN }}
```

Force a failure trace for testing:

```yaml
      - name: Simulate failure trace
        uses: your-org/ci-apm-trace@v1
        with:
          trace-name: smoke-test
          fail: 'true'
```

## Publishing the GitHub Action to the Marketplace

GitHub Actions are published to the **GitHub Marketplace** by creating a release from a semver tag on the repository's default branch. There is no separate upload — the Marketplace picks up the `action.yml` at the repo root automatically.

### How the action is packaged

The action is a JavaScript action that runs `dist/github-wrapper.js`, which spawns `dist/cli.js`. Both `dist/` and `node_modules/` are normally gitignored, so a plain tag/release would check out a broken action. To make it self-contained, `npm run bundle:github` compiles `dist/cli.js` into a single `@vercel/ncc` bundle (plus its `modules/` assets) that needs no runtime `node_modules`. The release commit must include that bundled `dist/`.

### Prerequisites

- A **public GitHub repository** with `action.yml` at the root (already has the required `name`, `description`, and `branding`)
- Write access to create tags and releases

### Publish via the workflow (recommended)

1. Go to **Actions > Publish**.
2. Click **Run workflow** and enter the version (`patch`, `minor`, `major`, or e.g. `1.0.0`).
3. The workflow bumps `package.json`, builds and bundles the action, commits `dist/`, creates the `vX.Y.Z`, `vX.Y`, and `vX` tags, pushes, and creates a GitHub release — which publishes the action to the Marketplace. The rolling `v1` / `v1.x` tags keep existing `uses: ...@v1` references working.

### Publish manually

```bash
npm install
npm run build
npm run bundle:github
npm version 1.0.1 --no-git-tag-version
git add -f dist package.json package-lock.json
git commit -m "chore(release): v1.0.1"
git tag v1.0.1
git tag v1.0
git tag v1
git push origin HEAD v1.0.1 v1.0 v1
gh release create v1.0.1 --generate-notes
```

Or via Task:

```bash
task publish:github VERSION=1.0.1
```

### Notes

- The action must be released from the repository's **default branch** to appear in the Marketplace.
- Releases created as a **draft** or **pre-release** are not published to the Marketplace.
- Bump the version for each release; the rolling `v1` tag is what existing pipelines reference.

## Azure DevOps

The Azure DevOps task is an extension (`vss-extension.json`) that ships three pieces:

- **`CiApmTrace@1` task** — a service-connection-backed task with `PreJob`, main, and `PostJob` handlers
- **`apm` service connection type** — a "New service connection" entry named *Elastic APM* that stores the APM Server URL and secret token

### What the task sends

1. **PreJob handler** (`dist/azure-prejob.js`) opens a `Job Start` span, generates a trace ID, and persists `APM_TRACE_ID`, `APM_SPAN_ID`, and `APM_JOB_START_MS` for the rest of the job.
2. **Main handler** (`dist/azure-main.js`) records a `Main Task Execution` span under the same trace.
3. **PostJob handler** (`dist/azure-postjob.js`) closes the `Job End` span, sends the wrapping pipeline **transaction** (named from `traceName`, with the build ID appended), and records an **error** when the job failed and **metrics** (`ci.job.duration.ms`, `ci.job.success`) on every run.

All events are POSTed to `{server}/intake/v2/events` as NDJSON with `Authorization: Bearer <token>`.

The task reads `Build.BuildId`, `Build.BuildNumber`, `Build.SourceBranchName`, `Build.SourceVersion`, `Build.Repository.Name`, `Agent.OS`, and `Agent.OSArchitecture` and attaches them as tags (`build_id`, `build_number`, `branch`, `commit`, `repo`, `ci_provider`, `runner_os`, `runner_arch`).

### 1. Create the service connection

Once the extension is installed, in your project go to **Project settings > Pipelines > Service connections > New service connection** and pick **Elastic APM**:

- **APM Server URL** — e.g. `https://apm.example.com:8200`
- **APM Secret Token** — the token configured on the APM Server (leave blank if unauthenticated)

### 2. Add the task to your pipeline

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
      fail: false
      debug: false
```

Inputs:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `apmConnection` | connectedService:apm | — | The Elastic APM service connection (required) |
| `traceName` | string | `azure-devops` | Name of the pipeline trace |
| `fail` | boolean | `false` | Force the trace to end as a failure (for testing) |
| `debug` | boolean | `false` | Show the APM server response body in the build log |

> **Migrating from v1.0.x:** the `apmServer` and `apmToken` inputs were replaced by the `apmConnection` service connection. Update existing pipelines to select the connection instead of passing those inputs.

## Publishing to the Azure DevOps Marketplace

The task is distributed as an **Azure DevOps extension** (a `.vsix` file). The repository already contains everything needed to package it:

```
vss-extension.json       # extension manifest (edit your publisher id)
CiApmTrace/              # task folder, generated at package time (gitignored)
icons/                   # Marketplace icons (generated via `npm run icons`)
overview.md              # Marketplace details page
scripts/package-azure.js # packaging script
.github/workflows/publish.yml # unified release pipeline (also builds this extension)
```

### Prerequisites

- **Node.js 18+** and `npm install` completed
- A **publisher ID** registered at <https://marketplace.visualstudio.com/manage>
- A **Personal Access Token (PAT)** from `https://dev.azure.com/<org>/_usersSettings/tokens` with the **Marketplace > Manage** scope

### 1. Configure the publisher

Open `vss-extension.json` and replace `your-publisher-id` with your registered publisher ID:

```json
{
  "publisher": "mycompany-myteam",
  ...
}
```

Update the `author` in `task.json` and the repo link in `overview.md` to match.

### 2. Build and package

```bash
npm install
npm run build
npm run icons
npm run package:azure
```

The task folder is assembled with its production dependencies and a `.vsix` is written to `out/`:

```
out/mycompany-myteam.ci-apm-trace-1.0.0.vsix
```

The package script prunes test fixtures from `node_modules` (they contain paths with spaces that are invalid in a `.vsix`) and uses `tfx` to build the archive.

### 3. Publish to the Marketplace

```bash
npx tfx extension publish \
  --manifest-globs vss-extension.json \
  --token "$AZURE_DEVOPS_EXTENSION_PAT" \
  --output-path out
```

To publish without waiting for the Marketplace's validation result (useful in CI), pass `--no-wait-validation` — the workflow already does this.

### 4. Install the extension

1. Go to **Organization settings > Extensions** in Azure DevOps.
2. Select **Browse marketplace**.
3. Find **CI APM Trace**, select **Get it free**, and install it into your organization.
4. The `CiApmTrace@1` task now appears in the **Utility** category of the pipeline task picker.

### 5. Versioning

For every release you must bump **both** versions:

- `version` in `vss-extension.json` (extension version — must be higher than the previously published one)
- `version` in `task.json` (task version — controls which task version pipelines reference)

You can auto-increment the extension patch version when packaging:

```bash
npx tfx extension create --manifest-globs vss-extension.json --rev-version
```

### 6. Automate with GitHub Actions

The `.github/workflows/publish.yml` pipeline handles every release channel in one run: it bumps the version (and syncs `vss-extension.json`/`task.json`), bundles and releases the GitHub Action, publishes to npm, pushes the Docker image, and packages the Azure DevOps extension. To also publish the extension to the Marketplace, dispatch it with `publish_azure` set to `true` and set the `AZURE_DEVOPS_EXTENSION_PAT` secret to your PAT.

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

The CLI honors the standard `HTTP_PROXY`/`HTTPS_PROXY` and `NO_PROXY` environment variables when sending traces to the APM Server:

| Variable | Effect |
| --- | --- |
| `HTTP_PROXY` / `http_proxy` | Proxy used for `http://` APM Server URLs |
| `HTTPS_PROXY` / `https_proxy` | Proxy used for `https://` APM Server URLs (falls back to `HTTP_PROXY`) |
| `NO_PROXY` / `no_proxy` | Comma-separated hosts that bypass the proxy (`*`, `.example.com` subdomains, and `host:port` are supported) |

This routes APM Server traffic through a corporate proxy or egress gateway without extra configuration:

```bash
export HTTPS_PROXY=http://proxy.corp.example:3128
export NO_PROXY=localhost,127.0.0.1,.internal.example
ci-apm-trace --trace-name release --build-id 42
```
