import { useCallback, useEffect, useState } from 'react'

import { LOBBY_SYNC_POLL_MS } from '@/constants/timings'

const INITIAL_LOBBY_STATE = Object.freeze({
  inLobby: false,
  isHost: false,
  gameId: null,
  players: 0,
  maxPlayers: 0,
  playerNumber: 1,
})

function applyGameCreated(message, fallbackPlayerCount) {
  return {
    inLobby: true,
    isHost: true,
    gameId: message.gameId ?? null,
    players: message.players ?? 1,
    maxPlayers: message.maxPlayers ?? fallbackPlayerCount,
    playerNumber: message.playerNumber ?? 1,
  }
}

function applyJoinedGame(message, fallbackPlayerCount) {
  return {
    inLobby: true,
    isHost: false,
    gameId: message.gameId ?? null,
    players: message.players ?? 1,
    maxPlayers: message.maxPlayers ?? fallbackPlayerCount,
    playerNumber: message.playerNumber ?? 1,
  }
}

function applyPlayerCountUpdate(current, message) {
  if (!current.inLobby || current.gameId !== message.gameId) return current
  return {
    ...current,
    players: message.players ?? current.players,
    maxPlayers: message.maxPlayers ?? current.maxPlayers,
  }
}

/**
 * Encapsule l'etat du lobby WebSocket :
 * - traduit les messages WS (`GAME_CREATED`, `JOINED_GAME`, `PLAYER_COUNT_UPDATED`,
 *   `GAME_STARTED`, `GAME_STATE_UPDATE`, `ERROR`) en transitions d'etat,
 * - declenche la synchro HTTP reguliere (`LOBBY_SYNC_POLL_MS`) tant qu'on est
 *   dans un lobby et sur l'ecran de jeu.
 *
 * Les actions reseau elles-memes (`refreshStateAction`, `syncStateAction`,
 * `enterGameScreenWithState`) sont passees en parametre pour conserver leur
 * scope d'origine (hooks API, navigation).
 *
 * @param {{
 *   wsMessage: { type: string, [k: string]: unknown } | null,
 *   screen: string,
 *   fallbackPlayerCount: number,
 *   refreshStateAction: (player: number, gameId: string | null) => Promise<unknown>,
 *   syncStateAction: (player: number, gameId: string | null) => Promise<unknown>,
 *   enterGameScreenWithState: (state: unknown, status?: string) => void,
 *   onStatus: (message: string) => void,
 * }} params
 */
export default function useLobbyState({
  wsMessage,
  screen,
  fallbackPlayerCount,
  refreshStateAction,
  syncStateAction,
  enterGameScreenWithState,
  onStatus,
}) {
  const [lobbyState, setLobbyState] = useState(INITIAL_LOBBY_STATE)

  useEffect(() => {
    if (!wsMessage) return
    if (wsMessage.type === 'GAME_CREATED') {
      onStatus?.(`Partie cr\u00e9\u00e9e. ID: ${wsMessage.gameId}`)
      setLobbyState(applyGameCreated(wsMessage, fallbackPlayerCount))
      return
    }
    if (wsMessage.type === 'JOINED_GAME') {
      onStatus?.(`Rejoint la partie. ID: ${wsMessage.gameId}`)
      setLobbyState(applyJoinedGame(wsMessage, fallbackPlayerCount))
      return
    }
    if (wsMessage.type === 'PLAYER_COUNT_UPDATED') {
      setLobbyState((current) => applyPlayerCountUpdate(current, wsMessage))
      onStatus?.(`Lobby ${wsMessage.gameId}: ${wsMessage.players}/${wsMessage.maxPlayers} joueurs.`)
      return
    }
    if (wsMessage.type === 'GAME_STARTED') {
      setLobbyState((current) => {
        if (current.isHost) return current
        const lobbyScope = wsMessage.gameId ?? current.gameId ?? null
        refreshStateAction(current.playerNumber ?? 1, lobbyScope)
          .then((state) => enterGameScreenWithState(state, "Partie lancee par l'hote."))
          .catch(() => onStatus?.("Impossible de charger la partie demarree par l hote."))
        return current
      })
      return
    }
    if (wsMessage.type === 'GAME_STATE_UPDATE') {
      setLobbyState((current) => {
        if (
          screen !== 'game'
          || !current.inLobby
          || !wsMessage.gameId
          || wsMessage.gameId !== current.gameId
        ) {
          return current
        }
        syncStateAction(current.playerNumber ?? 1, wsMessage.gameId).catch(() => {})
        return current
      })
      return
    }
    if (wsMessage.type === 'ERROR') {
      onStatus?.(`Erreur WebSocket: ${wsMessage.message}`)
    }
  }, [wsMessage, fallbackPlayerCount, refreshStateAction, syncStateAction, enterGameScreenWithState, screen, onStatus])

  // Polling regulier de l'etat backend tant qu'on est dans un lobby et sur
  // l'ecran de jeu (complement des messages WS).
  useEffect(() => {
    if (screen !== 'game' || !lobbyState.inLobby) return undefined
    const lobbyScope = lobbyState.gameId ?? null
    const playerNumber = lobbyState.playerNumber ?? 1
    const pollId = window.setInterval(() => {
      syncStateAction(playerNumber, lobbyScope).catch(() => {})
    }, LOBBY_SYNC_POLL_MS)
    return () => window.clearInterval(pollId)
  }, [screen, lobbyState.inLobby, lobbyState.gameId, lobbyState.playerNumber, syncStateAction])

  const resetLobby = useCallback(() => setLobbyState(INITIAL_LOBBY_STATE), [])

  return { lobbyState, setLobbyState, resetLobby }
}
