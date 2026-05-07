import { describe, expect, it } from 'vitest'

import { getBoardStatesById } from './selectors'

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
