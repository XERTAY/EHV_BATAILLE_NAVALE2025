import { useCallback } from 'react'

import { BOARD_ID_TO_PLAYER } from '@/constants/game'
import { normalizeSetup } from '@/utils/setupNormalization'

const PHASE_PLACEMENT = 'PLACEMENT'
const PHASE_BATTLE = 'BATTLE'
const PHASE_GAME_OVER = 'GAME_OVER'

const RESET_LOBBY_STATE = Object.freeze({
  inLobby: false,
  isHost: false,
  gameId: null,
  players: 0,
  maxPlayers: 0,
  playerNumber: 1,
})

const LOBBY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isPlacementAlreadyConfirmedError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  return message.includes('placement deja valide')
}

function buildPlacementOffsets({ orientation, x, y, shipLength }) {
  if (orientation === 'EAST') return { x, y, orientation: 'HORIZONTAL' }
  if (orientation === 'SOUTH') return { x, y, orientation: 'VERTICAL' }
  if (orientation === 'WEST') return { x: x - (shipLength - 1), y, orientation: 'HORIZONTAL' }
  return { x, y: y - (shipLength - 1), orientation: 'VERTICAL' }
}

function buildBattleOutcomeStatus({ result, targetLabel }) {
  if (result.state.phase === PHASE_GAME_OVER) {
    return `Joueur ${result.state.winner} gagne. Dernier tir ${targetLabel}: ${result.result}.`
  }
  return `Tir ${targetLabel}: ${result.result}. Tour du joueur ${result.state.currentPlayer}.`
}

function buildPlacementOutcomeStatus({ result, boardId, label, selectedShipLabel }) {
  if (result.state.phase === PHASE_BATTLE) {
    const n = result.state.boards?.length ?? 0
    return n > 2
      ? 'Tous les navires sont places. Debut de la bataille, joueur 1. Cliquez sur une grille adverse encore en jeu pour tirer.'
      : 'Tous les navires sont places. Debut de la bataille, joueur 1.'
  }
  return `Navire ${selectedShipLabel} place sur ${boardId} ${label}. Joueur ${result.state.currentPlayer} continue.`
}

/**
 * Regroupe l'ensemble des actions metier exposees a l'UI : demarrage de partie,
 * placement, tir, lobby online, sauvegarde, retour menu.
 *
 * Le fix recent qui synchronise l'etat backend lorsque le client est encore
 * sur PLACEMENT alors que le serveur a deja avance est PRESERVE dans
 * `handleCellClick` (voir bloc "if (gameState?.phase !== 'PLACEMENT')").
 */
