import { useCallback, useEffect, useMemo, useState } from 'react'

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

  const placement = usePlacement({
    currentPlayer: gameState?.currentPlayer ?? 1,
    gamePhase: gameState?.phase,
    boardSize: gameState?.boardSize ?? setup.boardSize ?? 10,
    fleetShipSizes: setup.fleetShipSizes,
  })

  // Pre-calcul de l'identifiant de plateau du joueur local (necessaire avant
  // useEnemyImpactReveal). Le selecteur final (`useGameSelectors`) memorise la
  // meme derivation, mais on l'instancie ici en amont pour briser le cycle.
  const preliminaryLocalPlayerNumber = useMemo(
    () => getLocalPlayerNumber({
      lobbyState: { inLobby: false, playerNumber: 1 },
      gameState,
      currentPlayer: gameState?.currentPlayer ?? 1,
    }),
    [gameState],
  )
  const preliminaryBoards = useMemo(() => BOARD_CONFIGS[layoutSet], [layoutSet])
  const preliminaryExpectedOwnBoardId = useMemo(
    () => getExpectedOwnBoardId({ boards: preliminaryBoards, localPlayerNumber: preliminaryLocalPlayerNumber }),
    [preliminaryBoards, preliminaryLocalPlayerNumber],
  )
  const preliminaryClientOwnBoardId = useMemo(
    () => getClientOwnBoardId({ gameState, expectedOwnBoardId: preliminaryExpectedOwnBoardId }),
    [gameState, preliminaryExpectedOwnBoardId],
  )

  const placementLockedByPlayer = gameState?.placementLockedByPlayer ?? []
  const localPlacementLocked = Boolean(
    placementLockedByPlayer[preliminaryLocalPlayerNumber - 1],
  )

  const enemyImpactReveal = useEnemyImpactReveal({
    gameState,
    clientOwnBoardId: preliminaryClientOwnBoardId,
    onStatus: setStatusMessage,
  })
  const { delayedOwnBoardCells, recentImpactsByBoard } = enemyImpactReveal

  const lobbyApi = useLobbyState({
    wsMessage: ws.wsMessage,
    screen,
    fallbackPlayerCount: setup.playerCount,
    refreshStateAction: api.refreshStateAction,
    syncStateAction: api.syncStateAction,
    enterGameScreenWithState: (state, status) => {
      const playerCountFromState = state?.boards?.length === 4 ? 4 : 2
      setLayoutSet(playerCountFromState === 4 ? 'star4' : 'faceoff')
      placement.resetPlacement()
      setScreen('game')
      if (status) setStatusMessage(status)
    },
    onStatus: setStatusMessage,
  })
  const { lobbyState } = lobbyApi

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
      localPlacementLocked,
    },
    shoot: { shootModeActive: shoot.shootModeActive },
  })

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
      && selectors.isDuelWithAi
      && Boolean(gameState)
      && !loading
      && selectors.currentIsAi
      && selectors.gamePhase === 'BATTLE',
    runAiStepAction: api.runAiStepAction,
    lobbyGameId: lobbyState.gameId,
    lobbyInLobby: lobbyState.inLobby,
    onStatus: setStatusMessage,
  })

  usePlacementHotkeys({
    enabled: screen === 'game' && selectors.gamePhase === 'PLACEMENT',
    onRotate: placement.rotatePlacementOrientationClockwise,
  })

  const actions = useGameActions({
    api: { ...api, refreshSaves },
    ui: { setScreen, setLayoutSet, setStatusMessage, loading, gameState },
    setup,
    selectors,
    placement: {
      ...placement,
      canRemoveSelectedShip: placement.placedShips.some((ship) => ship.type === placement.selectedShipType),
      localPlacementLocked,
    },
    lobby: lobbyApi,
    ws,
  })

  const gameSummary = getGameSummary(setup)
  const localPlacementCompleted = selectors.gamePhase === 'PLACEMENT' && localPlacementLocked
  const shouldShowShootModePrompt = selectors.shouldOfferShootMode && !shoot.shootModeActive
  const shouldShowPlacementConfirmPrompt =
    selectors.gamePhase === 'PLACEMENT' && !localPlacementLocked && placement.remainingShips.length === 0

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
      localPlacementLocked={localPlacementLocked}
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
      topDownView={selectors.isPlayerInShootMode && shoot.shootModeActive}
      effectiveCameraDirection={camera.effectiveCameraDirection}
      cameraStateKey={camera.cameraStateKey}
      boardSize={selectors.boardSize}
      boardStatesById={selectors.boardStatesById}
      recentImpactsByBoard={recentImpactsByBoard}
      interactiveBoards={selectors.interactiveBoards}
      placementPreview={placement.placementPreview}
      waveMode="gpu"
      benchmarkEnabled={false}
    />
  )
}
