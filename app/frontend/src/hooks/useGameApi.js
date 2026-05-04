import { useCallback, useState } from 'react'
import { fireAt, getGameState, listSaves, loadGame, placeShip, resetGame, runAiStep, saveGame } from '../api/gameApi'

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
    ) => {
      try {
        setLoading(true)
        setErrorMessage('')
        await resetGame(boardSize, fleetShipSizes, playerCount, withAI, humanPlayers)
        const state = await getGameState(1)
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

  const refreshStateAction = useCallback(async (player = 1) => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await getGameState(player)
      setGameState(state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const runAiStepAction = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      const state = await runAiStep()
      setGameState(state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
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
    fireAtAction,
    listSavesAction,
    loadGameAction,
    saveGameAction,
    refreshStateAction,
    runAiStepAction,
  }
}
