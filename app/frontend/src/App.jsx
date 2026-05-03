import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import BoardScene from './components/BoardScene'
import GameSetupMenu from './components/GameSetupMenu'
import LayoutControls from './components/LayoutControls'
import { BOARD_CONFIGS } from './config/boardConfigs'
import useGameApi from './hooks/useGameApi'
import usePlacement from './hooks/usePlacement'
import useWebSocketGame from './hooks/useWebSocketGame'

const LAST_SETUP_KEY = 'bataille-navale:last-setup'

const DEFAULT_SETUP = {
  startMode: 'new',
  loadSaveFile: 'bataille-navale',
  saveFileName: 'bataille-navale',
  boardSize: 10,
  fleetShipSizes: [5, 4, 3, 3, 2],
  playerCount: 2,
  humanPlayers: 2,
  withAI: false,
}

function normalizeSetup(setup) {
  const playerCount = setup.playerCount === 4 ? 4 : 2
  const boardSize = Math.max(5, Number(setup.boardSize) || 10)
  const fleetShipSizes = Array.isArray(setup.fleetShipSizes) && setup.fleetShipSizes.length > 0
    ? setup.fleetShipSizes.map((size) => Math.max(1, Number(size) || 1))
    : [5, 4, 3, 3, 2]
  const withAI = Boolean(setup.withAI)
  const humanPlayers = withAI
    ? Math.min(Math.max(1, Number(setup.humanPlayers) || 1), playerCount - 1 || 1)
    : playerCount

  return {
    ...DEFAULT_SETUP,
    ...setup,
    boardSize,
    fleetShipSizes,
    playerCount,
    humanPlayers,
    withAI,
    startMode: setup.startMode === 'load' ? 'load' : 'new',
    loadSaveFile: setup.loadSaveFile?.trim() ? setup.loadSaveFile.trim() : DEFAULT_SETUP.loadSaveFile,
    saveFileName: setup.saveFileName?.trim() ? setup.saveFileName.trim() : DEFAULT_SETUP.saveFileName,
  }
}

function loadLastSetupFromStorage() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_SETUP_KEY)
    if (!raw) return null
    return normalizeSetup(JSON.parse(raw))
  } catch {
    return null
  }
}

function saveLastSetupToStorage(setup) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_SETUP_KEY, JSON.stringify(setup))
}

