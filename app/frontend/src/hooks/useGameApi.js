import { useCallback, useState } from 'react'
import { fireAt, getGameState, placeShip, resetGame } from '../api/gameApi'

export default function useGameApi() {
  const [gameState, setGameState] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const bootstrapGame = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      await resetGame()
      const state = await getGameState(1)
      setGameState(state)
      return state
    } catch (error) {
      setErrorMessage(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

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

  return {
    gameState,
    loading,
    errorMessage,
    bootstrapGame,
    placeShipAction,
    fireAtAction,
  }
}
