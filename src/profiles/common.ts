export function pickStrings(values: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value) {
      out[key] = value
    }
  }
  return out
}

export function pickValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value
    }
  }
  return out
}
