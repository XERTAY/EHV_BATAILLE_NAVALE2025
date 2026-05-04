const SHIP_LIKE = new Set(['SHIP', 'HIT', 'SUNK'])

function cellKey(x, y) {
  return `${x},${y}`
}

/**
 * Extrait des segments rectilignes (navires) à partir des états de cases.
 * Utilise une composante 4-voisins sur les cases SHIP / HIT / SUNK.
 */
export function extractShipSegments(cellStates, cells) {
  if (!cellStates?.length) return []
  const visited = new Set()
  const segments = []

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      if (!SHIP_LIKE.has(cellStates[y][x])) continue
      const startKey = cellKey(x, y)
      if (visited.has(startKey)) continue

      const stack = [[x, y]]
      visited.add(startKey)
      const component = []

      while (stack.length > 0) {
        const [cx, cy] = stack.pop()
        component.push([cx, cy])
        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ]
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= cells || ny < 0 || ny >= cells) continue
          if (!SHIP_LIKE.has(cellStates[ny][nx])) continue
          const k = cellKey(nx, ny)
          if (visited.has(k)) continue
          visited.add(k)
          stack.push([nx, ny])
        }
      }

      const xs = component.map(([px]) => px)
      const ys = component.map(([, py]) => py)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const width = maxX - minX + 1
      const height = maxY - minY + 1
      const orientation = width >= height ? 'HORIZONTAL' : 'VERTICAL'
      const length = Math.max(width, height)
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      segments.push({
        key: `ship-${minX}-${minY}-${maxX}-${maxY}-${length}`,
        minX,
        maxX,
        minY,
        maxY,
        length,
        orientation,
        centerX,
        centerY,
      })
    }
  }

  return segments
}

export function buildPreviewSegment(previewCells, cells) {
  if (!previewCells?.length) return null
  const xs = previewCells.map((c) => c.x)
  const ys = previewCells.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (minX < 0 || maxX >= cells || minY < 0 || maxY >= cells) return null

  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const orientation = width >= height ? 'HORIZONTAL' : 'VERTICAL'
  const length = previewCells.length
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  const previewKey = previewCells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join('|')

  return {
    key: `preview-${previewKey}`,
    minX,
    maxX,
    minY,
    maxY,
    length,
    orientation,
    centerX,
    centerY,
    ghost: true,
  }
}
