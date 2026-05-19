import { useCallback, useEffect, useRef, useState } from 'react'

import { LOBBY_SYNC_POLL_MS } from '@/constants/timings'

export const INITIAL_LOBBY_STATE = Object.freeze({
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
  gameplaySync: {
    phaseStep: null,
    shooter: null,
    targetPlayer: null,
    shot: null,
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
    gameplaySync: INITIAL_LOBBY_STATE.gameplaySync,
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
    gameplaySync: INITIAL_LOBBY_STATE.gameplaySync,
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

function safePositiveNumber(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

/** Priorise le slot lobby WS (toujours a jour apres JOINED_GAME) puis l etat React lobby. */
export function resolveLobbyPlayerNumber(lobbyState, wsPlayerNumber) {
  const wsPlayer = Number(wsPlayerNumber)
  if (Number.isFinite(wsPlayer) && wsPlayer > 0) return wsPlayer
  const lobbyPlayer = Number(lobbyState?.playerNumber)
  if (lobbyState?.inLobby && Number.isFinite(lobbyPlayer) && lobbyPlayer > 0) return lobbyPlayer
  return 1
}

function shouldAutoEnterGameFromState(state) {
  const phase = state?.phase
  return phase === 'PLACEMENT' || phase === 'BATTLE' || phase === 'GAME_OVER'
}

export function applyLobbyConfigUpdate(current, message, fallbackPlayerCount) {
  const messageGameId = typeof message?.gameId === 'string' ? message.gameId : null
  if (!messageGameId) return current
  if (current.gameId && current.gameId !== messageGameId) return current

  const inferredPlayerCount = safePositiveNumber(message.playerCount, fallbackPlayerCount)
  const shouldBootstrapLobby = !current.inLobby || !current.gameId
  const baseState = shouldBootstrapLobby
    ? {
        ...INITIAL_LOBBY_STATE,
        ...current,
        inLobby: true,
        // Si `GAME_CREATED` est manque, on accepte le snapshot lobby comme source d'identite.
        gameId: messageGameId,
        isHost: current.isHost || Number(current.playerNumber ?? 1) === 1,
        players: safePositiveNumber(current.players, 1),
        maxPlayers: safePositiveNumber(current.maxPlayers, inferredPlayerCount),
        opponentPresence: current.opponentPresence ?? INITIAL_LOBBY_STATE.opponentPresence,
        gameplaySync: current.gameplaySync ?? INITIAL_LOBBY_STATE.gameplaySync,
        lobbyConfigPreview: current.lobbyConfigPreview ?? INITIAL_LOBBY_STATE.lobbyConfigPreview,
      }
    : current

  const preview = baseState.lobbyConfigPreview ?? INITIAL_LOBBY_STATE.lobbyConfigPreview

  return {
    ...baseState,
    maxPlayers: inferredPlayerCount,
    lobbyConfigPreview: {
      boardSize: safePositiveNumber(message.boardSize, preview.boardSize),
      playerCount: safePositiveNumber(message.playerCount, preview.playerCount),
      humanPlayers: safePositiveNumber(message.humanPlayers, preview.humanPlayers),
      aiPlayers: Number.isFinite(Number(message.aiPlayers))
        ? Math.max(0, Number(message.aiPlayers))
        : preview.aiPlayers,
      fleetShipCount: safePositiveNumber(message.fleetShipCount, preview.fleetShipCount),
      fleetTotalCells: safePositiveNumber(message.fleetTotalCells, preview.fleetTotalCells),
    },
  }
}

function updateGameplaySync(current, patch) {
  return {
    ...current,
    gameplaySync: {
      ...current.gameplaySync,
      ...patch,
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
 *   wsPlayerNumber?: number,
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
  wsPlayerNumber = 1,
  onStatus,
}) {
  const [lobbyState, setLobbyState] = useState(INITIAL_LOBBY_STATE)
  const lobbyStateRef = useRef(lobbyState)
  lobbyStateRef.current = lobbyState

  const enterLobbyGameIfReady = useCallback((gameId, playerNumber, status) => {
    const lobbyScope = gameId ?? null
    if (!lobbyScope) return Promise.resolve(null)
    return refreshStateAction(playerNumber, lobbyScope)
      .then((state) => {
        if (!shouldAutoEnterGameFromState(state)) return state
        enterGameScreenWithState(state, status)
        return state
      })
  }, [refreshStateAction, enterGameScreenWithState])

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
        const playerNumber = resolveLobbyPlayerNumber(nextLobby, wsMessage.playerNumber ?? wsPlayerNumber)
        const status =
          wsMessage.gameStatus === 'FINISHED'
            ? (wsMessage.playerResult === 'VICTORY'
                ? 'Partie terminee: victoire. Reconnexion en lecture de fin de partie.'
                : 'Partie terminee: defaite. Reconnexion en lecture de fin de partie.')
            : 'Partie en cours. Reconnexion automatique reussie.'
        enterLobbyGameIfReady(nextLobby.gameId, playerNumber, status)
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
      setLobbyState((current) => applyLobbyConfigUpdate(current, wsMessage, fallbackPlayerCount))
      return
    }
    if (wsMessage.type === 'GAME_STARTED') {
      const current = lobbyStateRef.current
      if (!current.isHost) {
        const lobbyScope = wsMessage.gameId ?? current.gameId ?? null
        const playerNumber = resolveLobbyPlayerNumber(current, wsMessage.playerNumber ?? wsPlayerNumber)
        enterLobbyGameIfReady(lobbyScope, playerNumber, "Partie lancee par l'hote.")
          .catch(() => onStatus?.("Impossible de charger la partie demarree par l hote."))
      }
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
        syncStateAction(resolveLobbyPlayerNumber(current, wsPlayerNumber), wsMessage.gameId).catch(() => {})
        return current
      })
      return
    }
    if (wsMessage.type === 'TARGET_LOCKED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        syncStateAction(resolveLobbyPlayerNumber(current, wsPlayerNumber), wsMessage.gameId).catch(() => {})
        return updateGameplaySync(current, {
          phaseStep: 'firing',
          shooter: wsMessage.shooter ?? null,
          targetPlayer: wsMessage.targetPlayer ?? null,
        })
      })
      return
    }
    if (wsMessage.type === 'SHOT_RESOLVED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        syncStateAction(resolveLobbyPlayerNumber(current, wsPlayerNumber), wsMessage.gameId).catch(() => {})
        return updateGameplaySync(current, {
          phaseStep: wsMessage.currentTargetPlayer ? 'firing' : 'target_selection',
          shooter: wsMessage.shooter ?? null,
          targetPlayer: wsMessage.currentTargetPlayer ?? wsMessage.targetPlayer ?? null,
          shot: wsMessage.x != null && wsMessage.y != null ? { x: wsMessage.x, y: wsMessage.y } : null,
        })
      })
      return
    }
    if (wsMessage.type === 'TURN_PHASE_CHANGED') {
      setLobbyState((current) => {
        if (!current.inLobby || current.gameId !== wsMessage.gameId) return current
        return updateGameplaySync(current, {
          phaseStep: wsMessage.phaseStep ?? null,
          targetPlayer: wsMessage.currentTargetPlayer ?? current.gameplaySync.targetPlayer,
        })
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
  }, [
    wsMessage,
    fallbackPlayerCount,
    refreshStateAction,
    syncStateAction,
    enterGameScreenWithState,
    enterLobbyGameIfReady,
    screen,
    wsPlayerNumber,
    onStatus,
  ])

  // Invité en attente sur le menu : detecte le lancement meme si GAME_STARTED est manque.
  useEffect(() => {
    if (screen !== 'menu' || !lobbyState.inLobby || lobbyState.isHost) return undefined
    const gameId = lobbyState.gameId
    if (!gameId) return undefined
    const playerNumber = resolveLobbyPlayerNumber(lobbyState, wsPlayerNumber)
    const poll = () => {
      enterLobbyGameIfReady(gameId, playerNumber, 'Partie en cours — synchronisation lobby.')
        .catch(() => {})
    }
    poll()
    const pollId = window.setInterval(poll, LOBBY_SYNC_POLL_MS)
    return () => window.clearInterval(pollId)
  }, [
    screen,
    lobbyState.inLobby,
    lobbyState.isHost,
    lobbyState.gameId,
    lobbyState.playerNumber,
    wsPlayerNumber,
    enterLobbyGameIfReady,
  ])

  // Polling regulier de l'etat backend tant qu'on est dans un lobby et sur
  // l'ecran de jeu (complement des messages WS).
  useEffect(() => {
    if (screen !== 'game' || !lobbyState.inLobby) return undefined
    const lobbyScope = lobbyState.gameId ?? null
    const playerNumber = resolveLobbyPlayerNumber(lobbyState, wsPlayerNumber)
    const pollId = window.setInterval(() => {
      syncStateAction(playerNumber, lobbyScope).catch(() => {})
    }, LOBBY_SYNC_POLL_MS)
    return () => window.clearInterval(pollId)
  }, [screen, lobbyState.inLobby, lobbyState.gameId, lobbyState.playerNumber, wsPlayerNumber, syncStateAction])

  const resetLobby = useCallback(() => setLobbyState(INITIAL_LOBBY_STATE), [])

  return { lobbyState, setLobbyState, resetLobby }
}
