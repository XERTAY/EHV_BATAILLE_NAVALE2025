import { useCallback } from 'react'

import { INITIAL_LOBBY_STATE } from '@/features/lobby/useLobbyState'

import { normalizeLobbyGameId } from '@/features/game/gameActionHelpers'

/**
 * Hook dédié aux actions lobby (création / jointure / sortie / démarrage). Extrait de
 * `useGameActions` pour respecter la limite de lignes définie dans CONTRIBUTING.md.
 */
export default function useLobbyActions({
  ws,
  ui,
  setup,
  lobby,
  handleStartGame,
}) {
  const { createGame, joinGame, leaveGame, startGame, state: wsState } = ws
  const { setStatusMessage } = ui
  const { state: lobbyState, setLobbyState } = lobby

  const handleCreateLobby = useCallback((maxPlayers) => {
    createGame(maxPlayers)
  }, [createGame])

  const handleJoinLobby = useCallback((gameId, intent = 'manual') => {
    const normalized = normalizeLobbyGameId(gameId)
    if (!normalized) {
      setStatusMessage('ID de lobby invalide. Format attendu: 4 lettres ou chiffres (ex: a3f9).')
      return
    }
    joinGame(normalized, intent)
  }, [joinGame, setStatusMessage])

  const handleLeaveLobby = useCallback(() => {
    leaveGame()
    setLobbyState(INITIAL_LOBBY_STATE)
    setStatusMessage('Lobby quitte.')
  }, [leaveGame, setLobbyState, setStatusMessage])

  const handleStartLobbyGame = useCallback(async (setupPatch = {}) => {
    const fallbackLobbyGameId = wsState?.gameId ?? null
    const lobbyGameId = lobbyState.gameId ?? fallbackLobbyGameId
    const lobbyPlayerNumber = Number(lobbyState.playerNumber ?? wsState?.playerNumber ?? 1) || 1
    const isHostLike = lobbyState.isHost || lobbyPlayerNumber === 1
    if (!isHostLike || !lobbyGameId) {
      setStatusMessage('Creation du lobby en cours: identifiant de partie non recu.')
      return
    }
    try {
      const requestedPlayerCount = Number(setupPatch.playerCount ?? setup.playerCount) || 2
      const clampedPlayerCount = requestedPlayerCount === 4 ? 4 : 2
      const connectedHumans = Math.max(1, Math.min(Number(lobbyState.players) || 1, clampedPlayerCount))
      const normalizedLobbyPatch = {
        ...setupPatch,
        playerCount: clampedPlayerCount,
        withAI: connectedHumans < clampedPlayerCount,
        humanPlayers: connectedHumans < clampedPlayerCount ? connectedHumans : clampedPlayerCount,
      }
      await handleStartGame({
        keepLobby: true,
        startMode: 'new',
        setupPatch: normalizedLobbyPatch,
        lobbyGameId,
        bootstrapViewerPlayer: lobbyPlayerNumber,
      })
      startGame(lobbyGameId)
    } catch {
      // L'erreur est deja geree dans handleStartGame.
    }
  }, [
    handleStartGame,
    lobbyState.isHost,
    lobbyState.gameId,
    lobbyState.playerNumber,
    lobbyState.players,
    setStatusMessage,
    setup.playerCount,
    startGame,
    wsState?.gameId,
    wsState?.playerNumber,
  ])

  return {
    handleCreateLobby,
    handleJoinLobby,
    handleLeaveLobby,
    handleStartLobbyGame,
  }
}
