const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const taskDir = path.join(root, 'CiApmTrace')
const outDir = path.join(root, 'out')
const tfxPkg = require(path.join(root, 'node_modules', 'tfx-cli', 'package.json'))
const tfx = path.join(root, 'node_modules', 'tfx-cli', tfxPkg.bin.tfx)

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd })
}

const PRUNE_DIRS = ['test', 'tests', '__tests__', 'example', 'examples']

function pruneNodeModules(dir, depth = 0) {
  if (depth > 6) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    if (PRUNE_DIRS.includes(entry.name)) {
      fs.rmSync(full, { recursive: true, force: true })
      continue
    }
    pruneNodeModules(full, depth + 1)
  }
}

fs.rmSync(taskDir, { recursive: true, force: true })
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(taskDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

console.log('[1/5] copying task.json')
fs.copyFileSync(path.join(root, 'task.json'), path.join(taskDir, 'task.json'))

console.log('[2/5] copying compiled dist/')
fs.cpSync(path.join(root, 'dist'), path.join(taskDir, 'dist'), { recursive: true })

console.log('[2.5/5] copying task icon')
fs.mkdirSync(path.join(taskDir, 'icons'), { recursive: true })
fs.copyFileSync(path.join(root, 'icons', '48.png'), path.join(taskDir, 'icons', 'icon.png'))

console.log('[3/5] installing production dependencies into task folder')
fs.copyFileSync(path.join(root, 'package.json'), path.join(taskDir, 'package.json'))
fs.copyFileSync(path.join(root, 'package-lock.json'), path.join(taskDir, 'package-lock.json'))
run('npm ci --omit=dev', taskDir)

console.log('[4/5] pruning test/example fixtures (OPC part-name safety)')
pruneNodeModules(path.join(taskDir, 'node_modules'))

console.log('[5/5] creating .vsix via tfx')
run(`node "${tfx}" extension create --manifest-globs vss-extension.json --output-path out --root .`, root)

console.log('done - .vsix written to out/')
