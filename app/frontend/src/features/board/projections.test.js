import { describe, expect, it } from 'vitest'

import { getColoredCells } from './projections'

const baseArgs = {
  flipColumns: false,
  flipRows: false,
  cells: 2,
  half: 1,
  cellSize: 1,
}

describe('getColoredCells', () => {
  it('does not render enemy SHIP overlays during battle', () => {
    const overlays = getColoredCells({
      ...baseArgs,
      ownBoard: false,
      gamePhase: 'BATTLE',
      cellStates: [['SHIP', 'HIT']],
    })

    expect(overlays).toHaveLength(1)
    expect(overlays[0].key).toBe('1-0')
  })

  it('renders own SHIP overlays', () => {
    const overlays = getColoredCells({
      ...baseArgs,
      ownBoard: true,
      gamePhase: 'BATTLE',
      cellStates: [['SHIP', 'HIT']],
    })

    expect(overlays).toHaveLength(2)
  })
})
