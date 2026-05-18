import { describe, expect, it } from 'vitest'

import { getBoardStatesById, getTurnOverlayLabel } from './selectors'

describe('getBoardStatesById', () => {
  it('masks enemy SHIP cells during battle', () => {
    const gameState = {
      boards: [
        { boardId: 'A1', ownBoard: true, cells: [['SHIP', 'EMPTY']] },
        { boardId: 'B1', ownBoard: false, cells: [['SHIP', 'HIT']] },
      ],
    }

    const result = getBoardStatesById({ gameState, delayedOwnBoardCells: null, gamePhase: 'BATTLE' })

    expect(result.B1.cells[0][0]).toBe('EMPTY')
    expect(result.B1.cells[0][1]).toBe('HIT')
  })

  it('keeps enemy SHIP cells at game over', () => {
    const gameState = {
      boards: [{ boardId: 'B1', ownBoard: false, cells: [['SHIP', 'EMPTY']] }],
    }

    const result = getBoardStatesById({ gameState, delayedOwnBoardCells: null, gamePhase: 'GAME_OVER' })
    expect(result.B1.cells[0][0]).toBe('SHIP')
  })
})

describe('getTurnOverlayLabel', () => {
  const basePlacement = {
    gamePhase: 'PLACEMENT',
    lobbyInLobby: true,
    isDuelWithAi: false,
    currentIsAi: false,
    remainingShipsCount: 0,
    isLocalTurn: true,
    currentPlayer: 1,
    isGameOver: false,
    didLocalPlayerWin: false,
  }

  it('shows waiting message after local fleet is validated in lobby', () => {
    const label = getTurnOverlayLabel({
      ...basePlacement,
      localPlacementLocked: true,
    })
    expect(label).toBe('En attente des autres joueurs ou des IA...')
  })

  it('shows placement instructions before validation in lobby', () => {
    const label = getTurnOverlayLabel({
      ...basePlacement,
      localPlacementLocked: false,
      remainingShipsCount: 2,
    })
    expect(label).toBe('Placez vos navires puis validez votre flotte.')
  })
})
