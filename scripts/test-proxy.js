const http = require('http')
const { spawn } = require('child_process')

const seen = []
const connects = []
const proxy = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    seen.push({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
})
proxy.on('connect', (req, socket) => {
  connects.push(`${req.method} ${req.url}`)
  socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
  socket.destroy()
})

function runCli(env) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['dist/cli.js', '--trace-name', 'proxy-test', '--build-id', '7', '--branch', 'main'],
      { env: { ...process.env, ...env }, stdio: 'inherit' }
    )
    child.on('exit', (code) => resolve(code))
  })
}

proxy.listen(0, '127.0.0.1', async () => {
  const port = proxy.address().port

  const exitA = await runCli({
    ELASTIC_APM_SERVER_URL: 'http://127.0.0.1:9999',
    ELASTIC_APM_SECRET_TOKEN: 'my-secret',
    HTTP_PROXY: `http://127.0.0.1:${port}`,
    NO_PROXY: '',
  })
  await new Promise((r) => setTimeout(r, 200))
  const proxied = seen.shift()
  const proxyHit = !!(proxied && proxied.url.includes('/intake/v2/events'))
  const bodyOk = !!(
    proxied &&
    proxied.body.includes('"transaction"') &&
    proxied.body.includes('"metadata"') &&
    proxied.body.includes('"branch":"main"') &&
    proxied.headers.authorization === 'Bearer my-secret'
  )

  const exitB = await runCli({
    ELASTIC_APM_SERVER_URL: 'http://127.0.0.1:9999',
    HTTP_PROXY: `http://127.0.0.1:${port}`,
    NO_PROXY: '127.0.0.1',
  })
  await new Promise((r) => setTimeout(r, 200))
  const noProxyBypassed = seen.length === 0

  const exitC = await runCli({
    ELASTIC_APM_SERVER_URL: 'https://apm.example.test:8200',
    ELASTIC_APM_SECRET_TOKEN: 'my-secret',
    HTTPS_PROXY: `http://127.0.0.1:${port}`,
    NO_PROXY: '',
  })
  await new Promise((r) => setTimeout(r, 200))
  const connectTunneled = connects.some((c) => c.includes('apm.example.test:8200'))

  console.log('A: exit=' + exitA + ' proxyHit=' + proxyHit + ' bodyOk=' + bodyOk)
  console.log('B: exit=' + exitB + ' noProxyBypassed=' + noProxyBypassed)
  console.log('C: exit=' + exitC + ' connectTunneled=' + connectTunneled)
  const ok =
    exitA === 0 &&
    proxyHit &&
    bodyOk &&
    exitB === 0 &&
    noProxyBypassed &&
    exitC === 0 &&
    connectTunneled
  proxy.close()
  process.exit(ok ? 0 : 1)
})
