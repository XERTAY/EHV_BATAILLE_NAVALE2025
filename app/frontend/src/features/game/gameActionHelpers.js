export const PHASE_PLACEMENT = 'PLACEMENT'
export const PHASE_BATTLE = 'BATTLE'
export const PHASE_GAME_OVER = 'GAME_OVER'

export const LOBBY_ID_LENGTH = 4
export const LOBBY_ID_PATTERN = /^[0-9a-z]{4}$/

export function normalizeLobbyGameId(raw) {
  const normalized = String(raw ?? '').trim().toLowerCase()
  return LOBBY_ID_PATTERN.test(normalized) ? normalized : null
}

export const PLAYER_TO_BOARD_ID = Object.freeze({
  1: 'A1',
  2: 'B1',
  3: 'C1',
  4: 'D1',
})

export function isPlacementAlreadyConfirmedError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  return message.includes('placement deja valide')
}

export function buildPlacementOffsets({ orientation, x, y, shipLength }) {
  if (orientation === 'EAST') return { x, y, orientation: 'HORIZONTAL' }
  if (orientation === 'SOUTH') return { x, y, orientation: 'VERTICAL' }
  if (orientation === 'WEST') return { x: x - (shipLength - 1), y, orientation: 'HORIZONTAL' }
  return { x, y: y - (shipLength - 1), orientation: 'VERTICAL' }
}

export function buildBattleOutcomeStatus({ result, targetLabel }) {
  if (result.state.phase === PHASE_GAME_OVER) {
    return `Joueur ${result.state.winner} gagne. Dernier tir ${targetLabel}: ${result.result}.`
  }
  return `Tir ${targetLabel}: ${result.result}. Tour du joueur ${result.state.currentPlayer}.`
}

export function buildPlacementOutcomeStatus({ result, boardId, label, selectedShipLabel }) {
  if (result.state.phase === PHASE_BATTLE) {
    const n = result.state.boards?.length ?? 0
    return n > 2
      ? 'Tous les navires sont places. Debut de la bataille, joueur 1. Cliquez sur une grille adverse encore en jeu pour tirer.'
      : 'Tous les navires sont places. Debut de la bataille, joueur 1.'
  }
  return `Navire ${selectedShipLabel} place sur ${boardId} ${label}. Joueur ${result.state.currentPlayer} continue.`
}
