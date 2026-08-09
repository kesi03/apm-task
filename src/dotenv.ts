import { readFileSync } from 'fs'

export function parseEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trimStart()
    }
    const eq = line.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = line.slice(0, eq).trim()
    if (!key) {
      continue
    }
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2) {
      const first = value[0]
      const last = value[value.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1)
      } else {
        const hash = value.search(/(^|\s)#/)
        if (hash !== -1) {
          value = value.slice(0, hash).trimEnd()
        }
      }
    }
    result[key] = value
  }
  return result
}

export function loadEnvFile(filePath: string): boolean {
  let contents: string
  try {
    contents = readFileSync(filePath, 'utf8')
  } catch {
    return false
  }
  for (const [key, value] of Object.entries(parseEnv(contents))) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  return true
}
