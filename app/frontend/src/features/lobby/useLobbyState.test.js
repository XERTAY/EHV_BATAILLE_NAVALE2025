import { describe, expect, it } from 'vitest'

import { applyLobbyConfigUpdate } from './useLobbyState'

const baseLobbyState = Object.freeze({
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

describe('applyLobbyConfigUpdate', () => {
  it('initialise le lobby depuis LOBBY_CONFIG_UPDATED si GAME_CREATED manque', () => {
    const result = applyLobbyConfigUpdate(baseLobbyState, {
      type: 'LOBBY_CONFIG_UPDATED',
      gameId: 'a3f9',
      boardSize: 12,
      playerCount: 4,
      humanPlayers: 2,
      aiPlayers: 2,
      fleetShipCount: 7,
      fleetTotalCells: 24,
    }, 2)

    expect(result.inLobby).toBe(true)
    expect(result.gameId).toBe('a3f9')
    expect(result.maxPlayers).toBe(4)
    expect(result.lobbyConfigPreview.playerCount).toBe(4)
    expect(result.lobbyConfigPreview.aiPlayers).toBe(2)
  })

  it('tolere un etat lobby partiel sans lobbyConfigPreview', () => {
    const partialReset = {
      inLobby: false,
      isHost: false,
      gameId: null,
      players: 0,
      maxPlayers: 0,
      playerNumber: 1,
    }

    const result = applyLobbyConfigUpdate(partialReset, {
      type: 'LOBBY_CONFIG_UPDATED',
      gameId: 'a3f9',
      boardSize: 12,
      playerCount: 2,
    }, 2)

    expect(result.lobbyConfigPreview.boardSize).toBe(12)
    expect(result.inLobby).toBe(true)
  })

  it('ignore une config d un autre lobby quand un gameId est deja actif', () => {
    const current = {
      ...baseLobbyState,
      inLobby: true,
      gameId: 'ab12',
      maxPlayers: 2,
      lobbyConfigPreview: {
        ...baseLobbyState.lobbyConfigPreview,
        boardSize: 10,
      },
    }

    const result = applyLobbyConfigUpdate(current, {
      type: 'LOBBY_CONFIG_UPDATED',
      gameId: 'cd34',
      boardSize: 20,
      playerCount: 4,
    }, 2)

    expect(result).toEqual(current)
  })
})