function App() {
  const [screen, setScreen] = useState('menu')
  const [layoutSet, setLayoutSet] = useState('faceoff')
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [waveMode, setWaveMode] = useState('gpu')
  const [benchmarkEnabled, setBenchmarkEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Initialisation de la partie...')
  const [setup, setSetup] = useState(DEFAULT_SETUP)
  const [availableSaves, setAvailableSaves] = useState([])
  const {
    gameState,
    loading,
    errorMessage,
    bootstrapGame,
    placeShipAction,
    fireAtAction,
    listSavesAction,
    loadGameAction,
    saveGameAction,
  } = useGameApi()

  useEffect(() => {
    const lastSetup = loadLastSetupFromStorage()
    if (lastSetup) {
      setSetup((current) => normalizeSetup({ ...current, ...lastSetup }))
    }
  }, [])

  const refreshSaves = useCallback(async () => {
    try {
      const saves = await listSavesAction()
      setAvailableSaves(saves)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [listSavesAction])

  useEffect(() => {
    refreshSaves()
  }, [refreshSaves])

  useEffect(() => {
    saveLastSetupToStorage(setup)
  }, [setup])

  const boards = useMemo(() => {
    return BOARD_CONFIGS[layoutSet]
  }, [layoutSet])

  const currentPlayer = gameState?.currentPlayer ?? 1
  const gamePhase = gameState?.phase
  const boardSize = gameState?.boardSize ?? setup.boardSize ?? 10
  const boardStatesById = useMemo(() => {
    const stateById = {}
    if (!gameState?.boards) return stateById
    for (const board of gameState.boards) {
      stateById[board.boardId] = board
    }
    return stateById
  }, [gameState])

  const expectedOwnBoardId = useMemo(() => {
    if (boards.length === 0) return 'A1'
    const boardIndex = Math.min(Math.max(currentPlayer - 1, 0), boards.length - 1)
    return boards[boardIndex]?.boardId ?? 'A1'
  }, [boards, currentPlayer])
  const expectedTargetBoardId = useMemo(() => {
    if (boards.length <= 1) return expectedOwnBoardId
    return boards.find((board) => board.boardId !== expectedOwnBoardId)?.boardId ?? expectedOwnBoardId
  }, [boards, expectedOwnBoardId])
  const {
    selectedShipType,
    selectedShipLabel,
    setSelectedShipType,
    placementOrientation,
    setPlacementOrientation,
    remainingShips,
    placementPreview,
    handlePlacementSuccess,
    handleCellHover,
    resetPlacement,
  } = usePlacement({
    currentPlayer,
    gamePhase,
    boardSize,
    fleetShipSizes: setup.fleetShipSizes,
  })

  const interactiveBoards = useMemo(() => {
    if (!gameState) return {}
    if (gamePhase === 'PLACEMENT') {
      return { [expectedOwnBoardId]: true }
    }
    if (gamePhase !== 'BATTLE') return {}
    return {
      [expectedTargetBoardId]: true,
    }
  }, [expectedTargetBoardId, expectedOwnBoardId, gameState, gamePhase])

  const applySetupPatch = useCallback((patch) => {
    setSetup((current) => normalizeSetup({ ...current, ...patch }))
  }, [])

  const handleStartGame = useCallback(async () => {
    const effectiveSetup = normalizeSetup(setup)
    const nextLayoutSet = effectiveSetup.playerCount === 4 ? 'star4' : 'faceoff'

    try {
      setStatusMessage('Demarrage de la partie...')
      setLayoutSet(nextLayoutSet)
      if (effectiveSetup.startMode === 'load') {
        await loadGameAction(effectiveSetup.loadSaveFile)
      } else {
        await bootstrapGame(effectiveSetup.boardSize, effectiveSetup.fleetShipSizes)
      }
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
  }, [setup, bootstrapGame, loadGameAction, resetPlacement])

  const handleSaveCurrentGame = useCallback(async () => {
    try {
      await saveGameAction(setup.saveFileName)
      await refreshSaves()
      setStatusMessage(`Partie enregistree dans saves/${setup.saveFileName}.save`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [saveGameAction, setup.saveFileName, refreshSaves])

  const handleBackToMenu = useCallback(() => {
    setScreen('menu')
    setStatusMessage('Menu de configuration ouvert.')
  }, [])

  const handleCellClick = useCallback(async ({ boardId, x, y, label }) => {
    if (loading || !gameState) return
    if (!interactiveBoards[boardId]) {
      if (gamePhase === 'PLACEMENT') {
        setStatusMessage(`Joueur ${currentPlayer}: placez sur votre grille ${expectedOwnBoardId}.`)
      } else {
        setStatusMessage(`Joueur ${currentPlayer}: vous devez tirer sur la grille ${expectedTargetBoardId}.`)
      }
      return
    }
    try {
      let result = null
      if (gamePhase === 'PLACEMENT') {
        if (remainingShips.length === 0) {
          setStatusMessage(`Joueur ${currentPlayer}: tous vos navires sont deja poses.`)
          return
        }
        result = await placeShipAction({
          player: currentPlayer,
          shipType: selectedShipType,
          x,
          y,
          orientation: placementOrientation,
        })
        handlePlacementSuccess(currentPlayer, selectedShipType)
        if (result.state.phase === 'BATTLE') {
          setStatusMessage('Tous les navires sont places. Debut de la bataille, joueur 1.')
        } else {
          setStatusMessage(
            `Navire ${selectedShipLabel} place sur ${boardId} ${label}. Joueur ${result.state.currentPlayer} continue.`,
          )
        }
      } else if (gamePhase === 'BATTLE') {
        result = await fireAtAction({
          player: currentPlayer,
          x,
          y,
        })
        const targetLabel = `${boardId} ${label}`
        if (result.state.phase === 'GAME_OVER') {
          setStatusMessage(`Joueur ${result.state.winner} gagne. Dernier tir ${targetLabel}: ${result.result}.`)
        } else {
          setStatusMessage(
            `Tir ${targetLabel}: ${result.result}. Tour du joueur ${result.state.currentPlayer}.`,
          )
        }
      }
      if (!result) return
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading,
    gameState,
    interactiveBoards,
    gamePhase,
    currentPlayer,
    expectedOwnBoardId,
    expectedTargetBoardId,
    remainingShips.length,
    placeShipAction,
    selectedShipType,
    selectedShipLabel,
    placementOrientation,
    handlePlacementSuccess,
    fireAtAction,
  ])

  const onCellHover = useCallback((cellData) => {
    handleCellHover(cellData, expectedOwnBoardId)
  }, [handleCellHover, expectedOwnBoardId])

  // --- WebSocket integration ---
  const { wsState, wsMessage, createGame, joinGame, send } = useWebSocketGame()

  // Example: auto-create a game on mount (for demo)
  useEffect(() => {
    if (wsState.connected && !wsState.gameId) {
      createGame(4) // or prompt user for number of players
    }
  }, [wsState.connected, wsState.gameId, createGame])

  // Example: show WebSocket status
  useEffect(() => {
    if (wsMessage?.type === 'GAME_CREATED') {
      setStatusMessage(`Partie créée. ID: ${wsMessage.gameId}`)
    } else if (wsMessage?.type === 'JOINED_GAME') {
      setStatusMessage(`Rejoint la partie. ID: ${wsMessage.gameId}`)
    } else if (wsMessage?.type === 'ERROR') {
      setStatusMessage(`Erreur WebSocket: ${wsMessage.message}`)
    }
  }, [wsMessage])

  const gameSummary = useMemo(() => {
    return `${setup.boardSize}x${setup.boardSize} · ${setup.playerCount} joueurs · ${setup.humanPlayers} humains${setup.withAI ? ` · ${setup.playerCount - setup.humanPlayers} IA` : ''} · ${setup.fleetShipSizes.length} navires`
  }, [setup])

  if (screen === 'menu') {
    return (
      <GameSetupMenu
        setup={setup}
        availableSaves={availableSaves}
        onChange={applySetupPatch}
        onStart={handleStartGame}
        onRefreshSaves={refreshSaves}
        loading={loading}
        statusMessage={statusMessage}
      />
    )
  }

  return (
    <main className="app-root">
      <LayoutControls
        layoutSet={layoutSet}
        showCoordinates={showCoordinates}
        waveMode={waveMode}
        benchmarkEnabled={benchmarkEnabled}
        onLayoutChange={setLayoutSet}
        onToggleCoordinates={() => setShowCoordinates((value) => !value)}
        onToggleWaveMode={() => setWaveMode((value) => (value === 'gpu' ? 'cpu' : 'gpu'))}
        onToggleBenchmark={() => setBenchmarkEnabled((value) => !value)}
        onOpenMenu={handleBackToMenu}
      />
      <div className="game-banner">
        <div className="game-banner__summary">{gameSummary}</div>
        <button type="button" className="game-banner__button" onClick={handleBackToMenu}>
          Retour au menu
        </button>
      </div>
      <div className="save-panel">
        <input
          type="text"
          value={setup.saveFileName}
          onChange={(event) => applySetupPatch({ saveFileName: event.target.value })}
          placeholder="bataille-navale"
        />
        <button type="button" className="menu-button menu-button--secondary" onClick={handleSaveCurrentGame} disabled={loading}>
          Enregistrer la partie
        </button>
      </div>
      <div className="shot-feedback">
        {statusMessage} {loading ? 'Chargement...' : ''}
      </div>
      {gamePhase === 'PLACEMENT' && (
        <div className="placement-panel">
          <div className="placement-panel__title">{`Placement manuel - Joueur ${currentPlayer}`}</div>
          <div className="placement-panel__row">
            <label htmlFor="ship-select">Navire</label>
            <select
              id="ship-select"
              value={selectedShipType}
              onChange={(event) => setSelectedShipType(event.target.value)}
              disabled={remainingShips.length === 0}
            >
              {remainingShips.map((ship) => (
                <option key={ship.type} value={ship.type}>
                  {ship.label} ({ship.size} cases)
                </option>
              ))}
            </select>
          </div>
          <div className="placement-panel__row">
            <button
              type="button"
              className={placementOrientation === 'HORIZONTAL' ? 'active' : ''}
              onClick={() => setPlacementOrientation('HORIZONTAL')}
            >
              Horizontal
            </button>
            <button
              type="button"
              className={placementOrientation === 'VERTICAL' ? 'active' : ''}
              onClick={() => setPlacementOrientation('VERTICAL')}
            >
              Vertical
            </button>
          </div>
          <div className="placement-panel__hint">
            {remainingShips.length > 0
              ? `Cliquez sur la grille ${expectedOwnBoardId} pour poser ${selectedShipLabel}.`
              : `Tous les navires du joueur ${currentPlayer} sont poses.`}
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="shot-feedback shot-feedback--error">
          Erreur: {errorMessage}
        </div>
      )}
      <BoardScene
        boards={boards}
        boardSize={boardSize}
        boardSize={boardSize}
        boardStatesById={boardStatesById}
        interactiveBoards={interactiveBoards}
        previewCells={placementPreview}
        previewBoardId={expectedOwnBoardId}
        showCoordinates={showCoordinates}
        waveMode={waveMode}
        benchmarkEnabled={benchmarkEnabled}
        onCellHover={onCellHover}
        onCellClick={handleCellClick}
      />
    </main>
  )
}

export default App
