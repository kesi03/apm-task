#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { createLifecycle, PipelineLabels } from './lifecycle'
import { initCliApm } from './cli-common'
import { runPre } from './cli-pre'
import { runMain } from './cli-main'
import { runPost } from './cli-post'

interface CliArgs {
  'trace-name': string
  'build-id'?: string
  'build-number'?: string
  branch?: string
  commit?: string
  repo?: string
  'ci-provider'?: string
  'ci_platform'?: string
  fail: boolean
  debug: boolean
  _: string[]
}

interface SubCommandArgs {
  'trace-name': string
  'ci_platform'?: string
  fail: boolean
  debug: boolean
}

function applyCiPlatform(value: string | undefined): void {
  if (value) {
    process.env.APM_CI_PLATFORM = value
  }
}

function applyEnv(args: CliArgs): void {
  applyCiPlatform(args['ci_platform'])
  if (args['build-id']) {
    process.env.BUILD_ID = args['build-id']
  }
  if (args['build-number']) {
    process.env.BUILD_NUMBER = args['build-number']
  }
  if (args.branch) {
    process.env.BUILD_BRANCH = args.branch
  }
  if (args.commit) {
    process.env.BUILD_COMMIT = args.commit
  }
  if (args.repo) {
    process.env.BUILD_REPO = args.repo
  }
  if (args['ci-provider']) {
    process.env.CI_PROVIDER = args['ci-provider']
  }
}

async function runFlat(args: CliArgs): Promise<void> {
  applyEnv(args)

  initCliApm({ debug: args.debug })

  const lifecycle = createLifecycle()
  const labels: PipelineLabels = {
    buildId: args['build-id'],
    buildNumber: args['build-number'],
    branch: args.branch,
    commit: args.commit,
    repo: args.repo,
    ciProvider: args['ci-provider'],
    runnerOs: process.env.RUNNER_OS,
    runnerArch: process.env.RUNNER_ARCH,
  }

  lifecycle.startPipeline(args['trace-name'], labels)
  lifecycle.addStep('cli-run')

  if (args.fail) {
    process.exitCode = 1
    await lifecycle.endPipelineFailure(new Error('Pipeline failed because --fail was set'))
  } else {
    process.exitCode = 0
    await lifecycle.endPipelineSuccess()
  }
}

async function main(): Promise<void> {
  const parser = yargs(hideBin(process.argv))
    .scriptName('ci-apm-trace')
    .command(
      'pre',
      'Start the trace: generate IDs and emit APM_* environment variables for main/post',
      (y) =>
        y.options({
          'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
          },
          debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
          },
        }),
      async (argv) => {
        const args = argv as unknown as SubCommandArgs
        applyCiPlatform(args['ci_platform'])
        try {
          await runPre({ traceName: args['trace-name'], debug: args.debug })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`ci-apm-trace pre failed: ${message}`)
          process.exitCode = 1
        }
      }
    )
    .command(
      'main',
      'Record the main task execution span under the running trace',
      (y) =>
        y.options({
          'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
          },
          debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
          },
        }),
      async (argv) => {
        const args = argv as unknown as SubCommandArgs
        applyCiPlatform(args['ci_platform'])
        try {
          await runMain({ traceName: args['trace-name'], debug: args.debug })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`ci-apm-trace main failed: ${message}`)
          process.exitCode = 1
        }
      }
    )
    .command(
      'post',
      'End the trace: transaction, error, and metrics for the completed pipeline',
      (y) =>
        y.options({
          'trace-name': {
            type: 'string',
            default: 'ci-pipeline',
            description: 'Name of the pipeline trace',
          },
          fail: {
            type: 'boolean',
            default: false,
            description: 'Simulate a pipeline failure',
          },
          debug: {
            type: 'boolean',
            default: false,
            description: 'Show the APM server response in the output',
          },
        }),
      async (argv) => {
        const args = argv as unknown as SubCommandArgs
        applyCiPlatform(args['ci_platform'])
        try {
          await runPost({ traceName: args['trace-name'], fail: args.fail, debug: args.debug })
          process.exitCode = args.fail ? 1 : 0
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`ci-apm-trace post failed: ${message}`)
          process.exitCode = 1
        }
      }
    )
    .options({
      'trace-name': {
        type: 'string',
        default: 'ci-pipeline',
        description: 'Name of the pipeline trace',
      },
      'build-id': {
        type: 'string',
        description: 'CI build/pipeline ID',
      },
      'build-number': {
        type: 'string',
        description: 'CI build number',
      },
      branch: {
        type: 'string',
        description: 'Git branch',
      },
      commit: {
        type: 'string',
        description: 'Git commit SHA',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      'ci-provider': {
        type: 'string',
        description: 'CI provider name',
      },
      'ci_platform': {
        type: 'string',
        default: process.env.APM_CI_PLATFORM,
        description: 'CI platform profile to use (github-action, azure-devops, team-city, jenkins, docker, k8s, task)',
      },
      fail: {
        type: 'boolean',
        default: false,
        description: 'Simulate a pipeline failure',
      },
      debug: {
        type: 'boolean',
        default: false,
        description: 'Show the APM server response in the output',
      },
    })
    .help()

  const argv = (await parser.parseAsync()) as unknown as CliArgs
  if (argv._.length === 0) {
    await runFlat(argv)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`ci-apm-trace failed: ${message}`)
  process.exit(1)
})
