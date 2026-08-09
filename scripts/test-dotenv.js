const assert = require('assert')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { parseEnv } = require('../dist/dotenv')

const parsed = parseEnv(
  [
    'A=1',
    '# a comment',
    '',
    'export B="two words"',
    "C='x y'",
    'D=value # inline comment',
    'E=',
  ].join('\n')
)
assert.strictEqual(parsed.A, '1')
assert.strictEqual(parsed.B, 'two words')
assert.strictEqual(parsed.C, 'x y')
assert.strictEqual(parsed.D, 'value')
assert.strictEqual(parsed.E, '')
assert.strictEqual(Object.keys(parsed).length, 5)

function startServer() {
  return new Promise((resolve) => {
    const seen = []
    const server = http.createServer((req, res) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        seen.push({
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
      })
    })
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, seen, port: server.address().port })
    )
  })
}

function runCli(cwd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.resolve(__dirname, '../dist/cli.js'), ...args],
      { cwd, env: { ...process.env, ...env }, stdio: 'inherit' }
    )
    child.on('exit', (code) => resolve(code))
  })
}

function hit(server, token) {
  return server.seen.some(
    (r) => r.url.includes('/intake/v2/events') && r.headers.authorization === `Bearer ${token}`
  )
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-apm-trace-dotenv-'))
  const dirA = path.join(tmp, 'a')
  const dirB = path.join(tmp, 'b')
  fs.mkdirSync(dirA)
  fs.mkdirSync(dirB)

  const srvA = await startServer()
  const srvB = await startServer()
  const srvC = await startServer()

  fs.writeFileSync(
    path.join(dirA, '.env'),
    `ELASTIC_APM_SERVER_URL=http://127.0.0.1:${srvA.port}\nELASTIC_APM_SECRET_TOKEN=from-dotenv\nBUILD_ID=dotenv-build\n`
  )
  const customEnv = path.join(tmp, 'custom.env')
  fs.writeFileSync(customEnv, `ELASTIC_APM_SERVER_URL=http://127.0.0.1:${srvB.port}\n`)

  const commonArgs = ['--trace-name', 'dotenv-test', '--branch', 'main']

  const exitA = await runCli(dirA, commonArgs, {})
  await new Promise((r) => setTimeout(r, 200))
  const a = exitA === 0 && hit(srvA, 'from-dotenv')

  const exitB = await runCli(dirB, [...commonArgs, '--env-file', customEnv], {})
  await new Promise((r) => setTimeout(r, 200))
  const b = exitB === 0 && srvB.seen.length > 0

  const beforeA = srvA.seen.length
  const exitC = await runCli(dirA, commonArgs, {
    ELASTIC_APM_SERVER_URL: `http://127.0.0.1:${srvC.port}`,
    ELASTIC_APM_SECRET_TOKEN: 'from-env',
  })
  await new Promise((r) => setTimeout(r, 200))
  const c = exitC === 0 && hit(srvC, 'from-env') && srvA.seen.length === beforeA

  console.log('A: exit=' + exitA + ' autoDotenv=' + a)
  console.log('B: exit=' + exitB + ' envFile=' + b)
  console.log('C: exit=' + exitC + ' envPrecedence=' + c)

  srvA.server.close()
  srvB.server.close()
  srvC.server.close()
  fs.rmSync(tmp, { recursive: true, force: true })

  const ok = a && b && c
  process.exit(ok ? 0 : 1)
}

main()
