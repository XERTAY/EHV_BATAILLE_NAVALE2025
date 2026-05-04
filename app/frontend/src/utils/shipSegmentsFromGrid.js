const SHIP_LIKE = new Set(['SHIP', 'HIT', 'SUNK'])

function cellKey(x, y) {
  return `${x},${y}`
}

/**
 * Extrait des segments rectilignes (navires) à partir des états de cases.
 * On évite de fusionner des navires adjacents (cote a cote) en decomposant
 * chaque composante en lignes droites successives.
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
      const remaining = new Set(component.map(([px, py]) => cellKey(px, py)))

      while (remaining.size > 0) {
        let bestRun = null

        for (const key of remaining) {
          const [xStr, yStr] = key.split(',')
          const x = Number(xStr)
          const y = Number(yStr)

          let minX = x
          let maxX = x
          while (remaining.has(cellKey(minX - 1, y))) minX -= 1
          while (remaining.has(cellKey(maxX + 1, y))) maxX += 1
          const horizontalLength = maxX - minX + 1

          let minY = y
          let maxY = y
          while (remaining.has(cellKey(x, minY - 1))) minY -= 1
          while (remaining.has(cellKey(x, maxY + 1))) maxY += 1
          const verticalLength = maxY - minY + 1

          const horizontalCandidate = {
            orientation: 'HORIZONTAL',
            minX,
            maxX,
            minY: y,
            maxY: y,
            length: horizontalLength,
          }
          const verticalCandidate = {
            orientation: 'VERTICAL',
            minX: x,
            maxX: x,
            minY,
            maxY,
            length: verticalLength,
          }

          const localBest = horizontalLength >= verticalLength ? horizontalCandidate : verticalCandidate
          if (!bestRun || localBest.length > bestRun.length) {
            bestRun = localBest
          }
        }

        if (!bestRun) break

        const segmentCells = []
        if (bestRun.orientation === 'HORIZONTAL') {
          for (let sx = bestRun.minX; sx <= bestRun.maxX; sx += 1) {
            segmentCells.push([sx, bestRun.minY])
          }
        } else {
          for (let sy = bestRun.minY; sy <= bestRun.maxY; sy += 1) {
            segmentCells.push([bestRun.minX, sy])
          }
        }

        for (const [sx, sy] of segmentCells) {
          remaining.delete(cellKey(sx, sy))
        }

        const centerX = (bestRun.minX + bestRun.maxX) / 2
        const centerY = (bestRun.minY + bestRun.maxY) / 2
        segments.push({
          key: `ship-${bestRun.orientation}-${bestRun.minX}-${bestRun.minY}-${bestRun.maxX}-${bestRun.maxY}`,
          minX: bestRun.minX,
          maxX: bestRun.maxX,
          minY: bestRun.minY,
          maxY: bestRun.maxY,
          length: bestRun.length,
          orientation: bestRun.orientation,
          centerX,
          centerY,
        })
      }
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
