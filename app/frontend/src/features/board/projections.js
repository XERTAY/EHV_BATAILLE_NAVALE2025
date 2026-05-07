import { CELL_COLORS } from './boardVisuals'

/**
 * Convertit la matrice d'etat (cellStates) en overlays 2D positionnes en
 * coordonnees monde (en tenant compte des `flipColumns/flipRows`).
 */
export function getColoredCells({
  cellStates,
  flipColumns,
  flipRows,
  cells,
  half,
  cellSize,
  ownBoard = false,
  gamePhase = null,
}) {
  if (!cellStates) return []
  const overlays = []
  for (let y = 0; y < cellStates.length; y += 1) {
    for (let x = 0; x < cellStates[y].length; x += 1) {
      const state = cellStates[y][x]
      if (!ownBoard && gamePhase !== 'GAME_OVER' && state === 'SHIP') continue
      const color = CELL_COLORS[state]
      if (!color) continue
      const rawX = flipColumns ? cells - 1 - x : x
      const rawY = flipRows ? y : cells - 1 - y
      overlays.push({
        x: -half + (rawX + 0.5) * cellSize,
        y: -half + (rawY + 0.5) * cellSize,
        color,
        key: `${x}-${y}`,
      })
    }
  }
  return overlays
}

/** Projete les cellules de preview dans le repere monde. */
export function getProjectedPreviewCells({ previewCells, flipColumns, flipRows, cells, half, cellSize }) {
  if (!previewCells?.length) return []
  return previewCells.map((cell) => {
    const rawX = flipColumns ? cells - 1 - cell.x : cell.x
    const rawY = flipRows ? cell.y : cells - 1 - cell.y
    return {
      key: `preview-${cell.x}-${cell.y}`,
      x: -half + (rawX + 0.5) * cellSize,
      y: -half + (rawY + 0.5) * cellSize,
      inBounds: cell.inBounds !== false,
    }
  })
}

/**
 * Selectionne les cellules a afficher en 3D pour les modeles de navire :
 * - sur sa propre grille : tout est visible,
 * - sinon : seules les cellules SUNK sont revelees.
 * Renvoie `null` si rien n'est a afficher.
 */
export function getRevealedShipModelCells({ cellStates, ownBoard }) {
  if (!cellStates) return null
  if (ownBoard) return cellStates
  let hasSunkCell = false
  const masked = cellStates.map((row) => row.map((cell) => {
    if (cell === 'SUNK') {
      hasSunkCell = true
      return 'SUNK'
    }
    return 'EMPTY'
  }))
  return hasSunkCell ? masked : null
}

/** Projete les impacts recents en coordonnees monde. */
export function getProjectedImpactCells({ recentImpacts, flipColumns, flipRows, cells, half, cellSize }) {
  if (!recentImpacts?.length) return []
  return recentImpacts.map((impact, index) => {
    const rawX = flipColumns ? cells - 1 - impact.x : impact.x
    const rawY = flipRows ? impact.y : cells - 1 - impact.y
    return {
      key: `impact-${impact.x}-${impact.y}-${impact.type}-${index}`,
      x: -half + (rawX + 0.5) * cellSize,
      y: -half + (rawY + 0.5) * cellSize,
      type: impact.type,
      startedAt: impact.startedAt,
    }
  })
}
