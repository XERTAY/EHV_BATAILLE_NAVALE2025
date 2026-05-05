const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

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

export function resetGame(
  boardSize = 10,
  fleetShipSizes = [5, 4, 3, 3, 2],
  playerCount = 2,
  withAI = false,
  humanPlayers,
) {
  const normalizedCount = playerCount === 4 ? 4 : 2
  const body = {
    boardSize: Math.max(5, Number(boardSize) || 10),
    fleetShipSizes: Array.isArray(fleetShipSizes) && fleetShipSizes.length > 0
      ? fleetShipSizes.map((size) => Math.max(1, Number(size) || 1))
      : [5, 4, 3, 3, 2],
    playerCount: normalizedCount,
  }
  if (withAI && humanPlayers != null) {
    body.withAI = true
    body.humanPlayers = Math.max(1, Math.min(Number(humanPlayers) || 1, normalizedCount - 1))
  } else {
    body.withAI = false
    body.humanPlayers = null
  }
  return callApi('/game/reset', {
    method: 'POST',
    body: JSON.stringify(body),
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

export function removePlacedShip(payload) {
  return callApi('/game/placement/remove', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmPlacement(payload) {
  return callApi('/game/placement/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fireAt(payload) {
  const body = {
    player: payload.player,
    x: payload.x,
    y: payload.y,
  }
  if (payload.targetPlayer != null) {
    body.targetPlayer = payload.targetPlayer
  }
  return callApi('/game/fire', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function runAiStep() {
  return callApi('/game/ai-step', {
    method: 'POST',
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
