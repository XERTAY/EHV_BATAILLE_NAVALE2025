import { useCallback, useEffect, useState } from 'react'
import wsClient from '../api/wsClient'

function useWebSocketGame() {
  const [wsState, setWsState] = useState({ connected: false, sessionId: null, gameId: null, error: null })
  const [wsMessage, setWsMessage] = useState(null)

  useEffect(() => {
    wsClient.onOpen = () => setWsState((s) => ({ ...s, connected: true }))
    wsClient.onClose = () => setWsState((s) => ({ ...s, connected: false }))
    wsClient.onError = (e) => setWsState((s) => ({ ...s, error: e }))
    wsClient.onMessage = (msg) => {
      setWsMessage(msg)
      if (msg.type === 'CONNECTED') setWsState((s) => ({ ...s, sessionId: msg.sessionId }))
      if (msg.type === 'GAME_CREATED') setWsState((s) => ({ ...s, gameId: msg.gameId }))
      if (msg.type === 'JOINED_GAME') setWsState((s) => ({ ...s, gameId: msg.gameId }))
    }
    return () => {
      wsClient.close()
    }
  }, [])

  const ensureConnected = useCallback(() => {
    wsClient.ensureOpen()
  }, [])

  const createGame = (maxPlayers = 4) => {
    ensureConnected()
    wsClient.send({ type: 'CREATE_GAME', maxPlayers })
  }
  const joinGame = (gameId) => {
    ensureConnected()
    wsClient.send({ type: 'JOIN_GAME', gameId })
  }
  const startGame = (gameId) => {
    ensureConnected()
    wsClient.send({ type: 'START_GAME', gameId })
  }
  const send = (obj) => wsClient.send(obj)

  return { wsState, wsMessage, ensureConnected, createGame, joinGame, startGame, send }
}

export default useWebSocketGame
