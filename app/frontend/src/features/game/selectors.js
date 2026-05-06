/**
 * Selecteurs purs derivant les vues d'UI a partir de l'etat de jeu, de la
 * configuration et des etats locaux (lobby, mode tir, etc.).
 *
 * Toutes les fonctions sont sans side-effects et testables en isolation.
 */

const PHASE_PLACEMENT = 'PLACEMENT'
const PHASE_BATTLE = 'BATTLE'
const PHASE_GAME_OVER = 'GAME_OVER'

/**
 * Determine le numero de joueur "local" :
 * - en lobby : la valeur fournie par le serveur (`playerNumber`),
 * - en local (avec IA) : le premier slot humain,
 * - sinon : le joueur courant.
 */
export function getLocalPlayerNumber({ lobbyState, gameState, currentPlayer }) {
  if (lobbyState?.inLobby) {
    return lobbyState.playerNumber ?? 1
  }
  const aiSlots = Array.isArray(gameState?.aiPlayers) ? gameState.aiPlayers : null
  if (aiSlots && aiSlots.some(Boolean)) {
    const firstHumanIndex = aiSlots.findIndex((isAi) => !isAi)
    if (firstHumanIndex >= 0) return firstHumanIndex + 1
    return 1
  }
  return currentPlayer
}

/** Indique si le joueur courant est une IA. */
export function getCurrentIsAi({ gameState, currentPlayer }) {
  return Array.isArray(gameState?.aiPlayers) && Boolean(gameState.aiPlayers[currentPlayer - 1])
}

/**
 * Renvoie la map des etats de plateaux indexee par boardId, en superposant
 * les `delayedOwnBoardCells` (animations d'impacts adverses) sur le board
 * detenu par le joueur local.
 */
export function getBoardStatesById({ gameState, delayedOwnBoardCells }) {
  const stateById = {}
  if (!gameState?.boards) return stateById
  for (const board of gameState.boards) {
    if (board.ownBoard && delayedOwnBoardCells) {
      stateById[board.boardId] = { ...board, cells: delayedOwnBoardCells }
    } else {
      stateById[board.boardId] = board
    }
  }
  return stateById
}

/** boardId attendu pour le joueur local (selon son slot et la layout config). */
export function getExpectedOwnBoardId({ boards, localPlayerNumber }) {
  if (boards.length === 0) return 'A1'
  const boardIndex = Math.min(Math.max(localPlayerNumber - 1, 0), boards.length - 1)
  return boards[boardIndex]?.boardId ?? 'A1'
}

/** boardId reellement marque "ownBoard" par le serveur (fallback : expectedOwnBoardId). */
export function getClientOwnBoardId({ gameState, expectedOwnBoardId }) {
  const own = gameState?.boards?.find((board) => board.ownBoard)
  return own?.boardId ?? expectedOwnBoardId
}

/** Set des boardId controles par une IA. */
export function getAiBoardIds({ gameState, boards }) {
  const ids = new Set()
  if (!Array.isArray(gameState?.aiPlayers)) return ids
  for (let i = 0; i < boards.length; i += 1) {
    if (!gameState.aiPlayers[i]) continue
    const boardId = boards[i]?.boardId
    if (boardId) ids.add(boardId)
  }
  return ids
}

/** Vrai si la partie est un duel humain vs IA (2 joueurs, exactement 1 IA). */
export function getIsDuelWithAi(gameState) {
  if (!Array.isArray(gameState?.aiPlayers)) return false
  if ((gameState?.boards?.length ?? 0) !== 2) return false
  const aiCount = gameState.aiPlayers.filter(Boolean).length
  return aiCount === 1
}

function buildPlacementOverlayLabel({ lobbyInLobby, isDuelWithAi, currentIsAi, remainingShipsCount, isLocalTurn, currentPlayer }) {
  if (lobbyInLobby && !isDuelWithAi) {
    return 'Placez vos navires puis validez votre flotte.'
  }
  if (remainingShipsCount === 0 && !currentIsAi) {
    return 'Flotte prete - validez votre flotte.'
  }
  if (isDuelWithAi && !currentIsAi && remainingShipsCount === 0) {
    return "Placement de l'IA en cours..."
  }
  if (isDuelWithAi) {
    return currentIsAi ? "Tour de l'IA - placement" : 'Votre tour - placement'
  }
  return isLocalTurn ? 'Votre tour - placement' : `Tour du joueur ${currentPlayer} - placement`
}

