import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import BoardScene from './components/BoardScene'
import GameSetupMenu from './components/GameSetupMenu'
import LayoutControls from './components/LayoutControls'
import { BOARD_CONFIGS } from './config/boardConfigs'
import useGameApi from './hooks/useGameApi'
import usePlacement from './hooks/usePlacement'
import useWebSocketGame from './hooks/useWebSocketGame'

const LAST_SETUP_KEY = 'bataille-navale:last-setup'

const BOARD_ID_TO_PLAYER = {
  A1: 1,
  B1: 2,
  C1: 3,
  D1: 4,
}

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
const AI_STEP_DELAY_MS = 500
const IMPACT_FLASH_MS = 700

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
  const [showCoordinates, setShowCoordinates] = useState(true)
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
    refreshStateAction,
    syncStateAction,
    runAiStepAction,
  } = useGameApi()
  const aiStepLockRef = useRef(false)
  const previousGameStateRef = useRef(null)
  const impactClearTimerRef = useRef(null)
  const [recentImpactsByBoard, setRecentImpactsByBoard] = useState({})
  const [lobbyState, setLobbyState] = useState({
    inLobby: false,
    isHost: false,
    gameId: null,
    players: 0,
    maxPlayers: 0,
    playerNumber: 1,
  })

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
  const localPlayerNumber = lobbyState?.inLobby ? (lobbyState.playerNumber ?? 1) : currentPlayer
  const isLocalTurn = currentPlayer === localPlayerNumber
  const currentIsAi = useMemo(
    () => Array.isArray(gameState?.aiPlayers) && Boolean(gameState.aiPlayers[currentPlayer - 1]),
    [gameState, currentPlayer],
  )
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
    const boardIndex = Math.min(Math.max(localPlayerNumber - 1, 0), boards.length - 1)
    return boards[boardIndex]?.boardId ?? 'A1'
  }, [boards, localPlayerNumber])
  const clientOwnBoardId = useMemo(() => {
    const own = gameState?.boards?.find((board) => board.ownBoard)
    return own?.boardId ?? expectedOwnBoardId
  }, [gameState, expectedOwnBoardId])
  const aiBoardIds = useMemo(() => {
    const ids = new Set()
    if (!Array.isArray(gameState?.aiPlayers)) return ids
    for (let i = 0; i < boards.length; i += 1) {
      if (!gameState.aiPlayers[i]) continue
      const boardId = boards[i]?.boardId
      if (boardId) ids.add(boardId)
    }
    return ids
  }, [boards, gameState])
  const isDuelWithAi = useMemo(() => {
    if (!Array.isArray(gameState?.aiPlayers)) return false
    if ((gameState?.boards?.length ?? 0) !== 2) return false
    const aiCount = gameState.aiPlayers.filter(Boolean).length
    return aiCount === 1
  }, [gameState])
  const numPlayersInState = gameState?.boards?.length ?? 0
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
    currentPlayer: localPlayerNumber,
    gamePhase,
    boardSize,
    fleetShipSizes: setup.fleetShipSizes,
  })
  const turnOverlayLabel = useMemo(() => {
    if (gamePhase === 'PLACEMENT') {
      if (isDuelWithAi && !currentIsAi && remainingShips.length === 0) {
        return "Placement de l'IA en cours..."
      }
      if (isDuelWithAi) {
        return currentIsAi ? "Tour de l'IA - placement" : 'Votre tour - placement'
      }
      return isLocalTurn ? 'Votre tour - placement' : `Tour du joueur ${currentPlayer} - placement`
    }
    if (gamePhase === 'BATTLE') {
      if (isDuelWithAi) {
        return currentIsAi ? "Tour de l'IA - tir" : 'Votre tour - tirez sur la grille adverse'
      }
      if (currentIsAi) return `Tour de l'IA ${currentPlayer}`
      return isLocalTurn ? 'Votre tour - tir' : `Tour du joueur ${currentPlayer}`
    }
    if (gamePhase === 'GAME_OVER') {
      return gameState?.winner === 1 ? 'Victoire' : 'Defaite'
    }
    return currentIsAi ? "Tour de l'IA" : 'Votre tour'
  }, [isDuelWithAi, gamePhase, currentIsAi, remainingShips.length, gameState?.winner, currentPlayer, isLocalTurn])

  const interactiveBoards = useMemo(() => {
    if (!gameState) return {}
    if (currentIsAi) {
      return {}
    }
    if (lobbyState.inLobby && gamePhase === 'BATTLE' && !isLocalTurn) {
      return {}
    }
    if (gamePhase === 'PLACEMENT') {
      return { [expectedOwnBoardId]: true }
    }
    if (gamePhase !== 'BATTLE') return {}
    const alive = gameState.playersAlive
    const n = Math.min(numPlayersInState, boards.length)
    const next = {}
    for (let i = 0; i < n; i += 1) {
      const pid = i + 1
      if (pid === localPlayerNumber) continue
      const isAlive = !alive || alive[i] !== false
      if (!isAlive) continue
      const boardId = boards[i]?.boardId
      if (boardId) next[boardId] = true
    }
    return next
  }, [numPlayersInState, boards, gameState, gamePhase, expectedOwnBoardId, currentIsAi, lobbyState.inLobby, isLocalTurn, localPlayerNumber])

  const applySetupPatch = useCallback((patch) => {
    setSetup((current) => normalizeSetup({ ...current, ...patch }))
  }, [])

  const handleStartGame = useCallback(async () => {
    const effectiveSetup = normalizeSetup(setup)
    const nextLayoutSet = effectiveSetup.playerCount === 4 ? 'star4' : 'faceoff'

    try {
      setStatusMessage('Demarrage de la partie...')
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
        )
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

  const enterGameScreenWithState = useCallback((state, status) => {
    const playerCountFromState = state?.boards?.length === 4 ? 4 : 2
    setLayoutSet(playerCountFromState === 4 ? 'star4' : 'faceoff')
    resetPlacement()
    setScreen('game')
    if (status) setStatusMessage(status)
  }, [resetPlacement])

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
      if (currentIsAi && gamePhase === 'PLACEMENT') {
        setStatusMessage(`Tour du joueur automatique (${currentPlayer})...`)
        return
      }
      if (currentIsAi && gamePhase === 'BATTLE') {
        setStatusMessage(`Tour de l'ordinateur (${currentPlayer})...`)
        return
      }
      if (gamePhase === 'PLACEMENT') {
        setStatusMessage(`Joueur ${currentPlayer}: placez sur votre grille ${expectedOwnBoardId}.`)
      } else if (numPlayersInState > 2) {
        setStatusMessage(`Joueur ${currentPlayer}: choisissez une grille adverse encore en jeu.`)
      } else {
        setStatusMessage(`Joueur ${currentPlayer}: tirez sur la grille adverse.`)
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
          player: localPlayerNumber,
          shipType: selectedShipType,
          x,
          y,
          orientation: placementOrientation,
        })
        handlePlacementSuccess(localPlayerNumber, selectedShipType)
        if (result.state.phase === 'BATTLE') {
          const n = result.state.boards?.length ?? 0
          setStatusMessage(
            n > 2
              ? 'Tous les navires sont places. Debut de la bataille, joueur 1. Cliquez sur une grille adverse encore en jeu pour tirer.'
              : 'Tous les navires sont places. Debut de la bataille, joueur 1.',
          )
        } else {
          setStatusMessage(
            `Navire ${selectedShipLabel} place sur ${boardId} ${label}. Joueur ${result.state.currentPlayer} continue.`,
          )
        }
      } else if (gamePhase === 'BATTLE') {
        const targetPlayer = BOARD_ID_TO_PLAYER[boardId]
        result = await fireAtAction({
          player: localPlayerNumber,
          x,
          y,
          targetPlayer: numPlayersInState > 2 ? targetPlayer : undefined,
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
    localPlayerNumber,
    expectedOwnBoardId,
    numPlayersInState,
    remainingShips.length,
    placeShipAction,
    selectedShipType,
    selectedShipLabel,
    placementOrientation,
    handlePlacementSuccess,
    fireAtAction,
    currentIsAi,
  ])

  const onCellHover = useCallback((cellData) => {
    handleCellHover(cellData, expectedOwnBoardId)
  }, [handleCellHover, expectedOwnBoardId])

  useEffect(() => {
    if (screen !== 'game' || !isDuelWithAi || !gameState || loading || !currentIsAi || gamePhase !== 'BATTLE') return
    if (aiStepLockRef.current) return
    aiStepLockRef.current = true
    setStatusMessage("Tour de l'IA...")
    const timerId = window.setTimeout(async () => {
      try {
        await runAiStepAction()
      } catch {
        // L'erreur est geree dans le hook API.
      } finally {
        aiStepLockRef.current = false
      }
    }, AI_STEP_DELAY_MS)
    return () => {
      window.clearTimeout(timerId)
      aiStepLockRef.current = false
    }
  }, [screen, isDuelWithAi, gameState, loading, currentIsAi, gamePhase, runAiStepAction])

  useEffect(() => {
    const previous = previousGameStateRef.current
    previousGameStateRef.current = gameState
    if (!gameState || !previous || gameState.phase !== 'BATTLE') return
    const ownBoard = gameState.boards?.find((board) => board.ownBoard)
    const previousOwnBoard = previous.boards?.find((board) => board.ownBoard)
    if (!ownBoard?.cells || !previousOwnBoard?.cells) return

    const impacts = []
    for (let y = 0; y < ownBoard.cells.length; y += 1) {
      const row = ownBoard.cells[y] ?? []
      const previousRow = previousOwnBoard.cells[y] ?? []
      for (let x = 0; x < row.length; x += 1) {
        const nextCell = row[x]
        const prevCell = previousRow[x]
        if (nextCell === prevCell) continue
        if (nextCell === 'MISS' || nextCell === 'HIT' || nextCell === 'SUNK') {
          impacts.push({ x, y, type: nextCell })
        }
      }
    }
    if (impacts.length === 0) return

    setRecentImpactsByBoard({ [ownBoard.boardId]: impacts })
    const last = impacts[impacts.length - 1]
    if (last.type === 'SUNK') {
      setStatusMessage('Votre flotte a subi un coup critique (navire coule).')
    } else if (last.type === 'HIT') {
      setStatusMessage('Alerte: l’ennemi a touche votre grille.')
    } else {
      setStatusMessage("L'ennemi a tire sans toucher.")
    }
    if (impactClearTimerRef.current) {
      window.clearTimeout(impactClearTimerRef.current)
    }
    impactClearTimerRef.current = window.setTimeout(() => {
      setRecentImpactsByBoard({})
      impactClearTimerRef.current = null
    }, IMPACT_FLASH_MS)
  }, [gameState])

  // --- WebSocket integration ---
  const { wsState, wsMessage, createGame, joinGame, startGame } = useWebSocketGame()

  const handleCreateLobby = useCallback((maxPlayers) => {
    createGame(maxPlayers)
  }, [createGame])

  const handleJoinLobby = useCallback((gameId) => {
    const trimmed = gameId?.trim()
    if (!trimmed) return
    joinGame(trimmed)
  }, [joinGame])

  const handleStartLobbyGame = useCallback(async () => {
    if (!lobbyState.isHost || !lobbyState.gameId) return
    try {
      await handleStartGame()
      startGame(lobbyState.gameId)
    } catch {
      // L'erreur est deja geree dans handleStartGame.
    }
  }, [handleStartGame, lobbyState.isHost, lobbyState.gameId, startGame])

  // Example: show WebSocket status
  useEffect(() => {
    if (wsMessage?.type === 'GAME_CREATED') {
      setStatusMessage(`Partie créée. ID: ${wsMessage.gameId}`)
      setLobbyState({
        inLobby: true,
        isHost: true,
        gameId: wsMessage.gameId ?? null,
        players: wsMessage.players ?? 1,
        maxPlayers: wsMessage.maxPlayers ?? setup.playerCount,
        playerNumber: wsMessage.playerNumber ?? 1,
      })
    } else if (wsMessage?.type === 'JOINED_GAME') {
      setStatusMessage(`Rejoint la partie. ID: ${wsMessage.gameId}`)
      setLobbyState({
        inLobby: true,
        isHost: false,
        gameId: wsMessage.gameId ?? null,
        players: wsMessage.players ?? 1,
        maxPlayers: wsMessage.maxPlayers ?? setup.playerCount,
        playerNumber: wsMessage.playerNumber ?? 1,
      })
    } else if (wsMessage?.type === 'PLAYER_COUNT_UPDATED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        return {
          ...current,
          players: wsMessage.players ?? current.players,
          maxPlayers: wsMessage.maxPlayers ?? current.maxPlayers,
        }
      })
      setStatusMessage(`Lobby ${wsMessage.gameId}: ${wsMessage.players}/${wsMessage.maxPlayers} joueurs.`)
    } else if (wsMessage?.type === 'GAME_STARTED') {
      if (lobbyState.isHost) {
        return
      }
      refreshStateAction(lobbyState.playerNumber ?? 1)
        .then((state) => enterGameScreenWithState(state, 'Partie lancee par l hote.'))
        .catch(() => setStatusMessage('Impossible de charger la partie demarree par l hote.'))
    } else if (wsMessage?.type === 'ERROR') {
      setStatusMessage(`Erreur WebSocket: ${wsMessage.message}`)
    }
  }, [wsMessage, setup.playerCount, lobbyState.isHost, lobbyState.playerNumber, refreshStateAction, enterGameScreenWithState])

  const gameSummary = useMemo(() => {
    return `${setup.boardSize}x${setup.boardSize} · ${setup.playerCount} joueurs · ${setup.humanPlayers} humains${setup.withAI ? ` · ${setup.playerCount - setup.humanPlayers} IA` : ''} · ${setup.fleetShipSizes.length} navires`
  }, [setup])

  useEffect(() => {
    if (screen !== 'game' || !lobbyState.inLobby) return
    const pollId = window.setInterval(() => {
      syncStateAction(localPlayerNumber).catch(() => {
        // Evite de casser l'UI en cas de latence/requete ratee.
      })
    }, 800)
    return () => window.clearInterval(pollId)
  }, [screen, lobbyState.inLobby, localPlayerNumber, syncStateAction])

  if (screen === 'menu') {
    return (
      <GameSetupMenu
        setup={setup}
        availableSaves={availableSaves}
        onChange={applySetupPatch}
        onStart={handleStartGame}
        onStartLobbyGame={handleStartLobbyGame}
        onCreateLobby={handleCreateLobby}
        onJoinLobby={handleJoinLobby}
        onRefreshSaves={refreshSaves}
        loading={loading}
        wsConnected={wsState.connected}
        lobby={lobbyState}
        statusMessage={statusMessage}
      />
    )
  }

  return (
    <main className="app-root">
      <LayoutControls
        showCoordinates={showCoordinates}
        onToggleCoordinates={() => setShowCoordinates((value) => !value)}
      />
      <div className="game-banner">
        <div className="game-banner__summary">
          {gameSummary} · Vous etes joueur {localPlayerNumber} · Votre grille: {clientOwnBoardId}
        </div>
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
      {turnOverlayLabel && (
        <div className="turn-banner">
          {turnOverlayLabel}
        </div>
      )}
      {gamePhase === 'PLACEMENT' && (
        <div className="placement-panel">
          <div className="placement-panel__title">{`Placement manuel - Joueur ${localPlayerNumber}`}</div>
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
        aiBoardIds={aiBoardIds}
        duelAiFocus={isDuelWithAi}
        ownBoardId={clientOwnBoardId}
        boardSize={boardSize}
        boardStatesById={boardStatesById}
        recentImpactsByBoard={recentImpactsByBoard}
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
