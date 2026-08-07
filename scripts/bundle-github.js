const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const tmp = path.join(root, '.ncc-build')
const nccPkg = require(path.join(root, 'node_modules', '@vercel', 'ncc', 'package.json'))
const nccBin = path.join(root, 'node_modules', '@vercel', 'ncc', nccPkg.bin.ncc)

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd })
}

const entry = path.join(dist, 'cli.js')
if (!fs.existsSync(entry)) {
  throw new Error('dist/cli.js not found - run `npm run build` first')
}

fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })

console.log('bundling dist/cli.js with @vercel/ncc')
run(`node "${nccBin}" build "${entry}" -o "${tmp}"`, root)

fs.rmSync(entry)
for (const name of fs.readdirSync(tmp)) {
  const src = path.join(tmp, name)
  const destName = name === 'index.js' ? 'cli.js' : name === 'index.js.map' ? 'cli.js.map' : name
  const dest = path.join(dist, destName)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(src, dest, { recursive: true })
}
fs.rmSync(tmp, { recursive: true, force: true })

console.log('done - dist/cli.js is now self-contained (no node_modules required at runtime)')
