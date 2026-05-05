import { useCallback, useState } from 'react'
import {
  confirmPlacement,
  fireAt,
  getGameState,
  listSaves,
  loadGame,
  placeShip,
  removePlacedShip,
  resetGame,
  runAiStep,
  saveGame,
} from '../api/gameApi'

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
        setGameState(state)
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
      setGameState(result.state)
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
      setGameState(result.state)
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
      setGameState(result.state)
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
      setGameState(result.state)
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

  const loadGameAction = useCallback(async (fileName) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await loadGame(fileName)
      setGameState(state)
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
      setGameState(state)
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
      const state = await runAiStep(lobbyGameId)
      setGameState(state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const syncStateAction = useCallback(async (player = 1, lobbyGameId = null) => {
    const state = await getGameState(player, lobbyGameId)
    setGameState(state)
    return state
  }, [])

  const saveGameAction = useCallback(async (fileName) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await saveGame(fileName)
      setGameState(state)
      return state
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
    saveGameAction,
    refreshStateAction,
    syncStateAction,
    runAiStepAction,
  }
}
