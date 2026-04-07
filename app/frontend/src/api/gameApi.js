const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5183/api'

async function callApi(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.message ?? `Erreur backend (${response.status})`
    throw new Error(message)
  }
  return response.json()
}

export function resetGame() {
  return callApi('/game/reset', { method: 'POST' })
}

export function getGameState(player) {
  return callApi(`/game/state?player=${player}`)
}

export function placeShip(payload) {
  return callApi('/game/place', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fireAt(payload) {
  return callApi('/game/fire', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
