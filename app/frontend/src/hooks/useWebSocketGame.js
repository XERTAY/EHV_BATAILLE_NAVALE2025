import { useCallback, useEffect, useRef, useState } from 'react'
import { getLobbyResumeToken, setLobbyResumeToken } from '@/features/lobby/lobbyAuthStorage'
import wsClient from '../api/wsClient'

function useWebSocketGame() {
  const [wsState, setWsState] = useState({
    connected: false,
    sessionId: null,
    gameId: null,
    playerNumber: 1,
    error: null,
  })
  const [wsMessage, setWsMessage] = useState(null)
  const [pendingJoinIntent, setPendingJoinIntent] = useState('manual')
  const pendingJoinIntentRef = useRef(pendingJoinIntent)
  pendingJoinIntentRef.current = pendingJoinIntent

  useEffect(() => {
    wsClient.onOpen = () => setWsState((s) => ({ ...s, connected: true }))
    wsClient.onClose = () => setWsState((s) => ({ ...s, connected: false }))
    wsClient.onError = (e) => setWsState((s) => ({ ...s, error: e }))
    wsClient.onMessage = (msg) => {
      if (msg.type === 'JOINED_GAME') {
        const enriched = { ...msg, joinIntent: pendingJoinIntentRef.current }
        setWsMessage(enriched)
      } else {
        setWsMessage(msg)
      }
      if (msg.type === 'CONNECTED') setWsState((s) => ({ ...s, sessionId: msg.sessionId }))
      if (msg.type === 'GAME_CREATED') {
        if (msg.gameId && msg.resumeToken) setLobbyResumeToken(msg.gameId, msg.resumeToken)
        setWsState((s) => ({ ...s, gameId: msg.gameId, playerNumber: msg.playerNumber ?? 1 }))
      }
      if (msg.type === 'JOINED_GAME') {
        if (msg.gameId && msg.resumeToken) setLobbyResumeToken(msg.gameId, msg.resumeToken)
        setWsState((s) => ({ ...s, gameId: msg.gameId, playerNumber: msg.playerNumber ?? 1 }))
        setPendingJoinIntent('manual')
      }
    }
    wsClient.ensureOpen()
    return () => {
      // Ne pas fermer la socket ici : singleton applicatif ; StrictMode remonte
      // le composant en dev et provoquait des EPIPE sur le proxy WS Vite.
      wsClient.onOpen = null
      wsClient.onClose = null
      wsClient.onError = null
      wsClient.onMessage = null
    }
  }, [])

  const ensureConnected = useCallback(() => {
    wsClient.ensureOpen()
  }, [])

  const createGame = useCallback((maxPlayers = 4) => {
    ensureConnected()
    wsClient.send({ type: 'CREATE_GAME', maxPlayers })
  }, [ensureConnected])
  const joinGame = useCallback((gameId, intent = 'manual') => {
    ensureConnected()
    const normalized = String(gameId ?? '').trim().toLowerCase()
    const resumeToken = getLobbyResumeToken(normalized)
    const normalizedIntent = intent === 'auto_resume' ? 'auto_resume' : 'manual'
    setPendingJoinIntent(normalizedIntent)
    wsClient.send({ type: 'JOIN_GAME', gameId: normalized, resumeToken: resumeToken ?? undefined })
  }, [ensureConnected])
  const startGame = useCallback((gameId) => {
    ensureConnected()
    wsClient.send({ type: 'START_GAME', gameId })
  }, [ensureConnected])
  const leaveGame = useCallback(() => {
    ensureConnected()
    wsClient.send({ type: 'LEAVE_GAME' })
  }, [ensureConnected])
  const updateLobbyConfig = useCallback((config) => {
    ensureConnected()
    wsClient.send({ type: 'UPDATE_LOBBY_CONFIG', ...config })
  }, [ensureConnected])
  const send = useCallback((obj) => wsClient.send(obj), [])

  return {
    wsState,
    wsMessage,
    ensureConnected,
    createGame,
    joinGame,
    startGame,
    leaveGame,
    updateLobbyConfig,
    send,
  }
}

export default useWebSocketGame
