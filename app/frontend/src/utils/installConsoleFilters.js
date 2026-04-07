const IGNORED_WARNING_PATTERNS = [
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
  'unsupported GPOS table LookupType',
  'unsupported GSUB table LookupType',
  'MouseEvent.mozPressure est obsol',
  'MouseEvent.mozInputSource est obsol',
]

function shouldIgnore(message) {
  return IGNORED_WARNING_PATTERNS.some((pattern) => message.includes(pattern))
}

export function installConsoleFilters() {
  if (!import.meta.env.DEV) return

  const originalWarn = console.warn
  const originalError = console.error

  console.warn = (...args) => {
    const first = args[0]
    const message = typeof first === 'string' ? first : String(first ?? '')
    if (shouldIgnore(message)) return
    originalWarn(...args)
  }

  console.error = (...args) => {
    const first = args[0]
    const message = typeof first === 'string' ? first : String(first ?? '')
    if (shouldIgnore(message)) return
    originalError(...args)
  }
}
