import * as tl from 'azure-pipelines-task-lib'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

function addArg(args: string[], flag: string, value?: string): void {
  if (value) {
    args.push(flag, value)
  }
}

function main(): void {
  try {
    const traceName = tl.getInput('traceName', false) || 'azure-devops'
    const fail = tl.getBoolInput('fail', false)
    const debug = tl.getBoolInput('debug', false)
    const apmServer = tl.getInput('apmServer', false)
    const apmToken = tl.getInput('apmToken', false)

    const args: string[] = ['--trace-name', traceName]
    addArg(args, '--build-id', tl.getVariable('Build.BuildId'))
    addArg(args, '--build-number', tl.getVariable('Build.BuildNumber'))
    addArg(args, '--branch', tl.getVariable('Build.SourceBranchName'))
    addArg(args, '--commit', tl.getVariable('Build.SourceVersion'))
    addArg(args, '--repo', tl.getVariable('Build.Repository.Name'))
    addArg(args, '--ci-provider', 'azure-devops')
    if (fail) {
      args.push('--fail')
    }
    if (debug) {
      args.push('--debug')
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      RUNNER_OS: tl.getVariable('Agent.OS') ?? process.env.RUNNER_OS ?? '',
      RUNNER_ARCH: tl.getVariable('Agent.OSArchitecture') ?? process.env.RUNNER_ARCH ?? '',
    }
    if (apmServer) {
      env.ELASTIC_APM_SERVER_URL = apmServer
    }
    if (apmToken) {
      env.ELASTIC_APM_SECRET_TOKEN = apmToken
    }

    const cli = resolve(__dirname, 'cli.js')
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env })

    if (result.error) {
      tl.setResult(tl.TaskResult.Failed, `CI APM trace failed: ${result.error.message}`)
      return
    }

    if (result.status === 0) {
      tl.setResult(tl.TaskResult.Succeeded, 'CI APM trace completed')
    } else {
      tl.setResult(tl.TaskResult.Failed, `CI APM trace failed with exit code ${result.status}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    tl.setResult(tl.TaskResult.Failed, `CI APM trace failed: ${message}`)
  }
}

main()
