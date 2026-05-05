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
  lobbyGameId,
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
  if (lobbyGameId != null && String(lobbyGameId).trim() !== '') {
    body.gameId = String(lobbyGameId).trim()
  }
  return callApi('/game/reset', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getGameState(player, lobbyGameId) {
  const params = new URLSearchParams({ player: String(player) })
  if (lobbyGameId != null && String(lobbyGameId).trim() !== '') {
    params.set('gameId', String(lobbyGameId).trim())
  }
  return callApi(`/game/state?${params.toString()}`)
}

export function placeShip(payload) {
  const body = { ...payload }
  if (payload?.gameId != null && String(payload.gameId).trim() !== '') {
    body.gameId = String(payload.gameId).trim()
  } else {
    delete body.gameId
  }
  return callApi('/game/place', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function removePlacedShip(payload) {
  const body = { ...payload }
  if (payload?.gameId != null && String(payload.gameId).trim() !== '') {
    body.gameId = String(payload.gameId).trim()
  } else {
    delete body.gameId
  }
  return callApi('/game/placement/remove', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function confirmPlacement(payload) {
  const body = { player: payload.player }
  if (payload?.gameId != null && String(payload.gameId).trim() !== '') {
    body.gameId = String(payload.gameId).trim()
  }
  return callApi('/game/placement/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
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
  if (payload.gameId != null && String(payload.gameId).trim() !== '') {
    body.gameId = String(payload.gameId).trim()
  }
  return callApi('/game/fire', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** @param {string} [lobbyGameId] si partie en ligne : notifie l autre client via WebSocket apres le coup IA */
export function runAiStep(lobbyGameId) {
  const params =
    lobbyGameId != null && String(lobbyGameId).trim() !== ''
      ? `?gameId=${encodeURIComponent(String(lobbyGameId).trim())}`
      : ''
  return callApi(`/game/ai-step${params}`, {
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
