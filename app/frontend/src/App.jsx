import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import BoardScene from './components/BoardScene'
import LayoutControls from './components/LayoutControls'
import { BOARD_CONFIGS } from './config/boardConfigs'
import useGameApi from './hooks/useGameApi'
import usePlacement from './hooks/usePlacement'

function App() {
  const [layoutSet, setLayoutSet] = useState('faceoff')
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [waveMode, setWaveMode] = useState('gpu')
  const [benchmarkEnabled, setBenchmarkEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Initialisation de la partie...')
  const { gameState, loading, errorMessage, bootstrapGame, placeShipAction, fireAtAction } = useGameApi()

  const boards = useMemo(() => {
    return BOARD_CONFIGS[layoutSet]
  }, [layoutSet])

  const currentPlayer = gameState?.currentPlayer ?? 1
  const gamePhase = gameState?.phase
  const boardStatesById = useMemo(() => {
    const stateById = {}
    if (!gameState?.boards) return stateById
    for (const board of gameState.boards) {
      stateById[board.boardId] = board
    }
    return stateById
  }, [gameState])

  const expectedTargetBoardId = currentPlayer === 1 ? 'B1' : 'A1'
  const expectedOwnBoardId = currentPlayer === 1 ? 'A1' : 'B1'
  const {
    selectedShipType,
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

  useEffect(() => {
    const boot = async () => {
      try {
        await bootstrapGame()
        resetPlacement()
        setStatusMessage('Placement manuel: Joueur 1 place ses navires.')
      } catch {
        // L'erreur est geree dans le hook API.
      }
    }
    boot()
  }, [bootstrapGame, resetPlacement])

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
          setStatusMessage(`Joueur ${currentPlayer}: tous vos navires sont deja places.`)
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
            `Navire ${selectedShipType} place sur ${boardId} ${label}. Joueur ${result.state.currentPlayer} continue.`,
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
    placementOrientation,
    handlePlacementSuccess,
    fireAtAction,
  ])

  const onCellHover = useCallback((cellData) => {
    handleCellHover(cellData, expectedOwnBoardId)
  }, [handleCellHover, expectedOwnBoardId])

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
      />
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
                  {ship.type} ({ship.size})
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
              ? `Cliquez sur la grille ${expectedOwnBoardId} pour poser ${selectedShipType}.`
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
