const STORAGE_KEY = 'battleship:lobby-resume-tokens'

function readRaw() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

function writeRaw(tokensByGameId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokensByGameId))
  } catch {
    // Ignore quota/private mode failures.
  }
}

export function getLobbyResumeToken(gameId) {
  const normalized = String(gameId ?? '').trim().toLowerCase()
  if (!normalized) return null
  const map = readRaw()
  return typeof map[normalized] === 'string' ? map[normalized] : null
}

export function setLobbyResumeToken(gameId, token) {
  const normalized = String(gameId ?? '').trim().toLowerCase()
  if (!normalized || !token) return
  const map = readRaw()
  map[normalized] = token
  writeRaw(map)
}
