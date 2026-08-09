#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { applyGitHubEnv } from './github-env'

function getInput(name: string): string | undefined {
  const key = name.toUpperCase().replace(/ /g, '_')
  return process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, '_')}`] ?? undefined
}

function getState(name: string): string {
  return process.env[`STATE_${name}`] ?? ''
}

function main(): void {
  const traceName = getInput('trace-name') || 'github-action'
  const fail = (getInput('fail') || 'false').toLowerCase() === 'true'
  const debug = (getInput('debug') || 'false').toLowerCase() === 'true'
  const apmServer = getInput('apm-server')
  const apmToken = getInput('apm-token')
  const jobStatus = (getInput('__job-status') || 'success').toLowerCase()

  const env: NodeJS.ProcessEnv = { ...process.env }
  applyGitHubEnv(env)
  env.APM_CI_PLATFORM = 'github-action'

  for (const name of ['APM_TRACE_ID', 'APM_TRANSACTION_ID', 'APM_SPAN_ID', 'APM_JOB_START_MS']) {
    const value = getState(name)
    if (value) {
      env[name] = value
    }
  }

  if (apmServer) {
    env.ELASTIC_APM_SERVER_URL = apmServer
  }
  if (apmToken) {
    env.ELASTIC_APM_SECRET_TOKEN = apmToken
  }

  const failed = fail || jobStatus === 'failure' || jobStatus === 'cancelled' || getState('APM_FAILED') === 'true'
  env.JOB_STATUS = failed ? 'Failed' : 'Succeeded'

  const args = ['post', '--trace-name', traceName]
  if (debug) {
    args.push('--debug')
  }

  const cli = resolve(__dirname, 'cli.js')
  const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env })

  if (result.error) {
    console.error(`ci-apm-trace github post failed: ${result.error.message}`)
    process.exit(1)
  }

  process.exit(result.status ?? 1)
}

main()
