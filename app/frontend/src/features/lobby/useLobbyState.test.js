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
      gameId: 'dcc7f8b1-9fa3-4167-a089-494138cc1757',
      boardSize: 12,
      playerCount: 4,
      humanPlayers: 2,
      aiPlayers: 2,
      fleetShipCount: 7,
      fleetTotalCells: 24,
    }, 2)

    expect(result.inLobby).toBe(true)
    expect(result.gameId).toBe('dcc7f8b1-9fa3-4167-a089-494138cc1757')
    expect(result.maxPlayers).toBe(4)
    expect(result.lobbyConfigPreview.playerCount).toBe(4)
    expect(result.lobbyConfigPreview.aiPlayers).toBe(2)
  })

  it('ignore une config d un autre lobby quand un gameId est deja actif', () => {
    const current = {
      ...baseLobbyState,
      inLobby: true,
      gameId: '11111111-1111-1111-1111-111111111111',
      maxPlayers: 2,
      lobbyConfigPreview: {
        ...baseLobbyState.lobbyConfigPreview,
        boardSize: 10,
      },
    }

    const result = applyLobbyConfigUpdate(current, {
      type: 'LOBBY_CONFIG_UPDATED',
      gameId: '22222222-2222-2222-2222-222222222222',
      boardSize: 20,
      playerCount: 4,
    }, 2)

    expect(result).toEqual(current)
  })
})