export default function useGameActions({
  api,
  ui,
  setup,
  selectors,
  placement,
  lobby,
  ws,
}) {
  const {
    bootstrapGame,
    placeShipAction,
    fireAtAction,
    loadGameAction,
    saveGameAction,
    refreshStateAction,
    refreshSaves,
    removeShipAction,
    confirmPlacementAction,
  } = api

  const {
    setScreen,
    setLayoutSet,
    setStatusMessage,
    setLocalPlacementWaiting,
    loading,
    gameState,
  } = ui

  const {
    interactiveBoards,
    currentIsAi,
    gamePhase,
    currentPlayer,
    expectedOwnBoardId,
    numPlayersInState,
    localPlayerNumber,
  } = selectors

  const {
    selectedShipType,
    selectedShipLabel,
    selectedShipSize,
    placementOrientation,
    removalModeEnabled,
    remainingShips,
    handlePlacementSuccess,
    setRemovalModeEnabled,
    resetPlacement,
    canRemoveSelectedShip,
    localPlacementLocked,
  } = placement

  const { lobbyState, setLobbyState } = lobby

  const handleStartGame = useCallback(async (options = {}) => {
    const keepLobby = Boolean(options.keepLobby)
    const startMode = options.startMode === 'load' ? 'load' : 'new'
    const setupPatch = options.setupPatch ?? {}
    const effectiveSetup = normalizeSetup({ ...setup, ...setupPatch, startMode })
    const nextLayoutSet = effectiveSetup.playerCount === 4 ? 'star4' : 'faceoff'

    try {
      setStatusMessage('Demarrage de la partie...')
      if (!keepLobby) setLobbyState(RESET_LOBBY_STATE)

      if (effectiveSetup.startMode === 'load') {
        const loaded = await loadGameAction(effectiveSetup.loadSaveFile)
        setLayoutSet(loaded?.boards?.length === 4 ? 'star4' : 'faceoff')
      } else {
        setLayoutSet(nextLayoutSet)
        await bootstrapGame(
          effectiveSetup.boardSize,
          effectiveSetup.fleetShipSizes,
          effectiveSetup.playerCount,
          effectiveSetup.withAI,
          effectiveSetup.humanPlayers,
          keepLobby && options.lobbyGameId ? options.lobbyGameId : null,
          options.bootstrapViewerPlayer ?? 1,
        )
      }
      setLocalPlacementWaiting(false)
      resetPlacement()
      setScreen('game')
      setStatusMessage(
        effectiveSetup.startMode === 'load'
          ? `Partie chargee depuis ${effectiveSetup.loadSaveFile}.`
          : `Partie lancee: ${effectiveSetup.boardSize}x${effectiveSetup.boardSize}, ${effectiveSetup.playerCount} joueurs, ${effectiveSetup.humanPlayers} humains${effectiveSetup.withAI ? `, ${effectiveSetup.playerCount - effectiveSetup.humanPlayers} IA` : ''}.`,
      )
    } catch (error) {
      setScreen('menu')
      setStatusMessage(error?.message ? `Impossible de demarrer: ${error.message}` : 'Impossible de demarrer la partie.')
    }
  }, [setup, bootstrapGame, loadGameAction, resetPlacement, setLayoutSet, setLobbyState, setLocalPlacementWaiting, setScreen, setStatusMessage])

  const enterGameScreenWithState = useCallback((state, status) => {
    const playerCountFromState = state?.boards?.length === 4 ? 4 : 2
    setLayoutSet(playerCountFromState === 4 ? 'star4' : 'faceoff')
    setLocalPlacementWaiting(false)
    resetPlacement()
    setScreen('game')
    if (status) setStatusMessage(status)
  }, [resetPlacement, setLayoutSet, setLocalPlacementWaiting, setScreen, setStatusMessage])

  const handleSaveCurrentGame = useCallback(async () => {
    try {
      await saveGameAction(setup.saveFileName)
      await refreshSaves()
      setStatusMessage(`Partie enregistree dans saves/${setup.saveFileName}.save`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [saveGameAction, setup.saveFileName, refreshSaves, setStatusMessage])

  const handleBackToMenu = useCallback(() => {
    setLocalPlacementWaiting(false)
    setScreen('menu')
    setStatusMessage('Menu de configuration ouvert.')
  }, [setLocalPlacementWaiting, setScreen, setStatusMessage])

  const sendPlacement = useCallback(async ({ boardId, x, y, label }) => {
    if (localPlacementLocked) {
      setStatusMessage('Placement deja valide. Impossible de modifier votre flotte.')
      return null
    }
    if (removalModeEnabled) {
      const removePayload = { player: localPlayerNumber, x, y }
      if (lobbyState.inLobby && lobbyState.gameId) removePayload.gameId = lobbyState.gameId
      await removeShipAction(removePayload)
      setStatusMessage(`Navire retire depuis ${boardId} ${label}.`)
      return null
    }
    if (remainingShips.length === 0) {
      setStatusMessage(`Joueur ${currentPlayer}: tous vos navires sont deja poses.`)
      return null
    }
    const shipLength = Math.max(1, Number(selectedShipSize) || 1)
    const normalized = buildPlacementOffsets({ orientation: placementOrientation, x, y, shipLength })
    const placePayload = {
      player: localPlayerNumber,
      shipType: selectedShipType,
      x: normalized.x,
      y: normalized.y,
      orientation: normalized.orientation,
    }
    if (lobbyState.inLobby && lobbyState.gameId) placePayload.gameId = lobbyState.gameId
    const result = await placeShipAction(placePayload)
    handlePlacementSuccess(localPlayerNumber, selectedShipType)
    setStatusMessage(buildPlacementOutcomeStatus({ result, boardId, label, selectedShipLabel }))
    return result
  }, [
    localPlacementLocked, removalModeEnabled, lobbyState.inLobby, lobbyState.gameId,
    localPlayerNumber, removeShipAction, remainingShips.length, currentPlayer,
    selectedShipSize, placementOrientation, selectedShipType, placeShipAction,
    handlePlacementSuccess, selectedShipLabel, setStatusMessage,
  ])

  const sendBattle = useCallback(async ({ boardId, x, y, label }) => {
    const targetPlayer = BOARD_ID_TO_PLAYER[boardId]
    const firePayload = {
      player: localPlayerNumber,
      x,
      y,
      targetPlayer: numPlayersInState > 2 ? targetPlayer : undefined,
    }
    if (lobbyState.inLobby && lobbyState.gameId) firePayload.gameId = lobbyState.gameId
    const result = await fireAtAction(firePayload)
    setStatusMessage(buildBattleOutcomeStatus({ result, targetLabel: `${boardId} ${label}` }))
    return result
  }, [
    localPlayerNumber, numPlayersInState, lobbyState.inLobby, lobbyState.gameId,
    fireAtAction, setStatusMessage,
  ])

  const handleNonInteractiveBoard = useCallback((boardId) => {
    if (currentIsAi && gamePhase === PHASE_PLACEMENT) {
      setStatusMessage(`Tour du joueur automatique (${currentPlayer})...`)
      return
    }
    if (currentIsAi && gamePhase === PHASE_BATTLE) {
      setStatusMessage(`Tour de l'ordinateur (${currentPlayer})...`)
      return
    }
    if (gamePhase === PHASE_PLACEMENT) {
      setStatusMessage(`Joueur ${currentPlayer}: placez sur votre grille ${expectedOwnBoardId}.`)
    } else if (numPlayersInState > 2) {
      setStatusMessage(`Joueur ${currentPlayer}: choisissez une grille adverse ${boardId} encore en jeu.`)
    } else {
      setStatusMessage(`Joueur ${currentPlayer}: tirez sur la grille adverse.`)
    }
  }, [currentIsAi, gamePhase, currentPlayer, expectedOwnBoardId, numPlayersInState, setStatusMessage])

  // Note importante : conserve le fix de resync `refreshStateAction` quand le
  // client est encore en `PLACEMENT` mais le backend a deja bascule.
  const handleCellClick = useCallback(async (cell) => {
    if (loading || !gameState) return
    if (!interactiveBoards[cell.boardId]) {
      handleNonInteractiveBoard(cell.boardId)
      return
    }
    try {
      if (gamePhase === PHASE_PLACEMENT) {
        if (gameState?.phase !== PHASE_PLACEMENT) {
          const lobbyScope = lobbyState.inLobby && lobbyState.gameId ? lobbyState.gameId : null
          setStatusMessage('Mise a jour de la phase de jeu depuis le serveur...')
          try {
            await refreshStateAction(localPlayerNumber, lobbyScope)
          } catch {
            // En cas d erreur reseau on laisse simplement le prochain render
            // re-evaluer les controles interactifs.
          }
          return
        }
        await sendPlacement(cell)
      } else if (gamePhase === PHASE_BATTLE) {
        await sendBattle(cell)
      }
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading, gameState, interactiveBoards, gamePhase, handleNonInteractiveBoard,
    lobbyState.inLobby, lobbyState.gameId, refreshStateAction, localPlayerNumber,
    sendPlacement, sendBattle, setStatusMessage,
  ])

  const handleConfirmPlacement = useCallback(async () => {
    if (loading || !gameState || gamePhase !== PHASE_PLACEMENT) return
    if (localPlacementLocked) {
      setLocalPlacementWaiting(true)
      return
    }
    if (remainingShips.length > 0) {
      setStatusMessage('Placez tous les navires avant de valider.')
      return
    }
    try {
      const payload = { player: localPlayerNumber }
      if (lobbyState.inLobby && lobbyState.gameId) payload.gameId = lobbyState.gameId
      await confirmPlacementAction(payload)
      setLocalPlacementWaiting(true)
      setStatusMessage('Placement valide. En attente des autres joueurs...')
      setRemovalModeEnabled(false)
    } catch (error) {
      // Si le backend indique que le placement est deja valide, on force une
      // resynchronisation d'etat pour remettre l'UI en phase.
      if (!isPlacementAlreadyConfirmedError(error)) {
        setLocalPlacementWaiting(false)
        return
      }
      const lobbyScope = lobbyState.inLobby && lobbyState.gameId ? lobbyState.gameId : null
      try {
        await refreshStateAction(localPlayerNumber, lobbyScope)
      } catch {
        // L'erreur de sync est deja geree dans le hook API.
      }
      setLocalPlacementWaiting(true)
      setStatusMessage('Placement deja valide. En attente des autres joueurs...')
      setRemovalModeEnabled(false)
    }
  }, [
    loading, gameState, gamePhase, localPlacementLocked, remainingShips.length,
    confirmPlacementAction, localPlayerNumber, setLocalPlacementWaiting, setRemovalModeEnabled,
    lobbyState.inLobby, lobbyState.gameId, refreshStateAction, setStatusMessage,
  ])

  const handleRemoveSelectedShip = useCallback(async () => {
    if (loading || !gameState || gamePhase !== PHASE_PLACEMENT || localPlacementLocked) return
    if (!canRemoveSelectedShip) {
      setStatusMessage('Ce navire n est pas encore place.')
      return
    }
    try {
      const removePayload = { player: localPlayerNumber, shipType: selectedShipType }
      if (lobbyState.inLobby && lobbyState.gameId) removePayload.gameId = lobbyState.gameId
      await removeShipAction(removePayload)
      setStatusMessage(`Navire ${selectedShipLabel} retire.`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading, gameState, gamePhase, localPlacementLocked, canRemoveSelectedShip,
    removeShipAction, localPlayerNumber, selectedShipType, selectedShipLabel,
    lobbyState.inLobby, lobbyState.gameId, setStatusMessage,
  ])

  const handleCreateLobby = useCallback((maxPlayers) => {
    ws.createGame(maxPlayers)
  }, [ws])

  const handleJoinLobby = useCallback((gameId, intent = 'manual') => {
    const normalized = gameId?.trim()?.toLowerCase()
    if (!normalized) return
    if (normalized.includes('…') || normalized.includes('...')) {
      setStatusMessage('ID de lobby tronque detecte. Utilisez l ID complet copie depuis "Copier l ID".')
      return
    }
    if (!LOBBY_ID_PATTERN.test(normalized)) {
      setStatusMessage('ID de lobby invalide. Format attendu: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.')
      return
    }
    ws.joinGame(normalized, intent)
  }, [setStatusMessage, ws])

  const handleLeaveLobby = useCallback(() => {
    ws.leaveGame()
    setLobbyState(RESET_LOBBY_STATE)
    setStatusMessage('Lobby quitte.')
  }, [setLobbyState, setStatusMessage, ws])

  const handleStartLobbyGame = useCallback(async (setupPatch = {}) => {
    if (!lobbyState.isHost || !lobbyState.gameId) return
    try {
      await handleStartGame({
        keepLobby: true,
        startMode: 'new',
        setupPatch,
        lobbyGameId: lobbyState.gameId,
        bootstrapViewerPlayer: lobbyState.playerNumber,
      })
      ws.startGame(lobbyState.gameId)
    } catch {
      // L'erreur est deja geree dans handleStartGame.
    }
  }, [handleStartGame, lobbyState.isHost, lobbyState.gameId, lobbyState.playerNumber, ws])

  return {
    handleStartGame,
    enterGameScreenWithState,
    handleSaveCurrentGame,
    handleBackToMenu,
    handleCellClick,
    handleConfirmPlacement,
    handleRemoveSelectedShip,
    handleCreateLobby,
    handleJoinLobby,
    handleLeaveLobby,
    handleStartLobbyGame,
  }
}
