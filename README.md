# ci-apm-trace

Sends **CI pipeline traces to [Elastic APM](https://www.elastic.co/apm)**. The same core lifecycle logic powers every distribution channel:

- **npm package** — [`@mockholm/ci-apm-trace`](https://www.npmjs.com/package/@mockholm/ci-apm-trace). Install it globally and run the `ci-apm-trace` CLI anywhere (any CI or locally).
- **Docker image** — [`mockholm/ci-apm-trace`](https://hub.docker.com/r/mockholm/ci-apm-trace) (Docker Hub, also on GHCR). No build required.
- **GitHub Action** — a native `uses:` step (see [GitHub Action](#github-action)).
- **Azure DevOps Task** — an extension task with `PreJob`/main/`PostJob` handlers (see [Azure DevOps](#azure-devops)).
- **Kubernetes** — run the client as a k8s Job or Pod (see [Kubernetes](#kubernetes)).
- **go-task** — a `Taskfile` wraps the CLI for local runs and CI orchestration (see [Taskfile](#taskfile)).
- **CLI profiles** — pick which CI platform's metadata to capture with `--ci_platform` (see [Running the client](#running-the-client)).

Every mode records a pipeline transaction with step spans and CI metadata labels, then ends the trace as success or failure. The CLI splits each run into `pre` / `main` / `post` subcommands (see [CLI usage](#cli-usage)); the GitHub Action maps those to its main / post phases and the Azure DevOps task to its `PreJob` / main / `PostJob` handlers.

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

- Node.js 18+ (20 recommended) — only needed for the npm/CLI and for building from source. The Docker image and Kubernetes Job bundle Node.js.
- An Elastic APM Server endpoint.

## Installation

Install the CLI globally from npm — no source checkout needed:

```bash
npm install -g @mockholm/ci-apm-trace
```

The `ci-apm-trace` binary is now on your `PATH`:

```bash
ci-apm-trace --version
```

To build from source instead (e.g. to develop or patch the client):

```bash
npm install
npm run build
```

The compiled output lands in `dist/`; `node dist/cli.js` is the same CLI as the installed `ci-apm-trace` binary.

## Configuration

The CLI reads the following environment variables. All are optional — without
`ELASTIC_APM_SERVER_URL` the client stays inactive and nothing is sent.

### APM Server connection

| Variable | Description | Default |
| --- | --- | --- |
| `ELASTIC_APM_SERVER_URL` | APM Server URL, e.g. `https://apm.example.com` | unset (client inactive) |
| `ELASTIC_APM_SECRET_TOKEN` | APM Server secret token | unset |
| `ELASTIC_APM_API_KEY` | APM Server API key (overrides the secret token) | unset |
| `ELASTIC_APM_SERVICE_NAME` | Service name shown in APM | selected profile name (e.g. `npm`) |
| `ELASTIC_APM_DEBUG` | Print the APM server response body (`true`/`1`) | `false` |

The service environment is always set to `ci`. The default service name is the selected profile's name (`npm`, `github-action`, `azure-devops`, `team-city`, `jenkins`, `docker`, `k8s`, or `task`) unless `ELASTIC_APM_SERVICE_NAME` is set; the service version defaults to the build number (`BUILD_NUMBER` / `Build.BuildNumber`) and the service node to `AGENT_NAME` / `RUNNER_NAME` (or the hostname).

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
| `CI_PROVIDER` | `ci_provider` label and span subtype | selected profile name (see [Running the client](#running-the-client)) |
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
  --version       Show version number                                  [boolean]
  --trace-name    Name of the pipeline trace   [string] [default: "ci-pipeline"]
  --build-id      CI build/pipeline ID                                  [string]
  --build-number  CI build number                                       [string]
  --branch        Git branch                                            [string]
  --commit        Git commit SHA                                        [string]
  --repo          Repository name                                       [string]
  --ci-provider   CI provider name                                      [string]
  --ci_platform   CI platform profile (npm, github-action, azure-devops,
                  team-city, jenkins, docker, k8s, task)                [string]
  --fail          Simulate a pipeline failure         [boolean] [default: false]
  --debug         Show the APM server response in the output
                                                      [boolean] [default: false]
  --help          Show help                                            [boolean]
```

`--ci_platform` selects which profile captures the CI metadata (see
[Running the client](#running-the-client)). The default profile is `npm`. It can
also be set with the `APM_CI_PLATFORM` environment variable.

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
eval "$(ci-apm-trace pre --trace-name release)"

# Step 2: after the pipeline work, record the "Main Task Execution" span
ci-apm-trace main --trace-name release

# Step 3: end the trace (transaction, metrics, and error on failure)
ci-apm-trace post --trace-name release
ci-apm-trace post --trace-name release --fail   # exits 1
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

## Running the client

The client is a single CLI at its core, so it runs anywhere Node.js, a container
runtime, or a Kubernetes cluster is available. `--ci_platform` (or the
`APM_CI_PLATFORM` environment variable) selects the profile that controls the
default service name and which CI environment variables are captured as labels,
tags, and custom fields:

| Profile | Default `service.name` | Reads from | Typical platforms |
| --- | --- | --- | --- |
| `npm` | `npm` | `npm_*`, `npm_config_*`, and `CI_*` variables | npm scripts, GitLab CI, CircleCI, any npm-capable runner |
| `github-action` | `github-action` | `GITHUB_*`, `RUNNER_*` | GitHub Actions |
| `azure-devops` | `azure-devops` | `Build.*`, `Agent.*`, `SYSTEM_*` | Azure Pipelines |
| `team-city` | `team-city` | `TEAMCITY_*`, `BUILD_*` | TeamCity |
| `jenkins` | `jenkins` | `BUILD_*`, `GIT_*`, `JOB_*` | Jenkins |
| `docker` | `docker` | container ID / hostname | Docker containers |
| `k8s` | `k8s` | pod metadata (downward API) | Kubernetes |
| `task` | `task` | `CI_*`, `BUILD_*` (or `CI_PROVIDER`) | go-task driven pipelines |

Set the profile explicitly when running on a specific platform:

```bash
# GitHub Actions runner
ci-apm-trace pre --ci_platform github-action

# Azure Pipelines agent
ci-apm-trace pre --ci_platform azure-devops

# TeamCity / Jenkins
ci-apm-trace pre --ci_platform team-city
ci-apm-trace pre --ci_platform jenkins

# go-task
task pre PROFILE=task
```

Each platform below links to a dedicated section: [npm/CLI](#cli-usage),
[GitHub Action](#github-action), [Azure DevOps](#azure-devops),
[Docker](#docker), [Kubernetes](#kubernetes), [Taskfile](#taskfile), and the
ready-made [client pipelines](#client-pipelines).

## GitHub Action

The action is a JavaScript action with `main` and `post` sections — the GitHub
equivalent of the Azure task's `PreJob`/main/`PostJob` handlers — and runs the
same CLI with the `github-action` profile (`service.name: github-action`):

1. **Main phase** (`dist/github-wrapper.js`) runs `cli pre` to start the trace
   and persist the trace IDs, then `cli main` to record the `Main Task
   Execution` span.
2. **Post phase** (`dist/github-post.js`) runs automatically when the job
   finishes — even if later steps failed — and runs `cli post` to close the
   `Job End` span, the pipeline transaction, and the metrics. The trace ends as
   a failure whenever any step in the job failed or the job was cancelled.

`action.yml` defines the inputs `trace-name` (default `github-action`), `fail`
(default `false`), `debug` (default `false`), `apm-server`, and `apm-token`,
plus a hidden `__job-status` input (default `${{ job.status }}`) that tells the
post phase the job's final status. The wrapper reads `GITHUB_RUN_ID`,
`GITHUB_RUN_NUMBER`, `GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_REPOSITORY`,
`GITHUB_WORKFLOW`, `GITHUB_JOB`, `GITHUB_ACTOR`, `RUNNER_OS`, and `RUNNER_ARCH`
automatically. The `apm-server` and `apm-token` inputs override the
`ELASTIC_APM_SERVER_URL` / `ELASTIC_APM_SECRET_TOKEN` environment variables.

> Prefer this action for tracing a whole GitHub Actions job. To trace a pipeline
> *without* the wrapper (e.g. from `npm` scripts or the Taskfile), use the CLI's
> `github-action` profile or the [Client via npm workflow](#client-pipelines).

Example workflow (place the action step anywhere in the job — the trace is
ended after all steps run, so it reflects the job's final status):

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
        uses: mockholm/ci-apm-trace@v1
        with:
          trace-name: ci-build
          apm-server: ${{ secrets.ELASTIC_APM_SERVER_URL }}
          apm-token: ${{ secrets.ELASTIC_APM_SECRET_TOKEN }}
```

Force a failure trace for testing:

```yaml
      - name: Simulate failure trace
        uses: mockholm/ci-apm-trace@v1
        with:
          trace-name: smoke-test
          fail: 'true'
```

With `fail: 'true'` the main phase exits with code 1 (failing the step) and the
post phase ends the trace as failed. Any other failing or cancelled step in the
job ends the trace as failed too.

## Publishing

The project ships four distribution channels, all released from the
`.github/workflows/publish.yml` pipeline (one manual dispatch per release):

| Channel | Artifact | Release mechanism |
| --- | --- | --- |
| **npm** | `@mockholm/ci-apm-trace` | `npm publish --access public` (requires the `NPM_TOKEN` secret) |
| **Docker** | `mockholm/ci-apm-trace` on Docker Hub + `ghcr.io/<owner>/ci-apm-trace` | multi-arch build & push (requires `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets) |
| **GitHub Action** | Marketplace listing from the `vX.Y.Z` release | semver tags + GitHub release |
| **Azure DevOps** | `.vsix` extension | packaged, uploaded as an artifact, and optionally published with `publish_azure: true` (requires the `AZURE_DEVOPS_EXTENSION_PAT` secret) |

The workflow bumps `package.json` (and syncs `vss-extension.json`/`task.json`),
creates the `vX.Y.Z`, `vX.Y`, and `vX` tags, and drives each channel job. See
the platform-specific sections below for details.

## Publishing the GitHub Action to the Marketplace

GitHub Actions are published to the **GitHub Marketplace** by creating a release from a semver tag on the repository's default branch. There is no separate upload — the Marketplace picks up the `action.yml` at the repo root automatically.

### How the action is packaged

The action is a JavaScript action that runs `dist/github-wrapper.js` (main phase) and `dist/github-post.js` (post phase), both of which spawn `dist/cli.js`. Both `dist/` and `node_modules/` are normally gitignored, so a plain tag/release would check out a broken action. To make it self-contained, `npm run bundle:github` compiles `dist/cli.js` into a single `@vercel/ncc` bundle (plus its `modules/` assets) that needs no runtime `node_modules`; the two wrapper scripts use only Node.js built-ins. The release commit must include that bundled `dist/`.

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

The task runs the same client core as the CLI's `azure-devops` profile
(`service.name: azure-devops`). If you prefer not to install the extension, the
[`ci-apm-trace` CLI](#cli-usage) can be used directly in Azure Pipelines with
`--ci_platform azure-devops` (see the [client pipelines](#client-pipelines) for
ready-made examples), or use the [`task` extension](#taskfile) steps.

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

The published image [`mockholm/ci-apm-trace`](https://hub.docker.com/r/mockholm/ci-apm-trace) (also available as `ghcr.io/mockholm/ci-apm-trace`) is multi-arch (`linux/amd64`, `linux/arm64`) and needs no build step — pull it and run. It embeds Node.js 20, so no local Node.js install is needed.

One-shot trace:

```bash
docker run --rm \
  -e ELASTIC_APM_SERVER_URL=http://apm:8200 \
  -e ELASTIC_APM_SECRET_TOKEN=xyz \
  mockholm/ci-apm-trace \
  --trace-name docker \
  --build-id 123 \
  --branch main \
  --commit abc123 \
  --repo my-repo \
  --ci_platform docker
```

Force a failure trace:

```bash
docker run --rm \
  -e ELASTIC_APM_SERVER_URL=http://apm:8200 \
  -e ELASTIC_APM_SECRET_TOKEN=xyz \
  mockholm/ci-apm-trace --trace-name docker --build-id 123 --fail
```

Split a trace across several containers with the `pre`/`main`/`post`
subcommands, persisting the `APM_*` variables between runs:

```bash
# pre: print the APM_* hand-off variables
docker run --rm -e ELASTIC_APM_SERVER_URL=http://apm:8200 -e ELASTIC_APM_SECRET_TOKEN=xyz \
  mockholm/ci-apm-trace pre --trace-name docker --ci_platform docker

# main / post: pass APM_TRACE_ID, APM_TRANSACTION_ID, APM_SPAN_ID, APM_JOB_START_MS
docker run --rm -e ELASTIC_APM_SERVER_URL=http://apm:8200 -e ELASTIC_APM_SECRET_TOKEN=xyz \
  -e APM_TRACE_ID=... -e APM_TRANSACTION_ID=... -e APM_SPAN_ID=... -e APM_JOB_START_MS=... \
  mockholm/ci-apm-trace main --trace-name docker --ci_platform docker

docker run --rm -e ELASTIC_APM_SERVER_URL=http://apm:8200 -e ELASTIC_APM_SECRET_TOKEN=xyz \
  -e APM_TRACE_ID=... -e APM_TRANSACTION_ID=... -e APM_SPAN_ID=... -e APM_JOB_START_MS=... \
  mockholm/ci-apm-trace post --trace-name docker --ci_platform docker
```

The container exits with the CLI's exit code (0 on success, 1 on failure).

To build and tag the image locally instead of pulling it:

```bash
docker build -t mockholm/ci-apm-trace .
```

## Kubernetes

Run the client as a Kubernetes **Job** with the `k8s` profile. The pod runs the
full `pre` -> `main` -> `post` lifecycle in one shell, so the trace state is
handed off natively.

1. Create the secret with your APM endpoint (see `k8s.yml` for the exact key
   names):

   ```bash
   kubectl create secret generic apm-secret \
     --from-literal=server-url=https://<deployment-id>.apm.<region>.gcp.elastic.cloud:443 \
     --from-literal=secret-token=<your-secret-or-api-key>
   ```

2. Apply the Job (it uses the published `mockholm/ci-apm-trace` image):

   ```bash
   kubectl apply -f k8s.yml -n default
   ```

3. Watch the output:

   ```bash
   kubectl logs job/ci-apm-trace -n default -f
   ```

4. Delete the Job when done:

   ```bash
   kubectl delete -f k8s.yml -n default
   ```

The `k8s` profile picks up the pod name, namespace, node, and IP from the
downward API env vars set in `k8s.yml`, and labels the trace with
`ci_provider: k8s`. To run a single step instead of the full lifecycle, see the
`cli:k8s` / `pre:k8s` / `main:k8s` / `post:k8s` tasks in the
[Taskfile](#taskfile).

## Taskfile

The repository ships a [`Taskfile.yml`](Taskfile.yml) (go-task) that wraps the
CLI for local runs and CI orchestration. It assumes the `ci-apm-trace` binary is
installed globally (npm) and the container image is the published
`mockholm/ci-apm-trace`.

| Task | What it runs |
| --- | --- |
| `task cli PROFILE=<p>` | one-shot run with the given profile |
| `task pre/main/post PROFILE=<p>` | the split lifecycle, printing `APM_*` hand-off vars from `pre` |
| `task cli:docker`, `pre:docker`, `main:docker`, `post:docker` | the same runs inside the Docker image |
| `task cli:k8s`, `pre:k8s`, `main:k8s`, `post:k8s` | the same runs as Kubernetes Pods |
| `task k8s:apply`, `k8s:logs`, `k8s:delete` | manage the `k8s.yml` Job |
| `task test`, `test:proxy` | smoke tests against the local source build |
| `task docker:build` | build/tag the image locally |
| `task publish:github VERSION=x`, `publish:azure` | release tasks (see [Publishing](#publishing)) |

Example — drive the client with the `task` profile:

```bash
export ELASTIC_APM_SERVER_URL=...
export ELASTIC_APM_SECRET_TOKEN=...
task pre PROFILE=task TRACE_NAME=my-pipeline     # exports APM_*
task main PROFILE=task TRACE_NAME=my-pipeline
task post PROFILE=task TRACE_NAME=my-pipeline
```

The `pre` output is a list of `export APM_*` lines; source them (`eval
"$(task pre ...)"`) or persist them in your CI's environment so `main`/`post`
can pick them up.

## Client pipelines

This repository also contains ready-made pipelines that run the client against a
real APM Server — useful as templates for your own CI.

### GitHub Actions

Three manually-triggered workflows (dispatch **Actions** in the GitHub UI), one
per profile:

| Workflow | Profile | How the client runs |
| --- | --- | --- |
| `.github/workflows/client-npm.yml` | `npm` | `npm install -g @mockholm/ci-apm-trace`, then `ci-apm-trace pre/main/post` |
| `.github/workflows/client-task.yml` | `task` | installs go-task, `npm install -g @mockholm/ci-apm-trace`, then `task pre/main/post PROFILE=task` |
| `.github/workflows/client-docker.yml` | `docker` | `docker run mockholm/ci-apm-trace pre/main/post` |

Each takes the inputs `trace-name` (default `npm`/`task`/`docker`), `fail`
(end the trace as a failure), and `debug`. Configure these in the repository
before running:

- **Variable** `ELASTIC_APM_SERVER_URL` — your APM Server URL
- **Secret** `ELASTIC_APM_SECRET_TOKEN` — your secret token or API key

### Azure Pipelines

Three pipelines in `.azure-pipelines/`, run manually (`trigger: none`):

| Pipeline | Profile | How the client runs |
| --- | --- | --- |
| `.azure-pipelines/npm.yml` | `npm` | `npm install -g @mockholm/ci-apm-trace`, then `ci-apm-trace pre/main/post` |
| `.azure-pipelines/task.yml` | `task` | installs go-task, global npm install, then `task pre/main/post PROFILE=task` |
| `.azure-pipelines/docker.yml` | `docker` | `docker run mockholm/ci-apm-trace pre/main/post` |

Set these pipeline variables (project **Pipelines > Edit > Variables**):

- `ELASTIC_APM_SERVER_URL` (plain)
- `ELASTIC_APM_SECRET_TOKEN` (secret)
- `traceName` (optional, defaults to `npm`/`task`/`docker`)

### How the pipelines hand off state

Each pipeline runs `pre` first, captures the printed `export APM_*` lines, and
persists them (`$GITHUB_ENV` on GitHub, `##vso[task.setvariable]` on Azure) so
`main` and `post` can continue the same trace:

- `pre` — generates the trace/transaction/span IDs and prints the `APM_*` vars
- `main` — records a `Main Task Execution` span under the same trace
- `post` — closes the trace (transaction, error on failure, metrics), using
  `JOB_STATUS`/`fail` to decide success or failure

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
