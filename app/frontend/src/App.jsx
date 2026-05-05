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
const FACE_OFF_CAMERA_DIRECTION_BY_PLAYER = {
  1: 'NORTH',
  2: 'SOUTH',
}
const STAR4_CAMERA_DIRECTION_BY_PLAYER = {
  1: 'WEST',
  2: 'EAST',
  3: 'SOUTH',
  4: 'NORTH',
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
const AI_STEP_DELAY_MS = 300
const SHOOT_MODE_UNLOCK_DELAY_MS = 1000
const SHOOT_MODE_AUTO_ENTER_MS = 7000
const IMPACT_FLASH_MS = 3000
const ENEMY_IMPACT_REVEAL_DELAY_MS = 1000

function cloneCellsGrid(cells) {
  return cells.map((row) => [...row])
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
  const [showCoordinates, setShowCoordinates] = useState(true)
  const [waveMode, setWaveMode] = useState('gpu')
  const [benchmarkEnabled, setBenchmarkEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Initialisation de la partie...')
  const [shootModeActive, setShootModeActive] = useState(false)
  const [shootModeButtonUnlocked, setShootModeButtonUnlocked] = useState(false)
  const [shootModeProgress, setShootModeProgress] = useState(0)
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
    removeShipAction,
    confirmPlacementAction,
  } = useGameApi()
  const aiStepLockRef = useRef(false)
  const delayedOwnBoardTimerRef = useRef(null)
  const displayedOwnBoardCellsRef = useRef(null)
  const pendingImpactRevealsRef = useRef([])
  const impactRevealInProgressRef = useRef(false)
  const previousDisplayedOwnBoardCellsRef = useRef(null)
  const previousGameStateRef = useRef(null)
  const impactClearTimerRef = useRef(null)
  const [recentImpactsByBoard, setRecentImpactsByBoard] = useState({})
  const [delayedOwnBoardCells, setDelayedOwnBoardCells] = useState(null)
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

  useEffect(() => {
    return () => {
      if (delayedOwnBoardTimerRef.current) {
        window.clearTimeout(delayedOwnBoardTimerRef.current)
        delayedOwnBoardTimerRef.current = null
      }
      if (impactClearTimerRef.current) {
        window.clearTimeout(impactClearTimerRef.current)
        impactClearTimerRef.current = null
      }
    }
  }, [])

  const scheduleNextImpactReveal = useCallback(() => {
    if (impactRevealInProgressRef.current) return
    if (pendingImpactRevealsRef.current.length === 0) return
    impactRevealInProgressRef.current = true
    delayedOwnBoardTimerRef.current = window.setTimeout(() => {
      const nextImpact = pendingImpactRevealsRef.current.shift()
      const displayedCells = displayedOwnBoardCellsRef.current
      if (nextImpact && Array.isArray(displayedCells?.[nextImpact.y])) {
        const nextDisplayed = cloneCellsGrid(displayedCells)
        nextDisplayed[nextImpact.y][nextImpact.x] = nextImpact.value
        displayedOwnBoardCellsRef.current = nextDisplayed
        setDelayedOwnBoardCells(nextDisplayed)
      }
      delayedOwnBoardTimerRef.current = null
      impactRevealInProgressRef.current = false
      scheduleNextImpactReveal()
    }, ENEMY_IMPACT_REVEAL_DELAY_MS)
  }, [])

  const boards = useMemo(() => {
    return BOARD_CONFIGS[layoutSet]
  }, [layoutSet])

  const currentPlayer = gameState?.currentPlayer ?? 1
  const localPlayerNumber = useMemo(() => {
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
  }, [lobbyState?.inLobby, lobbyState?.playerNumber, gameState?.aiPlayers, currentPlayer])
  const isLocalTurn = currentPlayer === localPlayerNumber
  const currentIsAi = useMemo(
    () => Array.isArray(gameState?.aiPlayers) && Boolean(gameState.aiPlayers[currentPlayer - 1]),
    [gameState, currentPlayer],
  )
  const gamePhase = gameState?.phase
  const isGameOver = gamePhase === 'GAME_OVER'
  const didLocalPlayerWin = isGameOver && gameState?.winner === localPlayerNumber
  const boardSize = gameState?.boardSize ?? setup.boardSize ?? 10
  const boardStatesById = useMemo(() => {
    const stateById = {}
    if (!gameState?.boards) return stateById
    for (const board of gameState.boards) {
      if (board.ownBoard && delayedOwnBoardCells) {
        stateById[board.boardId] = {
          ...board,
          cells: delayedOwnBoardCells,
        }
      } else {
        stateById[board.boardId] = board
      }
    }
    return stateById
  }, [gameState, delayedOwnBoardCells])

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
    selectedShipSize,
    placedShips,
    setSelectedShipType,
    placementOrientation,
    setPlacementOrientation,
    rotatePlacementOrientationClockwise,
    removalModeEnabled,
    setRemovalModeEnabled,
    remainingShips,
    placementPreview,
    handlePlacementSuccess,
    handleCellHover,
    syncPlacedShipsForPlayer,
    resetPlacement,
  } = usePlacement({
    currentPlayer: localPlayerNumber,
    gamePhase,
    boardSize,
    fleetShipSizes: setup.fleetShipSizes,
  })
  const turnOverlayLabel = useMemo(() => {
    if (gamePhase === 'PLACEMENT') {
      if (lobbyState?.inLobby && !isDuelWithAi) {
        return 'Placez vos navires puis validez votre flotte.'
      }
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
    if (isGameOver) {
      return didLocalPlayerWin ? 'Victoire' : 'Défaite'
    }
    return currentIsAi ? "Tour de l'IA" : 'Votre tour'
  }, [
    lobbyState?.inLobby,
    isDuelWithAi,
    gamePhase,
    currentIsAi,
    remainingShips.length,
    isGameOver,
    didLocalPlayerWin,
    currentPlayer,
    isLocalTurn,
  ])
  const placementLockedByPlayer = gameState?.placementLockedByPlayer ?? []
  const placedShipTypesByPlayer = gameState?.placedShipTypesByPlayer ?? []
  const localPlacementLocked = Boolean(placementLockedByPlayer[localPlayerNumber - 1])
  const shouldOfferShootMode = gamePhase === 'BATTLE' && isLocalTurn && !currentIsAi && !isGameOver
  const selectableShips = removalModeEnabled ? placedShips : remainingShips
  const canRemoveSelectedShip = placedShips.some((ship) => ship.type === selectedShipType)
  const showShipSelectionRow = remainingShips.length > 0 || removalModeEnabled

  const interactiveBoards = useMemo(() => {
    if (!gameState) return {}
    if (currentIsAi) {
      return {}
    }
    if (lobbyState.inLobby && gamePhase === 'BATTLE' && !isLocalTurn) {
      return {}
    }
    if (gamePhase === 'PLACEMENT') {
      if (localPlacementLocked) return {}
      return { [expectedOwnBoardId]: true }
    }
    if (gamePhase !== 'BATTLE') return {}
    if (shouldOfferShootMode && !shootModeActive) return {}
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
  }, [numPlayersInState, boards, gameState, gamePhase, expectedOwnBoardId, currentIsAi, lobbyState.inLobby, isLocalTurn, localPlayerNumber, localPlacementLocked, shouldOfferShootMode, shootModeActive])

  const applySetupPatch = useCallback((patch) => {
    setSetup((current) => normalizeSetup({ ...current, ...patch }))
  }, [])

  const handleStartGame = useCallback(async (options = {}) => {
    const keepLobby = Boolean(options.keepLobby)
    const startMode = options.startMode === 'load' ? 'load' : 'new'
    const setupPatch = options.setupPatch ?? {}
    const effectiveSetup = normalizeSetup({ ...setup, ...setupPatch, startMode })
    const nextLayoutSet = effectiveSetup.playerCount === 4 ? 'star4' : 'faceoff'

    try {
      setStatusMessage('Demarrage de la partie...')
      if (!keepLobby) {
        setLobbyState({
          inLobby: false,
          isHost: false,
          gameId: null,
          players: 0,
          maxPlayers: 0,
          playerNumber: 1,
        })
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
        if (localPlacementLocked) {
          setStatusMessage('Placement deja valide. Impossible de modifier votre flotte.')
          return
        }
        if (removalModeEnabled) {
          result = await removeShipAction({
            player: localPlayerNumber,
            x,
            y,
          })
          setStatusMessage(`Navire retire depuis ${boardId} ${label}.`)
          return
        }
        if (remainingShips.length === 0) {
          setStatusMessage(`Joueur ${currentPlayer}: tous vos navires sont deja poses.`)
          return
        }
        const normalizePlacementForBackend = () => {
          const shipLength = Math.max(1, Number(selectedShipSize) || 1)
          if (placementOrientation === 'EAST') {
            return { x, y, orientation: 'HORIZONTAL' }
          }
          if (placementOrientation === 'SOUTH') {
            return { x, y, orientation: 'VERTICAL' }
          }
          if (placementOrientation === 'WEST') {
            return { x: x - (shipLength - 1), y, orientation: 'HORIZONTAL' }
          }
          return { x, y: y - (shipLength - 1), orientation: 'VERTICAL' }
        }
        const normalizedPlacement = normalizePlacementForBackend()
        result = await placeShipAction({
          player: localPlayerNumber,
          shipType: selectedShipType,
          x: normalizedPlacement.x,
          y: normalizedPlacement.y,
          orientation: normalizedPlacement.orientation,
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
        const firePayload = {
          player: localPlayerNumber,
          x,
          y,
          targetPlayer: numPlayersInState > 2 ? targetPlayer : undefined,
        }
        if (lobbyState.inLobby && lobbyState.gameId) {
          firePayload.gameId = lobbyState.gameId
        }
        result = await fireAtAction(firePayload)
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
    localPlacementLocked,
    removalModeEnabled,
    placeShipAction,
    removeShipAction,
    selectedShipType,
    selectedShipLabel,
    placementOrientation,
    selectedShipSize,
    handlePlacementSuccess,
    fireAtAction,
    currentIsAi,
    lobbyState.inLobby,
    lobbyState.gameId,
  ])

  const handleConfirmPlacement = useCallback(async () => {
    if (loading || !gameState || gamePhase !== 'PLACEMENT') return
    if (localPlacementLocked) return
    if (remainingShips.length > 0) {
      setStatusMessage('Placez tous les navires avant de valider.')
      return
    }
    try {
      const payload = { player: localPlayerNumber }
      if (lobbyState.inLobby && lobbyState.gameId) {
        payload.gameId = lobbyState.gameId
      }
      await confirmPlacementAction(payload)
      setStatusMessage('Placement valide. En attente des autres joueurs...')
      setRemovalModeEnabled(false)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading,
    gameState,
    gamePhase,
    localPlacementLocked,
    remainingShips.length,
    confirmPlacementAction,
    localPlayerNumber,
    setRemovalModeEnabled,
    lobbyState.inLobby,
    lobbyState.gameId,
  ])

  const handleRemoveSelectedShip = useCallback(async () => {
    if (loading || !gameState || gamePhase !== 'PLACEMENT' || localPlacementLocked) return
    if (!canRemoveSelectedShip) {
      setStatusMessage('Ce navire n est pas encore place.')
      return
    }
    try {
      await removeShipAction({
        player: localPlayerNumber,
        shipType: selectedShipType,
      })
      setStatusMessage(`Navire ${selectedShipLabel} retire.`)
    } catch {
      // L'erreur est geree dans le hook API.
    }
  }, [
    loading,
    gameState,
    gamePhase,
    localPlacementLocked,
    canRemoveSelectedShip,
    removeShipAction,
    localPlayerNumber,
    selectedShipType,
    selectedShipLabel,
  ])

  useEffect(() => {
    if (screen !== 'game' || gamePhase !== 'PLACEMENT') return
    const onKeyDown = (event) => {
      if (event.repeat) return
      if (event.key?.toLowerCase() !== 'r') return
      const targetTag = event.target?.tagName?.toLowerCase()
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return
      event.preventDefault()
      rotatePlacementOrientationClockwise()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, gamePhase, rotatePlacementOrientationClockwise])

  const onCellHover = useCallback((cellData) => {
    handleCellHover(cellData, expectedOwnBoardId)
  }, [handleCellHover, expectedOwnBoardId])

  useEffect(() => {
    if (!Array.isArray(gameState?.placedShipTypesByPlayer)) return
    const shipTypes = gameState.placedShipTypesByPlayer[localPlayerNumber - 1]
    syncPlacedShipsForPlayer(localPlayerNumber, shipTypes)
  }, [gameState?.placedShipTypesByPlayer, localPlayerNumber, syncPlacedShipsForPlayer])

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
    if (!gameState || gameState.phase !== 'BATTLE') {
      if (delayedOwnBoardTimerRef.current) {
        window.clearTimeout(delayedOwnBoardTimerRef.current)
        delayedOwnBoardTimerRef.current = null
      }
      pendingImpactRevealsRef.current = []
      impactRevealInProgressRef.current = false
      displayedOwnBoardCellsRef.current = null
      previousDisplayedOwnBoardCellsRef.current = null
      setDelayedOwnBoardCells(null)
      return
    }

    const ownBoard = gameState.boards?.find((board) => board.ownBoard)
    const nextCells = ownBoard?.cells
    if (!ownBoard || !Array.isArray(nextCells)) return

    const displayedCells = displayedOwnBoardCellsRef.current
    if (!displayedCells) {
      displayedOwnBoardCellsRef.current = nextCells
      previousDisplayedOwnBoardCellsRef.current = nextCells
      setDelayedOwnBoardCells(nextCells)
      return
    }

    const nextDisplayed = cloneCellsGrid(displayedCells)
    let hasImmediateChange = false
    for (let y = 0; y < nextCells.length; y += 1) {
      const nextRow = nextCells[y] ?? []
      const shownRow = nextDisplayed[y] ?? []
      for (let x = 0; x < nextRow.length; x += 1) {
        const nextCell = nextRow[x]
        const shownCell = shownRow[x]
        if (nextCell === shownCell) continue
        if (nextCell === 'MISS' || nextCell === 'HIT' || nextCell === 'SUNK') {
          pendingImpactRevealsRef.current.push({ x, y, value: nextCell })
          continue
        }
        shownRow[x] = nextCell
        hasImmediateChange = true
      }
    }

    if (hasImmediateChange) {
      displayedOwnBoardCellsRef.current = nextDisplayed
      setDelayedOwnBoardCells(nextDisplayed)
    }
    scheduleNextImpactReveal()
  }, [gameState, scheduleNextImpactReveal])

  useEffect(() => {
    if (!gameState || gameState.phase !== 'BATTLE' || !Array.isArray(delayedOwnBoardCells)) {
      previousDisplayedOwnBoardCellsRef.current = null
      return
    }
    const previousOwnBoardCells = previousDisplayedOwnBoardCellsRef.current
    previousDisplayedOwnBoardCellsRef.current = delayedOwnBoardCells
    if (!Array.isArray(previousOwnBoardCells)) return

    const impactStartedAt = Date.now()
    const impacts = []
    for (let y = 0; y < delayedOwnBoardCells.length; y += 1) {
      const row = delayedOwnBoardCells[y] ?? []
      const previousRow = previousOwnBoardCells[y] ?? []
      for (let x = 0; x < row.length; x += 1) {
        const nextCell = row[x]
        const prevCell = previousRow[x]
        if (nextCell === prevCell) continue
        if (nextCell === 'MISS' || nextCell === 'HIT' || nextCell === 'SUNK') {
          impacts.push({ x, y, type: nextCell, startedAt: impactStartedAt })
        }
      }
    }
    if (impacts.length === 0) return

    setRecentImpactsByBoard({ [clientOwnBoardId]: impacts })
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
  }, [gameState, delayedOwnBoardCells, clientOwnBoardId])

  // --- WebSocket integration ---
  const { wsState, wsMessage, ensureConnected, createGame, joinGame, startGame } = useWebSocketGame()

  const handleCreateLobby = useCallback((maxPlayers) => {
    createGame(maxPlayers)
  }, [createGame])

  const handleJoinLobby = useCallback((gameId) => {
    const trimmed = gameId?.trim()
    if (!trimmed) return
    joinGame(trimmed)
  }, [joinGame])

  const handleStartLobbyGame = useCallback(async (setupPatch = {}) => {
    if (!lobbyState.isHost || !lobbyState.gameId) return
    try {
      await handleStartGame({ keepLobby: true, startMode: 'new', setupPatch })
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
    } else if (wsMessage?.type === 'GAME_STATE_UPDATE') {
      if (
        screen !== 'game'
        || !lobbyState.inLobby
        || !wsMessage.gameId
        || wsMessage.gameId !== lobbyState.gameId
      ) {
        return
      }
      syncStateAction(lobbyState.playerNumber ?? 1).catch(() => {
      })
    } else if (wsMessage?.type === 'ERROR') {
      setStatusMessage(`Erreur WebSocket: ${wsMessage.message}`)
    }
  }, [
    wsMessage,
    setup.playerCount,
    screen,
    lobbyState.isHost,
    lobbyState.inLobby,
    lobbyState.gameId,
    lobbyState.playerNumber,
    refreshStateAction,
    enterGameScreenWithState,
    syncStateAction,
  ])

  const gameSummary = useMemo(() => {
    return `${setup.boardSize}x${setup.boardSize} · ${setup.playerCount} joueurs · ${setup.humanPlayers} humains${setup.withAI ? ` · ${setup.playerCount - setup.humanPlayers} IA` : ''} · ${setup.fleetShipSizes.length} navires`
  }, [setup])
  const isPlayerInShootMode = gamePhase === 'BATTLE' && isLocalTurn && !currentIsAi && shootModeActive
  const shouldShowShootModePrompt = shouldOfferShootMode && !shootModeActive
  const shouldShowPlacementConfirmPrompt = gamePhase === 'PLACEMENT' && !localPlacementLocked && remainingShips.length === 0
  const cameraAnchorPlayer = useMemo(() => {
    if (isPlayerInShootMode && numPlayersInState === 2) {
      return localPlayerNumber === 1 ? 2 : 1
    }
    return localPlayerNumber
  }, [isPlayerInShootMode, numPlayersInState, localPlayerNumber])
  const cameraDirection = useMemo(() => {
    if (layoutSet === 'star4') {
      return STAR4_CAMERA_DIRECTION_BY_PLAYER[cameraAnchorPlayer] ?? 'NORTH'
    }
    return FACE_OFF_CAMERA_DIRECTION_BY_PLAYER[cameraAnchorPlayer] ?? 'SOUTH'
  }, [layoutSet, cameraAnchorPlayer])
  const cameraStateKey = useMemo(() => {
    const gamePart = lobbyState.gameId ?? 'local'
    return `${gamePart}:player:${localPlayerNumber}`
  }, [lobbyState.gameId, localPlayerNumber])
  const [manualCameraDirection, setManualCameraDirection] = useState(null)
  const effectiveCameraDirection = manualCameraDirection ?? cameraDirection
  const [cameraFacingDirection, setCameraFacingDirection] = useState(cameraDirection)
  useEffect(() => {
    setManualCameraDirection(null)
    setCameraFacingDirection(cameraDirection)
  }, [cameraDirection, cameraStateKey])
  const canChooseCameraDirection = !isPlayerInShootMode
  const handleCompassDirectionClick = useCallback((direction) => {
    if (!canChooseCameraDirection) return
    setManualCameraDirection(direction)
  }, [canChooseCameraDirection])
  const cameraDirectionLabel = useMemo(() => {
    if (cameraFacingDirection === 'NORTH') return 'NORD'
    if (cameraFacingDirection === 'SOUTH') return 'SUD'
    if (cameraFacingDirection === 'EAST') return 'EST'
    return 'OUEST'
  }, [cameraFacingDirection])
  const localPlacementCompleted = gamePhase === 'PLACEMENT' && localPlacementLocked

  useEffect(() => {
    if (!shouldOfferShootMode) {
      setShootModeActive(false)
      setShootModeButtonUnlocked(false)
      setShootModeProgress(0)
      return
    }

    setShootModeActive(false)
    setShootModeButtonUnlocked(false)
    setShootModeProgress(0)

    const startedAt = Date.now()
    const unlockTimer = window.setTimeout(() => {
      setShootModeButtonUnlocked(true)
    }, SHOOT_MODE_UNLOCK_DELAY_MS)
    const autoEnterTimer = window.setTimeout(() => {
      setShootModeActive(true)
    }, SHOOT_MODE_AUTO_ENTER_MS)
    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const nextProgress = Math.min(1, elapsed / SHOOT_MODE_AUTO_ENTER_MS)
      setShootModeProgress(nextProgress)
    }, 50)

    return () => {
      window.clearTimeout(unlockTimer)
      window.clearTimeout(autoEnterTimer)
      window.clearInterval(progressInterval)
    }
  }, [shouldOfferShootMode, currentPlayer, localPlayerNumber])

  useEffect(() => {
    if (!shouldShowShootModePrompt) {
      setShootModeProgress(0)
    }
  }, [shouldShowShootModePrompt])

  const handleEnterShootMode = useCallback(() => {
    if (!shootModeButtonUnlocked) return
    setShootModeActive(true)
  }, [shootModeButtonUnlocked])

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
        ensureWs={ensureConnected}
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
          {gameSummary} · Vous etes joueur {localPlayerNumber} · Vue: {cameraDirectionLabel} · Votre grille: {clientOwnBoardId}
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
        <div className={`turn-banner ${isGameOver ? 'turn-banner--result' : ''} ${didLocalPlayerWin ? 'turn-banner--victory' : ''} ${isGameOver && !didLocalPlayerWin ? 'turn-banner--defeat' : ''}`}>
          {turnOverlayLabel}
        </div>
      )}
      <div className="compass-widget" aria-label={`Boussole, direction ${cameraDirectionLabel}`}>
        <button
          type="button"
          className={`compass-widget__dir ${cameraFacingDirection === 'NORTH' ? 'active' : ''}`}
          onClick={() => handleCompassDirectionClick('NORTH')}
          disabled={!canChooseCameraDirection}
          aria-label="Orienter la camera vers le nord"
        >
          N
        </button>
        <button
          type="button"
          className={`compass-widget__dir ${cameraFacingDirection === 'EAST' ? 'active' : ''}`}
          onClick={() => handleCompassDirectionClick('EAST')}
          disabled={!canChooseCameraDirection}
          aria-label="Orienter la camera vers l est"
        >
          E
        </button>
        <button
          type="button"
          className={`compass-widget__dir ${cameraFacingDirection === 'SOUTH' ? 'active' : ''}`}
          onClick={() => handleCompassDirectionClick('SOUTH')}
          disabled={!canChooseCameraDirection}
          aria-label="Orienter la camera vers le sud"
        >
          S
        </button>
        <button
          type="button"
          className={`compass-widget__dir ${cameraFacingDirection === 'WEST' ? 'active' : ''}`}
          onClick={() => handleCompassDirectionClick('WEST')}
          disabled={!canChooseCameraDirection}
          aria-label="Orienter la camera vers l ouest"
        >
          W
        </button>
      </div>
      {shouldShowShootModePrompt && (
        <div className="shoot-mode-panel">
          <button
            type="button"
            className="shoot-mode-panel__button"
            onClick={handleEnterShootMode}
            disabled={!shootModeButtonUnlocked}
          >
            Passer en mode tir
          </button>
          <div className="shoot-mode-panel__progress">
            <div
              className="shoot-mode-panel__progress-fill"
              style={{ width: `${Math.round(shootModeProgress * 100)}%` }}
            />
          </div>
        </div>
      )}
      {shouldShowPlacementConfirmPrompt && (
        <div className="shoot-mode-panel">
          <button
            type="button"
            className="shoot-mode-panel__button shoot-mode-panel__button--confirm"
            onClick={handleConfirmPlacement}
            disabled={loading || localPlacementLocked}
          >
            Valider la flotte
          </button>
        </div>
      )}
      {localPlacementCompleted && (
        <div className="placement-wait-banner">
          En attente du ou des ennemis...
        </div>
      )}
      {gamePhase === 'PLACEMENT' && !localPlacementCompleted && (
        <div className="placement-panel">
          <div className="placement-panel__title">{`Placement manuel - Joueur ${localPlayerNumber}`}</div>
          {showShipSelectionRow && (
            <div className="placement-panel__row">
              <label htmlFor="ship-select">Navire</label>
              <select
                id="ship-select"
                value={selectedShipType}
                onChange={(event) => setSelectedShipType(event.target.value)}
                disabled={selectableShips.length === 0}
              >
                {selectableShips.map((ship) => (
                  <option key={ship.type} value={ship.type}>
                    {ship.label} ({ship.size} cases)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRemoveSelectedShip}
                disabled={loading || localPlacementLocked || !canRemoveSelectedShip}
              >
                Retirer
              </button>
            </div>
          )}
          <div className="placement-panel__row">
            <button
              type="button"
              className={removalModeEnabled ? 'active' : ''}
              onClick={() => setRemovalModeEnabled((value) => !value)}
              disabled={localPlacementLocked}
            >
              {removalModeEnabled ? 'Suppression active' : 'Mode suppression'}
            </button>
          </div>
          <div className="placement-panel__row">
            <button
              type="button"
              className={placementOrientation === 'EAST' || placementOrientation === 'WEST' ? 'active' : ''}
              onClick={() => setPlacementOrientation('EAST')}
              disabled={removalModeEnabled}
            >
              Horizontal
            </button>
            <button
              type="button"
              className={placementOrientation === 'SOUTH' || placementOrientation === 'NORTH' ? 'active' : ''}
              onClick={() => setPlacementOrientation('SOUTH')}
              disabled={removalModeEnabled}
            >
              Vertical
            </button>
          </div>
          <div className="placement-panel__hint">
            {remainingShips.length > 0
              ? (removalModeEnabled
                ? `Mode suppression: cliquez un bateau sur la grille ${expectedOwnBoardId}.`
                : `Cliquez sur la grille ${expectedOwnBoardId} pour poser ${selectedShipLabel}.`)
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
        gamePhase={gamePhase}
        topDownView={isPlayerInShootMode && shootModeActive}
        ownBoardId={clientOwnBoardId}
        cameraDirection={effectiveCameraDirection}
        cameraStateKey={cameraStateKey}
        boardSize={boardSize}
        boardStatesById={boardStatesById}
        recentImpactsByBoard={recentImpactsByBoard}
        interactiveBoards={interactiveBoards}
        previewCells={placementPreview}
        previewBoardId={expectedOwnBoardId}
        showCoordinates={showCoordinates}
        waveMode={waveMode}
        benchmarkEnabled={benchmarkEnabled}
        onCameraDirectionChange={setCameraFacingDirection}
        onCellHover={onCellHover}
        onCellClick={handleCellClick}
      />
    </main>
  )
}

export default App
