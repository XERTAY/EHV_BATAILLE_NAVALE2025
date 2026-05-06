import { useCallback, useEffect, useState } from 'react'

import { LOBBY_SYNC_POLL_MS } from '@/constants/timings'

const INITIAL_LOBBY_STATE = Object.freeze({
  inLobby: false,
  isHost: false,
  gameId: null,
  players: 0,
  maxPlayers: 0,
  playerNumber: 1,
  opponentPresence: {
    disconnected: false,
    disconnectedPlayerNumber: null,
    forfeitDeadlineAt: null,
    lastEvent: null,
  },
  lobbyConfigPreview: {
    boardSize: 10,
    playerCount: 2,
    humanPlayers: 2,
    aiPlayers: 0,
    fleetShipCount: 5,
    fleetTotalCells: 17,
  },
})

function applyGameCreated(message, fallbackPlayerCount) {
  return {
    inLobby: true,
    isHost: true,
    gameId: message.gameId ?? null,
    players: message.players ?? 1,
    maxPlayers: message.maxPlayers ?? fallbackPlayerCount,
    playerNumber: message.playerNumber ?? 1,
    opponentPresence: INITIAL_LOBBY_STATE.opponentPresence,
    lobbyConfigPreview: INITIAL_LOBBY_STATE.lobbyConfigPreview,
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
    opponentPresence: INITIAL_LOBBY_STATE.opponentPresence,
    lobbyConfigPreview: INITIAL_LOBBY_STATE.lobbyConfigPreview,
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

function updateOpponentPresence(current, nextPatch) {
  return {
    ...current,
    opponentPresence: {
      ...current.opponentPresence,
      ...nextPatch,
    },
  }
}

function updateLobbyConfigPreview(current, message) {
  if (!current.inLobby || current.gameId !== message.gameId) return current
  return {
    ...current,
    lobbyConfigPreview: {
      boardSize: Number(message.boardSize) || current.lobbyConfigPreview.boardSize,
      playerCount: Number(message.playerCount) || current.lobbyConfigPreview.playerCount,
      humanPlayers: Number(message.humanPlayers) || current.lobbyConfigPreview.humanPlayers,
      aiPlayers: Number(message.aiPlayers) || current.lobbyConfigPreview.aiPlayers,
      fleetShipCount: Number(message.fleetShipCount) || current.lobbyConfigPreview.fleetShipCount,
      fleetTotalCells: Number(message.fleetTotalCells) || current.lobbyConfigPreview.fleetTotalCells,
    },
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
      const nextLobby = applyJoinedGame(wsMessage, fallbackPlayerCount)
      setLobbyState(nextLobby)
      const shouldEnterGameNow =
        wsMessage.gameStatus === 'IN_PROGRESS' || wsMessage.gameStatus === 'FINISHED'
      if (shouldEnterGameNow) {
        const lobbyScope = nextLobby.gameId ?? null
        const playerNumber = nextLobby.playerNumber ?? 1
        refreshStateAction(playerNumber, lobbyScope)
          .then((state) => {
            const status =
              wsMessage.gameStatus === 'FINISHED'
                ? (wsMessage.playerResult === 'VICTORY'
                    ? 'Partie terminee: victoire. Reconnexion en lecture de fin de partie.'
                    : 'Partie terminee: defaite. Reconnexion en lecture de fin de partie.')
                : 'Partie en cours. Reconnexion automatique reussie.'
            enterGameScreenWithState(state, status)
          })
          .catch(() => {
            onStatus?.('Lobby rejoint, mais impossible de synchroniser l etat de la partie. Reessayez dans quelques secondes.')
          })
      } else if (wsMessage.joinIntent === 'auto_resume') {
        onStatus?.('Lobby retrouve. En attente du lancement par l hote.')
      }
      return
    }
    if (wsMessage.type === 'PLAYER_COUNT_UPDATED') {
      setLobbyState((current) => applyPlayerCountUpdate(current, wsMessage))
      onStatus?.(`Lobby ${wsMessage.gameId}: ${wsMessage.players}/${wsMessage.maxPlayers} joueurs.`)
      return
    }
    if (wsMessage.type === 'LOBBY_CONFIG_UPDATED') {
      setLobbyState((current) => updateLobbyConfigPreview(current, wsMessage))
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
      return
    }
    if (wsMessage.type === 'PLAYER_DISCONNECTED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        if (Number(wsMessage.playerNumber) === Number(current.playerNumber)) return current
        return updateOpponentPresence(current, {
          disconnected: true,
          disconnectedPlayerNumber: wsMessage.playerNumber ?? null,
          forfeitDeadlineAt: wsMessage.forfeitDeadlineAt ?? null,
          lastEvent: 'disconnected',
        })
      })
      onStatus?.('Adversaire deconnecte. En attente de reconnexion...')
      return
    }
    if (wsMessage.type === 'PLAYER_RECONNECTED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        if (Number(wsMessage.playerNumber) === Number(current.playerNumber)) return current
        return updateOpponentPresence(current, {
          disconnected: false,
          disconnectedPlayerNumber: null,
          forfeitDeadlineAt: null,
          lastEvent: 'reconnected',
        })
      })
      onStatus?.('Adversaire reconnecte.')
      return
    }
    if (wsMessage.type === 'PLAYER_FORFEITED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        return updateOpponentPresence(current, {
          disconnected: false,
          disconnectedPlayerNumber: null,
          forfeitDeadlineAt: null,
          lastEvent: 'forfeited',
        })
      })
      onStatus?.(`Joueur ${wsMessage.playerNumber} forfait. Partie terminee.`)
      return
    }
    if (wsMessage.type === 'LEFT_GAME') {
      if (wsMessage.ok) {
        setLobbyState(INITIAL_LOBBY_STATE)
      }
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
