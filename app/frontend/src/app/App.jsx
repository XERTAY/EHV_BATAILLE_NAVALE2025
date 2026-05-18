import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import '../App.css'
import { BOARD_CONFIGS } from '@/config/boardConfigs'
import useAiTurnDriver from '@/features/battle/useAiTurnDriver'
import useEnemyImpactReveal from '@/features/battle/useEnemyImpactReveal'
import useShootModeCountdown from '@/features/battle/useShootModeCountdown'
import useCameraDirection from '@/features/camera/useCameraDirection'
import {
  getClientOwnBoardId,
  getExpectedOwnBoardId,
  getGameSummary,
  getLocalPlayerNumber,
} from '@/features/game/selectors'
import useGameActions from '@/features/game/useGameActions'
import useGameSelectors from '@/features/game/useGameSelectors'
import useLobbyActions from '@/features/lobby/useLobbyActions'
import useLobbyState from '@/features/lobby/useLobbyState'
import usePlacementHotkeys from '@/features/placement/usePlacementHotkeys'
import useSetupPersistence from '@/features/setup/useSetupPersistence'
import useGameApi from '@/hooks/useGameApi'
import usePlacement from '@/hooks/usePlacement'
import useWebSocketGame from '@/hooks/useWebSocketGame'

import GameScreen from './GameScreen'
import MenuScreen from './MenuScreen'

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [layoutSet, setLayoutSet] = useState('faceoff')
  const [showCoordinates, setShowCoordinates] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Initialisation de la partie...')
  const [availableSaves, setAvailableSaves] = useState([])
  const [localPlacementWaiting, setLocalPlacementWaiting] = useState(false)
  const [battleSubState, setBattleSubState] = useState('firing')
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState(null)
  const [actionFeed, setActionFeed] = useState([])
  const autoJoinTriedRef = useRef(false)
  const seenActionKeysRef = useRef(new Set())
  const appendActionFeed = useCallback((entry) => {
    const shooter = Number(entry?.shooter)
    const targetPlayer = Number(entry?.targetPlayer)
    const x = Number(entry?.shotX ?? entry?.x)
    const y = Number(entry?.shotY ?? entry?.y)
    if (!Number.isInteger(shooter) || !Number.isInteger(targetPlayer) || !Number.isInteger(x) || !Number.isInteger(y)) return
    if (x < 0 || y < 0) return
    const cellLabel = `${String.fromCharCode(65 + x)}${y + 1}`
    const key = `${shooter}:${targetPlayer}:${x}:${y}`
    if (seenActionKeysRef.current.has(key)) return
    seenActionKeysRef.current.add(key)
    const timestamp = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    setActionFeed((prev) => {
      const next = [...prev, `${timestamp} | Joueur${shooter} -> ${cellLabel} -> Joueur${targetPlayer}`]
      return next.slice(-100)
    })
  }, [])


  const { setup, applySetupPatch } = useSetupPersistence()
  const api = useGameApi()
  const ws = useWebSocketGame()
  const { gameState, loading, errorMessage, listSavesAction } = api

  const refreshSaves = useCallback(async () => {
    try {
      setAvailableSaves(await listSavesAction())
    } catch {
      // Erreur deja geree par le hook API.
    }
  }, [listSavesAction])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  // Joueur local preliminaire (utilisable avant les selecteurs finaux).
  const preliminaryLocalPlayerNumber = useMemo(
    () => getLocalPlayerNumber({
      lobbyState: {
        inLobby: Boolean(ws.wsState?.gameId),
        playerNumber: ws.wsState?.playerNumber ?? 1,
      },
      gameState,
      currentPlayer: gameState?.currentPlayer ?? 1,
    }),
    [ws.wsState?.gameId, ws.wsState?.playerNumber, gameState],
  )

  const placementLockedByPlayer = gameState?.placementLockedByPlayer ?? []
  const localPlacementLocked = Boolean(
    placementLockedByPlayer[preliminaryLocalPlayerNumber - 1],
  )
  const localPlacementLockedOrWaiting = localPlacementLocked || localPlacementWaiting

  const placement = usePlacement({
    currentPlayer: preliminaryLocalPlayerNumber,
    gamePhase: gameState?.phase,
    localPlacementLocked: localPlacementLockedOrWaiting,
    placementInteractionDisabled: loading,
    boardSize: gameState?.boardSize ?? setup.boardSize ?? 10,
    fleetShipSizes: setup.fleetShipSizes,
  })

  // Pre-calcul de l'identifiant de plateau du joueur local (necessaire avant
  // useEnemyImpactReveal). Le selecteur final (`useGameSelectors`) memorise la
  // meme derivation, mais on l'instancie ici en amont pour briser le cycle.
  const preliminaryBoards = useMemo(() => BOARD_CONFIGS[layoutSet], [layoutSet])
  const preliminaryExpectedOwnBoardId = useMemo(
    () => getExpectedOwnBoardId({ boards: preliminaryBoards, localPlayerNumber: preliminaryLocalPlayerNumber }),
    [preliminaryBoards, preliminaryLocalPlayerNumber],
  )
  const preliminaryClientOwnBoardId = useMemo(
    () => getClientOwnBoardId({ gameState, expectedOwnBoardId: preliminaryExpectedOwnBoardId }),
    [gameState, preliminaryExpectedOwnBoardId],
  )

  const enemyImpactReveal = useEnemyImpactReveal({
    gameState,
    clientOwnBoardId: preliminaryClientOwnBoardId,
    onStatus: setStatusMessage,
  })
  const { delayedOwnBoardCells, recentImpactsByBoard } = enemyImpactReveal

  const handleEnterGameScreenWithState = useCallback((state, status) => {
    const playerCountFromState = state?.boards?.length === 4 ? 4 : 2
    setLayoutSet(playerCountFromState === 4 ? 'star4' : 'faceoff')
    setLocalPlacementWaiting(false)
    placement.resetPlacement()
    setScreen('game')
    if (status) setStatusMessage(status)
  }, [placement.resetPlacement])

  const lobbyApi = useLobbyState({
    wsMessage: ws.wsMessage,
    screen,
    fallbackPlayerCount: setup.playerCount,
    refreshStateAction: api.refreshStateAction,
    syncStateAction: api.syncStateAction,
    enterGameScreenWithState: handleEnterGameScreenWithState,
    onStatus: setStatusMessage,
  })
  const { lobbyState } = lobbyApi

  useEffect(() => {
    if (gameState?.phase === 'BATTLE' || gameState?.phase === 'GAME_OVER') {
      setLocalPlacementWaiting(false)
    }
  }, [gameState?.phase])

  useEffect(() => {
    if (screen !== 'game' || !lobbyState?.inLobby || !lobbyState?.gameId) return undefined
    const beat = window.setInterval(() => {
      ws.send({ type: 'HEARTBEAT', gameId: lobbyState.gameId })
    }, 5000)
    return () => window.clearInterval(beat)
  }, [screen, lobbyState?.inLobby, lobbyState?.gameId, ws.send])

  // Mode tir : la `shouldOffer`/`isPlayerInShootMode` est calculee plus bas avec
  // les selecteurs ; ici on instancie le countdown avec les valeurs derivees.
  const [shootBootstrap, setShootBootstrap] = useState({ shouldOffer: false, currentPlayer: 1, localPlayer: 1 })
  const shoot = useShootModeCountdown({
    shouldOffer: shootBootstrap.shouldOffer,
    currentPlayer: shootBootstrap.currentPlayer,
    localPlayerNumber: shootBootstrap.localPlayer,
  })

  const selectors = useGameSelectors({
    gameState,
    lobbyState,
    layoutSet,
    setup,
    delayedOwnBoardCells,
    placement: {
      remainingShipsCount: placement.remainingShips.length,
      localPlacementLocked: localPlacementLockedOrWaiting,
    },
    shoot: { shootModeActive: shoot.shootModeActive },
    battleSubState,
    selectedTargetBoardId,
  })

  useEffect(() => {
    const isFourPlayerBattle = selectors.gamePhase === 'BATTLE' && selectors.numPlayersInState > 2
    if (!isFourPlayerBattle || !selectors.isLocalTurn) {
      setBattleSubState('firing')
      setSelectedTargetBoardId(null)
      return
    }
    const lockedTarget = selectors.currentTargetPlayer
    if (lockedTarget) {
      const boardId = selectors.boards[lockedTarget - 1]?.boardId ?? null
      setBattleSubState('firing')
      setSelectedTargetBoardId(boardId)
      return
    }
    setBattleSubState('target_selection')
    setSelectedTargetBoardId(null)
  }, [
    selectors.gamePhase,
    selectors.numPlayersInState,
    selectors.isLocalTurn,
    selectors.currentTargetPlayer,
    selectors.boards,
  ])

  // Synchronise le contexte du countdown avec les selecteurs (depend cycliquement
  // de `shoot.shootModeActive` -> `shouldOfferShootMode`).
  useEffect(() => {
    setShootBootstrap((previous) => {
      const next = {
        shouldOffer: selectors.shouldOfferShootMode,
        currentPlayer: selectors.currentPlayer,
        localPlayer: selectors.localPlayerNumber,
      }
      if (
        previous.shouldOffer === next.shouldOffer
        && previous.currentPlayer === next.currentPlayer
        && previous.localPlayer === next.localPlayer
      ) {
        return previous
      }
      return next
    })
  }, [selectors.shouldOfferShootMode, selectors.currentPlayer, selectors.localPlayerNumber])

  // Sync des navires deja places (lobby reload, IA) avec le hook de placement.
  useEffect(() => {
    if (!Array.isArray(gameState?.placedShipTypesByPlayer)) return
    const shipTypes = gameState.placedShipTypesByPlayer[selectors.localPlayerNumber - 1]
    placement.syncPlacedShipsForPlayer(selectors.localPlayerNumber, shipTypes)
  }, [
    gameState?.placedShipTypesByPlayer,
    selectors.localPlayerNumber,
    placement.syncPlacedShipsForPlayer,
  ])

  const camera = useCameraDirection({
    layoutSet,
    localPlayerNumber: selectors.localPlayerNumber,
    numPlayersInState: selectors.numPlayersInState,
    isPlayerInShootMode: selectors.isPlayerInShootMode,
    lobbyGameId: lobbyState.gameId,
  })

  useAiTurnDriver({
    enabled:
      screen === 'game'
      && Boolean(gameState)
      && !loading
      && selectors.currentIsAi
      && selectors.gamePhase === 'BATTLE',
    runAiStepAction: api.runAiStepAction,
    lobbyGameId: lobbyState.gameId,
    lobbyInLobby: lobbyState.inLobby,
    lobbyIsHost: lobbyState.isHost,
    onStatus: setStatusMessage,
    onAiAction: appendActionFeed,
  })

  usePlacementHotkeys({
    enabled: screen === 'game' && selectors.gamePhase === 'PLACEMENT',
    onRotate: placement.rotatePlacementOrientationClockwise,
  })

  const gameActions = useGameActions({
    api: { ...api, refreshSaves },
    ui: {
      setScreen,
      setLayoutSet,
      setStatusMessage,
      setLocalPlacementWaiting,
      loading,
      gameState,
    },
    setup,
    selectors,
    placement: {
      ...placement,
      canRemoveSelectedShip: placement.placedShips.some((ship) => ship.type === placement.selectedShipType),
      localPlacementLocked: localPlacementLockedOrWaiting,
    },
    lobby: lobbyApi,
    ws,
    battle: {
      battleSubState,
      setBattleSubState,
      selectedTargetBoardId,
      setSelectedTargetBoardId,
    },
    onBattleAction: appendActionFeed,
  })

  const lobbyActions = useLobbyActions({
    ws: { ...ws, state: ws.wsState },
    ui: { setStatusMessage },
    setup,
    lobby: { state: lobbyState, setLobbyState: lobbyApi.setLobbyState },
    handleStartGame: gameActions.handleStartGame,
  })

  const actions = { ...gameActions, ...lobbyActions }

  useEffect(() => {
    if (ws.wsMessage?.type !== 'SHOT_RESOLVED') return
    appendActionFeed(ws.wsMessage)
  }, [ws.wsMessage, appendActionFeed])

  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    const currentId = currentUrl.searchParams.get('gameId')
    const normalizedLobbyId = lobbyState?.gameId ? String(lobbyState.gameId).trim().toLowerCase() : ''
    const phaseState =
      screen === 'game'
        ? (selectors.gamePhase === 'GAME_OVER' ? 'finished' : 'active')
        : null
    if (normalizedLobbyId) {
      if (currentId !== normalizedLobbyId) {
        currentUrl.searchParams.set('gameId', normalizedLobbyId)
      }
      if (phaseState) currentUrl.searchParams.set('state', phaseState)
      else currentUrl.searchParams.delete('state')
      window.history.replaceState(null, '', currentUrl)
      return
    }
    if (currentId) {
      currentUrl.searchParams.delete('gameId')
      currentUrl.searchParams.delete('state')
      window.history.replaceState(null, '', currentUrl)
    }
  }, [lobbyState?.gameId, screen, selectors.gamePhase])

  useEffect(() => {
    if (screen !== 'menu' || lobbyState?.inLobby || autoJoinTriedRef.current) return
    const gameIdFromUrl = new URL(window.location.href).searchParams.get('gameId')
    const normalized = String(gameIdFromUrl ?? '').trim().toLowerCase()
    if (!normalized) return
    autoJoinTriedRef.current = true
    actions.handleJoinLobby(normalized, 'auto_resume')
    setStatusMessage(`Tentative de reconnexion a la partie ${normalized}...`)
  }, [screen, lobbyState?.inLobby, actions.handleJoinLobby])

  const gameSummary = getGameSummary(setup)
  const localPlacementCompleted = selectors.gamePhase === 'PLACEMENT' && localPlacementLockedOrWaiting
  const shouldShowShootModePrompt = selectors.shouldOfferShootMode && !shoot.shootModeActive
  const isFourPlayerBattle = selectors.gamePhase === 'BATTLE' && selectors.numPlayersInState > 2
  const syncedTargetPlayer = lobbyState?.gameplaySync?.targetPlayer ?? null
  const effectiveCurrentTargetPlayer = selectors.currentTargetPlayer ?? syncedTargetPlayer
  const syncedTargetBoardId = effectiveCurrentTargetPlayer
    ? selectors.boards[effectiveCurrentTargetPlayer - 1]?.boardId ?? null
    : null
  const effectiveSelectedTargetBoardId = selectedTargetBoardId ?? syncedTargetBoardId
  const remoteFiringView = isFourPlayerBattle
    && !selectors.isLocalTurn
    && lobbyState?.gameplaySync?.phaseStep === 'firing'
    && Boolean(syncedTargetBoardId)
  const shouldUseGlobalTopDownView = isFourPlayerBattle
    && (!selectors.isLocalTurn || battleSubState === 'target_selection')
  const shouldShowPlacementConfirmPrompt =
    selectors.gamePhase === 'PLACEMENT' && !localPlacementLockedOrWaiting && placement.remainingShips.length === 0

  if (screen === 'menu') {
    return (
      <MenuScreen
        setup={setup}
        availableSaves={availableSaves}
        onChange={applySetupPatch}
        onStart={actions.handleStartGame}
        onStartLobbyGame={actions.handleStartLobbyGame}
        onCreateLobby={actions.handleCreateLobby}
        onJoinLobby={actions.handleJoinLobby}
        onRefreshSaves={refreshSaves}
        onLoadFromSaveFile={actions.handleLoadFromSaveFile}
        onLeaveLobby={actions.handleLeaveLobby}
        onUpdateLobbyConfig={ws.updateLobbyConfig}
        loading={loading}
        wsConnected={ws.wsState.connected}
        ensureWs={ws.ensureConnected}
        lobby={lobbyState}
        statusMessage={statusMessage}
      />
    )
  }

  return (
    <GameScreen
      gameSummary={gameSummary}
      lobbyPartLabel={selectors.lobbyPartLabel}
      localPlayerNumber={selectors.localPlayerNumber}
      clientOwnBoardId={selectors.clientOwnBoardId}
      cameraDirectionLabel={camera.cameraDirectionLabel}
      setup={setup}
      loading={loading}
      applySetupPatch={applySetupPatch}
      onBackToMenu={actions.handleBackToMenu}
      onSaveCurrentGame={actions.handleSaveCurrentGame}
      onCellClick={actions.handleCellClick}
      onCellHover={(cell) => placement.handleCellHover(cell, selectors.expectedOwnBoardId)}
      onConfirmPlacement={actions.handleConfirmPlacement}
      onRemoveSelectedShip={actions.handleRemoveSelectedShip}
      onEnterShootMode={shoot.enterShootMode}
      onCompassDirectionClick={camera.handleCompassDirectionClick}
      onCameraDirectionChange={camera.setCameraFacingDirection}
      turnOverlayLabel={selectors.turnOverlayLabel}
      isGameOver={selectors.isGameOver}
      didLocalPlayerWin={selectors.didLocalPlayerWin}
      gamePhase={selectors.gamePhase}
      showCoordinates={showCoordinates}
      toggleCoordinates={() => setShowCoordinates((value) => !value)}
      errorMessage={errorMessage}
      cameraFacingDirection={camera.cameraFacingDirection}
      canChooseCameraDirection={camera.canChooseCameraDirection}
      shouldShowShootModePrompt={shouldShowShootModePrompt}
      shootModeButtonUnlocked={shoot.shootModeButtonUnlocked}
      shootModeProgress={shoot.shootModeProgress}
      shouldShowPlacementConfirmPrompt={shouldShowPlacementConfirmPrompt}
      localPlacementCompleted={localPlacementCompleted}
      localPlacementLocked={localPlacementLockedOrWaiting}
      showShipSelectionRow={placement.remainingShips.length > 0 || placement.removalModeEnabled}
      selectedShipType={placement.selectedShipType}
      setSelectedShipType={placement.setSelectedShipType}
      selectableShips={placement.removalModeEnabled ? placement.placedShips : placement.remainingShips}
      canRemoveSelectedShip={placement.placedShips.some((ship) => ship.type === placement.selectedShipType)}
      removalModeEnabled={placement.removalModeEnabled}
      setRemovalModeEnabled={placement.setRemovalModeEnabled}
      placementOrientation={placement.placementOrientation}
      setPlacementOrientation={placement.setPlacementOrientation}
      remainingShipsCount={placement.remainingShips.length}
      expectedOwnBoardId={selectors.expectedOwnBoardId}
      selectedShipLabel={placement.selectedShipLabel}
      boards={selectors.boards}
      aiBoardIds={selectors.aiBoardIds}
      isDuelWithAi={selectors.isDuelWithAi}
      effectiveCameraDirection={camera.effectiveCameraDirection}
      cameraStateKey={camera.cameraStateKey}
      boardSize={selectors.boardSize}
      boardStatesById={selectors.boardStatesById}
      recentImpactsByBoard={recentImpactsByBoard}
      opponentPresence={lobbyState?.opponentPresence}
      interactiveBoards={selectors.interactiveBoards}
      selectedTargetBoardId={effectiveSelectedTargetBoardId}
      currentTargetPlayer={effectiveCurrentTargetPlayer}
      placementPreview={placement.placementPreview}
      waveMode="gpu"
      benchmarkEnabled={false}
      actionFeed={actionFeed}
      targetSelectionView={shouldUseGlobalTopDownView}
      topDownView={
        (selectors.isPlayerInShootMode && shoot.shootModeActive)
        || isFourPlayerBattle
        || remoteFiringView
      }
    />
  )
}