function buildBattleOverlayLabel({ isDuelWithAi, currentIsAi, isLocalTurn, currentPlayer }) {
  if (isDuelWithAi) {
    return currentIsAi ? "Tour de l'IA - tir" : 'Votre tour - tirez sur la grille adverse'
  }
  if (currentIsAi) return `Tour de l'IA ${currentPlayer}`
  return isLocalTurn ? 'Votre tour - tir' : `Tour du joueur ${currentPlayer}`
}

/** Libelle affiche dans le bandeau de tour. */
export function getTurnOverlayLabel(params) {
  const { gamePhase, isGameOver, didLocalPlayerWin, currentIsAi } = params
  if (gamePhase === PHASE_PLACEMENT) return buildPlacementOverlayLabel(params)
  if (gamePhase === PHASE_BATTLE) return buildBattleOverlayLabel(params)
  if (isGameOver) return didLocalPlayerWin ? 'Victoire' : 'D\u00e9faite'
  return currentIsAi ? "Tour de l'IA" : 'Votre tour'
}

function isBattleInteractiveBoardId({
  boardIndex,
  boardId,
  alive,
  localPlayerNumber,
}) {
  const playerId = boardIndex + 1
  if (playerId === localPlayerNumber) return false
  const isAlive = !alive || alive[boardIndex] !== false
  if (!isAlive) return false
  return Boolean(boardId)
}

/**
 * Map { boardId: true } des plateaux interactifs pour le tour courant.
 * Encapsule les regles d'eligibilite (phase, mode tir, lobby, IA, etc.).
 */
export function getInteractiveBoards(params) {
  const {
    gameState,
    currentIsAi,
    lobbyInLobby,
    gamePhase,
    isLocalTurn,
    localPlacementLocked,
    expectedOwnBoardId,
    shouldOfferShootMode,
    shootModeActive,
    boards,
    numPlayersInState,
    localPlayerNumber,
  } = params
  if (!gameState) return {}
  if (currentIsAi) return {}
  if (lobbyInLobby && gamePhase === PHASE_BATTLE && !isLocalTurn) return {}
  if (gamePhase === PHASE_PLACEMENT) {
    if (localPlacementLocked) return {}
    return { [expectedOwnBoardId]: true }
  }
  if (gamePhase !== PHASE_BATTLE) return {}
  if (shouldOfferShootMode && !shootModeActive) return {}
  const alive = gameState.playersAlive
  const limit = Math.min(numPlayersInState, boards.length)
  const next = {}
  for (let i = 0; i < limit; i += 1) {
    const boardId = boards[i]?.boardId
    if (isBattleInteractiveBoardId({ boardIndex: i, boardId, alive, localPlayerNumber })) {
      next[boardId] = true
    }
  }
  return next
}

/** Resume de la configuration de partie pour le bandeau d'info. */
export function getGameSummary(setup) {
  const aiPart = setup.withAI ? ` \u00b7 ${setup.playerCount - setup.humanPlayers} IA` : ''
  return `${setup.boardSize}x${setup.boardSize} \u00b7 ${setup.playerCount} joueurs \u00b7 ${setup.humanPlayers} humains${aiPart} \u00b7 ${setup.fleetShipSizes.length} navires`
}

/** Libelle "Salon <gameId>" pour le bandeau de partie. */
export function getLobbyPartLabel(lobbyState) {
  if (!lobbyState?.inLobby || !lobbyState.gameId) return null
  return `Salon ${lobbyState.gameId}`
}

/** Vrai si le mode tir doit etre propose au joueur local. */
export function getShouldOfferShootMode({ gamePhase, isLocalTurn, currentIsAi, isGameOver }) {
  return gamePhase === PHASE_BATTLE && isLocalTurn && !currentIsAi && !isGameOver
}

/** Vrai si le joueur local est en train de viser (mode tir actif). */
export function getIsPlayerInShootMode({ gamePhase, isLocalTurn, currentIsAi, shootModeActive }) {
  return gamePhase === PHASE_BATTLE && isLocalTurn && !currentIsAi && shootModeActive
}

export const PHASES = Object.freeze({
  PLACEMENT: PHASE_PLACEMENT,
  BATTLE: PHASE_BATTLE,
  GAME_OVER: PHASE_GAME_OVER,
})
