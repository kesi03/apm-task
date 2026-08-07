# ci-apm-trace

Sends CI pipeline traces to **Elastic APM**. The same core lifecycle logic powers four modes:

- **CLI** (Yargs) — run anywhere
- **GitHub Action** wrapper
- **Azure DevOps Task** wrapper
- **Docker** container

Every mode records a pipeline transaction with step spans and CI metadata labels, then ends the trace as success or failure.

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

The APM client reads these environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `ELASTIC_APM_SERVER_URL` | APM Server URL, e.g. `https://apm.example.com` | unset (client inactive) |
| `ELASTIC_APM_SECRET_TOKEN` | APM Server secret token | unset |
| `ELASTIC_APM_API_KEY` | APM Server API key (overrides the secret token) | unset |
| `ELASTIC_APM_SERVICE_NAME` | Service name shown in APM | `ci-apm-trace` |

The service environment is always set to `ci`.

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

To keep the extension private and share it only with specific organizations, pass `--share-with`:

```bash
npx tfx extension publish \
  --manifest-globs vss-extension.json \
  --token "$AZURE_DEVOPS_EXTENSION_PAT" \
  --share-with my-azure-devops-organization
```

Making the extension **public** requires Microsoft marketplace approval after the first publish.

### 4. Install the extension

1. Go to **Organization settings > Extensions** in Azure DevOps.
2. Select **Browse marketplace** (or **Shared with me** for a privately shared extension).
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
