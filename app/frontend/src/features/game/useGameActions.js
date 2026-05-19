import { useCallback } from 'react'

import { BOARD_ID_TO_PLAYER } from '@/constants/game'
import { INITIAL_LOBBY_STATE } from '@/features/lobby/useLobbyState'
import { normalizeSetup } from '@/utils/setupNormalization'
import { downloadTextFile } from '@/utils/downloadTextFile'

import {
  PHASE_BATTLE,
  PHASE_PLACEMENT,
  PLAYER_TO_BOARD_ID,
  buildBattleOutcomeStatus,
  buildPlacementOffsets,
  buildPlacementOutcomeStatus,
  isPlacementAlreadyConfirmedError,
} from './gameActionHelpers'

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
  battle,
  onBattleAction,
}) {
  const {
    bootstrapGame,
    placeShipAction,
    fireAtAction,
    loadGameAction,
    loadGameFromFileAction,
    saveGameAction,
    refreshStateAction,
    refreshSaves,
    removeShipAction,
    confirmPlacementAction,
    activeLobbyGameId,
    clearActiveLobbyScope,
    leaveGame,
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
  /** Scope HTTP reel (null = partie locale). Evite d envoyer le gameId WS si la partie tourne en local. */
  const scopedGameId = activeLobbyGameId ?? null
  const {
    battleSubState,
    setBattleSubState,
    selectedTargetBoardId,
    setSelectedTargetBoardId,
  } = battle

  const handleStartGame = useCallback(async (options = {}) => {
    const keepLobby = Boolean(options.keepLobby)
    const startMode = options.startMode === 'load' ? 'load' : 'new'
    const setupPatch = options.setupPatch ?? {}
    const effectiveSetup = normalizeSetup({ ...setup, ...setupPatch, startMode })
    const nextLayoutSet = effectiveSetup.playerCount === 4 ? 'star4' : 'faceoff'

    try {
      setStatusMessage('Demarrage de la partie...')
      if (!keepLobby) {
        setLobbyState(INITIAL_LOBBY_STATE)
        clearActiveLobbyScope?.()
        leaveGame?.()
      }

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
  }, [setup, bootstrapGame, loadGameAction, resetPlacement, setLayoutSet, setLobbyState, setLocalPlacementWaiting, setScreen, setStatusMessage, clearActiveLobbyScope, leaveGame, setLobbyState])

  const handleLoadFromSaveFile = useCallback(async (fileContent) => {
    if (!fileContent?.trim()) {
      setStatusMessage('Fichier de sauvegarde vide.')
      return
    }
    try {
      setStatusMessage('Chargement du fichier...')
      setLobbyState(INITIAL_LOBBY_STATE)
      clearActiveLobbyScope?.()
      leaveGame?.()
      const loaded = await loadGameFromFileAction(fileContent)
      setLayoutSet(loaded?.boards?.length === 4 ? 'star4' : 'faceoff')
      setLocalPlacementWaiting(false)
      resetPlacement()
      setScreen('game')
      setStatusMessage('Partie chargee depuis le fichier .save.')
    } catch (error) {
      setScreen('menu')
      setStatusMessage(error?.message ? `Chargement impossible: ${error.message}` : 'Chargement impossible.')
    }
  }, [loadGameFromFileAction, resetPlacement, setLayoutSet, setLobbyState, setLocalPlacementWaiting, setScreen, setStatusMessage, clearActiveLobbyScope, leaveGame])

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
      const lobbyGameId = scopedGameId
      const response = await saveGameAction(setup.saveFileName, lobbyGameId)
      const fileName = response?.fileName ?? `${setup.saveFileName}.save`
      if (response?.content) {
        downloadTextFile(response.content, fileName)
      }
      await refreshSaves()
      setStatusMessage(`Partie enregistree (${fileName}) — fichier telecharge et copie serveur dans saves/.`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [saveGameAction, setup.saveFileName, refreshSaves, setStatusMessage, scopedGameId])

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
      if (scopedGameId) removePayload.gameId = scopedGameId
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
    if (scopedGameId) placePayload.gameId = scopedGameId
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
    const effectiveBoardId = numPlayersInState > 2 ? selectedTargetBoardId : boardId
    const targetPlayer = BOARD_ID_TO_PLAYER[effectiveBoardId]
    const firePayload = {
      player: localPlayerNumber,
      x,
      y,
      targetPlayer: numPlayersInState > 2 ? targetPlayer : undefined,
    }
    if (scopedGameId) firePayload.gameId = scopedGameId
    const result = await fireAtAction(firePayload)
    if (onBattleAction) onBattleAction(result)
    if (numPlayersInState > 2) {
      const nextTarget = result.state.currentTargetPlayer
      if (nextTarget) {
        const lockedBoardId = PLAYER_TO_BOARD_ID[nextTarget] ?? effectiveBoardId
        setSelectedTargetBoardId(lockedBoardId)
        setBattleSubState('firing')
      } else {
        setSelectedTargetBoardId(null)
        setBattleSubState('target_selection')
      }
    }
    setStatusMessage(buildBattleOutcomeStatus({ result, targetLabel: `${effectiveBoardId} ${label}` }))
    return result
  }, [
    localPlayerNumber, numPlayersInState, lobbyState.inLobby, lobbyState.gameId,
    selectedTargetBoardId, fireAtAction, onBattleAction, setStatusMessage, setBattleSubState, setSelectedTargetBoardId,
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
    } else if (numPlayersInState > 2 && battleSubState === 'target_selection') {
      setStatusMessage(`Joueur ${currentPlayer}: choisissez une grille adverse pour verrouiller la cible.`)
    } else if (numPlayersInState > 2) {
      setStatusMessage(`Joueur ${currentPlayer}: cible verrouillee sur ${selectedTargetBoardId ?? 'une grille adverse'}.`)
    } else {
      setStatusMessage(`Joueur ${currentPlayer}: tirez sur la grille adverse.`)
    }
  }, [
    currentIsAi, gamePhase, currentPlayer, expectedOwnBoardId, numPlayersInState,
    battleSubState, selectedTargetBoardId, setStatusMessage,
  ])

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
          const lobbyScope = scopedGameId
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
        if (numPlayersInState > 2 && battleSubState === 'target_selection') {
          const targetPlayer = BOARD_ID_TO_PLAYER[cell.boardId]
          if (!targetPlayer || targetPlayer === localPlayerNumber) {
            setStatusMessage('Choisissez une grille adverse encore en jeu.')
            return
          }
          setSelectedTargetBoardId(cell.boardId)
          setBattleSubState('firing')
          setStatusMessage(`Cible verrouillee sur ${cell.boardId}. Visez une case pour tirer.`)
          return
        }
        await sendBattle(cell)
      }
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading, gameState, interactiveBoards, gamePhase, handleNonInteractiveBoard,
    scopedGameId, refreshStateAction, localPlayerNumber,
    sendPlacement, sendBattle, setStatusMessage, numPlayersInState, battleSubState,
    localPlayerNumber, setBattleSubState, setSelectedTargetBoardId,
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
      if (scopedGameId) payload.gameId = scopedGameId
      const result = await confirmPlacementAction(payload)
      if (result?.state?.phase === PHASE_BATTLE) {
        setLocalPlacementWaiting(false)
        setStatusMessage('Tous les joueurs sont prets. Debut de la bataille.')
      } else {
        setLocalPlacementWaiting(true)
        setStatusMessage('Placement valide. En attente des autres joueurs...')
      }
      setRemovalModeEnabled(false)
      const lobbyScope = scopedGameId
      try {
        await refreshStateAction(localPlayerNumber, lobbyScope)
      } catch {
        // Deja gere dans le hook API.
      }
    } catch (error) {
      // Si le backend indique que le placement est deja valide, on force une
      // resynchronisation d'etat pour remettre l'UI en phase.
      if (!isPlacementAlreadyConfirmedError(error)) {
        setLocalPlacementWaiting(false)
        return
      }
      const lobbyScope = scopedGameId
      try {
        const synced = await refreshStateAction(localPlayerNumber, lobbyScope)
        if (synced?.phase === PHASE_BATTLE) {
          setLocalPlacementWaiting(false)
          setStatusMessage('Tous les joueurs sont prets. Debut de la bataille.')
        } else {
          setLocalPlacementWaiting(true)
          setStatusMessage('Placement deja valide. En attente des autres joueurs...')
        }
      } catch {
        setLocalPlacementWaiting(true)
        setStatusMessage('Placement deja valide. En attente des autres joueurs...')
      }
      setRemovalModeEnabled(false)
    }
  }, [
    loading, gameState, gamePhase, localPlacementLocked, remainingShips.length,
    confirmPlacementAction, localPlayerNumber, setLocalPlacementWaiting, setRemovalModeEnabled,
    scopedGameId, refreshStateAction, setStatusMessage,
  ])

  const handleRemoveSelectedShip = useCallback(async () => {
    if (loading || !gameState || gamePhase !== PHASE_PLACEMENT || localPlacementLocked) return
    if (!canRemoveSelectedShip) {
      setStatusMessage('Ce navire n est pas encore place.')
      return
    }
    try {
      const removePayload = { player: localPlayerNumber, shipType: selectedShipType }
      if (scopedGameId) removePayload.gameId = scopedGameId
      await removeShipAction(removePayload)
      setStatusMessage(`Navire ${selectedShipLabel} retire.`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading, gameState, gamePhase, localPlacementLocked, canRemoveSelectedShip,
    removeShipAction, localPlayerNumber, selectedShipType, selectedShipLabel,
    scopedGameId, setStatusMessage,
  ])

  return {
    handleStartGame,
    handleLoadFromSaveFile,
    enterGameScreenWithState,
    handleSaveCurrentGame,
    handleBackToMenu,
    handleCellClick,
    handleConfirmPlacement,
    handleRemoveSelectedShip,
  }
}
