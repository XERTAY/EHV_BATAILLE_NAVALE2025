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

export function resetGame(boardSize = 10, fleetShipSizes = [5, 4, 3, 3, 2]) {
  return callApi('/game/reset', {
    method: 'POST',
    body: JSON.stringify({
      boardSize: Math.max(5, Number(boardSize) || 10),
      fleetShipSizes: Array.isArray(fleetShipSizes) && fleetShipSizes.length > 0
        ? fleetShipSizes.map((size) => Math.max(1, Number(size) || 1))
        : [5, 4, 3, 3, 2],
    }),
  })
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

export function listSaves() {
  return callApi('/game/saves')
}

export function loadGame(fileName) {
  const file = encodeURIComponent((fileName || 'bataille-navale').trim())
  return callApi(`/game/load?file=${file}`, {
    method: 'POST',
  })
}

export function saveGame(fileName) {
  const file = encodeURIComponent((fileName || 'bataille-navale').trim())
  return callApi(`/game/save?file=${file}`, {
    method: 'POST',
  })
}
