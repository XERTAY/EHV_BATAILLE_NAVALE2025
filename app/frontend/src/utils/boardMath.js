function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function getCellDataFromLocalPoint(localPoint, options) {
  const { half, cellSize, cells, flipColumns, flipRows } = options
  const rawCellX = clamp(Math.floor((localPoint.x + half) / cellSize), 0, cells - 1)
  const rawCellY = clamp(Math.floor((localPoint.y + half) / cellSize), 0, cells - 1)
  const cellX = flipColumns ? cells - 1 - rawCellX : rawCellX
  const cellY = flipRows ? rawCellY : cells - 1 - rawCellY

  return {
    x: cellX,
    y: cellY,
    centerX: -half + (rawCellX + 0.5) * cellSize,
    centerY: -half + (rawCellY + 0.5) * cellSize,
  }
}

export function getCellLabel({ x, y }) {
  const column = String.fromCharCode(65 + x)
  const row = y + 1
  return `${column}${row}`
}

export function resolveCellFromEvent(event, options) {
  const localPoint = event.object.worldToLocal(event.point.clone())
  return getCellDataFromLocalPoint(localPoint, options)
}
