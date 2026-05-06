/**
 * Indique si une cellule represente une partie de navire (place, touche ou coule).
 */
export function isShipLikeCell(cell) {
  return cell === 'SHIP' || cell === 'HIT' || cell === 'SUNK'
}

const NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function visitConnectedCells({ cellStates, cells, x, y, visited, componentId, componentByCell, keyOf }) {
  const stack = [[x, y]]
  visited.add(keyOf(x, y))
  componentByCell.set(keyOf(x, y), componentId)
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || nx >= cells || ny < 0 || ny >= cells) continue
      if (!isShipLikeCell(cellStates?.[ny]?.[nx])) continue
      const nextKey = keyOf(nx, ny)
      if (visited.has(nextKey)) continue
      visited.add(nextKey)
      componentByCell.set(nextKey, componentId)
      stack.push([nx, ny])
    }
  }
}

/**
 * Construit un index `Map<"x,y", componentId>` qui regroupe les cellules
 * connexes (4-voisinage) en composants de navire.
 */
export function buildShipComponentIndex(cellStates, cells) {
  if (!Array.isArray(cellStates) || cells <= 0) return new Map()
  const visited = new Set()
  const componentByCell = new Map()
  const keyOf = (x, y) => `${x},${y}`
  let componentId = 0
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      if (!isShipLikeCell(cellStates?.[y]?.[x])) continue
      if (visited.has(keyOf(x, y))) continue
      componentId += 1
      visitConnectedCells({ cellStates, cells, x, y, visited, componentId, componentByCell, keyOf })
    }
  }
  return componentByCell
}
