#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { resolve } from 'path'

function getInput(name: string): string | undefined {
  return process.env[`INPUT_${name.toUpperCase()}`] ?? undefined
}

function addArg(args: string[], flag: string, value?: string): void {
  if (value) {
    args.push(flag, value)
  }
}

function main(): void {
  const args: string[] = []

  const traceName = getInput('trace-name') || 'github-action'
  const fail = (getInput('fail') || 'false').toLowerCase() === 'true'
  const debug = (getInput('debug') || 'false').toLowerCase() === 'true'
  const apmServer = getInput('apm-server')
  const apmToken = getInput('apm-token')

  addArg(args, '--trace-name', traceName)
  addArg(args, '--build-id', process.env.GITHUB_RUN_ID)
  addArg(args, '--build-number', process.env.GITHUB_RUN_NUMBER)
  addArg(args, '--branch', process.env.GITHUB_REF_NAME)
  addArg(args, '--commit', process.env.GITHUB_SHA)
  addArg(args, '--repo', process.env.GITHUB_REPOSITORY)
  addArg(args, '--ci-provider', 'github-actions')
  if (fail) {
    args.push('--fail')
  }
  if (debug) {
    args.push('--debug')
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
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
    console.error(`ci-apm-trace github wrapper failed: ${result.error.message}`)
    process.exit(1)
  }

  process.exit(result.status ?? 1)
}

main()
