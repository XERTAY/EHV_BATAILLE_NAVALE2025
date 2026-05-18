import { useCallback, useState } from 'react'
import {
  confirmPlacement,
  fireAt,
  getGameState,
  listSaves,
  loadGame,
  loadGameFromFile,
  placeShip,
  removePlacedShip,
  resetGame,
  runAiStep,
  saveGame,
} from '../api/gameApi'

function warnIfEnemyShipLeaked(state) {
  if (!import.meta.env.DEV || !state?.boards || state.phase === 'GAME_OVER') return
  const leakedBoard = state.boards.find((board) => (
    !board?.ownBoard
    && Array.isArray(board?.cells)
    && board.cells.some((row) => Array.isArray(row) && row.includes('SHIP'))
  ))
  if (leakedBoard) {
    // Ce warning detecte une fuite backend sans exposer le contenu complet.
    console.warn('[security] Adversary board contains SHIP outside GAME_OVER', leakedBoard.boardId)
  }
}

function applyGameState(setGameState, state) {
  warnIfEnemyShipLeaked(state)
  setGameState(state)
}

export default function useGameApi() {
  const [gameState, setGameState] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const bootstrapGame = useCallback(
    async (
      boardSize = 10,
      fleetShipSizes = [5, 4, 3, 3, 2],
      playerCount = 2,
      withAI = false,
      humanPlayers = 2,
      lobbyGameId = null,
      viewerPlayer = 1,
    ) => {
      try {
        setLoading(true)
        setErrorMessage('')
        await resetGame(boardSize, fleetShipSizes, playerCount, withAI, humanPlayers, lobbyGameId)
        const state = await getGameState(Math.max(1, Number(viewerPlayer) || 1), lobbyGameId)
        applyGameState(setGameState, state)
        return state
      } catch (error) {
        setErrorMessage(error.message)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const placeShipAction = useCallback(async (payload) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const result = await placeShip(payload)
      applyGameState(setGameState, result.state)
      return result
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const fireAtAction = useCallback(async (payload) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const result = await fireAt(payload)
      applyGameState(setGameState, result.state)
      return result
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const removeShipAction = useCallback(async (payload) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const result = await removePlacedShip(payload)
      applyGameState(setGameState, result.state)
      return result
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmPlacementAction = useCallback(async (payload) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const result = await confirmPlacement(payload)
      applyGameState(setGameState, result.state)
      return result
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const listSavesAction = useCallback(async () => {
    try {
      setErrorMessage('')
      const saves = await listSaves()
      return Array.isArray(saves) ? saves : []
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    }
  }, [])

  const loadGameFromFileAction = useCallback(async (content, lobbyGameId = null) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await loadGameFromFile(content, lobbyGameId)
      applyGameState(setGameState, state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGameAction = useCallback(async (fileName, lobbyGameId = null) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await loadGame(fileName, lobbyGameId)
      applyGameState(setGameState, state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshStateAction = useCallback(async (player = 1, lobbyGameId = null) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await getGameState(player, lobbyGameId)
      applyGameState(setGameState, state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const runAiStepAction = useCallback(async (lobbyGameId) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const result = await runAiStep(lobbyGameId)
      applyGameState(setGameState, result.state)
      return result
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const syncStateAction = useCallback(async (player = 1, lobbyGameId = null) => {
    const state = await getGameState(player, lobbyGameId)
    applyGameState(setGameState, state)
    return state
  }, [])

  const saveGameAction = useCallback(async (fileName, lobbyGameId = null) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const response = await saveGame(fileName, lobbyGameId)
      const state = response?.state ?? response
      applyGameState(setGameState, state)
      return response
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    gameState,
    loading,
    errorMessage,
    bootstrapGame,
    placeShipAction,
    removeShipAction,
    confirmPlacementAction,
    fireAtAction,
    listSavesAction,
    loadGameAction,
    loadGameFromFileAction,
    saveGameAction,
    refreshStateAction,
    syncStateAction,
    runAiStepAction,
  }
}
