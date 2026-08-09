#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { appendFileSync } from 'fs'
import { resolve } from 'path'
import { applyGitHubEnv } from './github-env'

function getInput(name: string): string | undefined {
  const key = name.toUpperCase().replace(/ /g, '_')
  return process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, '_')}`] ?? undefined
}

function saveState(name: string, value: string): void {
  const file = process.env.GITHUB_STATE
  if (!file) {
    return
  }
  appendFileSync(file, `${name}=${value}\n`)
}

function buildEnv(apmServer?: string, apmToken?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  applyGitHubEnv(env)
  env.APM_CI_PLATFORM = 'github-action'
  if (apmServer) {
    env.ELASTIC_APM_SERVER_URL = apmServer
  }
  if (apmToken) {
    env.ELASTIC_APM_SECRET_TOKEN = apmToken
  }
  return env
}

function runCli(args: string[], env: NodeJS.ProcessEnv, capture = false): { status: number | null; stdout: string } {
  const cli = resolve(__dirname, 'cli.js')
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    env,
  })
  if (result.error) {
    console.error(`ci-apm-trace github wrapper failed: ${result.error.message}`)
    process.exit(1)
  }
  return { status: result.status, stdout: result.stdout ? result.stdout.toString() : '' }
}

function parseExports(stdout: string): Record<string, string> {
  const state: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const match = line.match(/^export (APM_\w+)=(.+)$/)
    if (match) {
      state[match[1]] = match[2]
    }
  }
  return state
}

function main(): void {
  const traceName = getInput('trace-name') || 'github-action'
  const fail = (getInput('fail') || 'false').toLowerCase() === 'true'
  const debug = (getInput('debug') || 'false').toLowerCase() === 'true'
  const apmServer = getInput('apm-server')
  const apmToken = getInput('apm-token')

  const env = buildEnv(apmServer, apmToken)

  const preArgs = ['pre', '--trace-name', traceName]
  if (debug) {
    preArgs.push('--debug')
  }
  const pre = runCli(preArgs, env, true)
  if (pre.status !== 0) {
    process.exit(pre.status ?? 1)
  }

  const state = parseExports(pre.stdout)
  for (const [key, value] of Object.entries(state)) {
    saveState(key, value)
    env[key] = value
  }
  saveState('APM_FAILED', fail ? 'true' : 'false')

  const mainArgs = ['main', '--trace-name', traceName]
  if (debug) {
    mainArgs.push('--debug')
  }
  const run = runCli(mainArgs, env)
  if (run.status !== 0) {
    process.exit(run.status ?? 1)
  }

  if (fail) {
    process.exitCode = 1
  }
}

main()
