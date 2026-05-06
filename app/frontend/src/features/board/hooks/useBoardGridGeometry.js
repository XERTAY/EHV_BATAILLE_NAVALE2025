import { useMemo } from 'react'

const ASCII_A = 65

/**
 * Calcule les positions des lignes de la grille (Float32Array prete a etre
 * envoyee a `bufferAttribute`) ainsi que les libelles d'axes appropries
 * apres flips eventuels.
 */
export default function useBoardGridGeometry({ cells, half, cellSize, flipColumns, flipRows }) {
  const gridPositions = useMemo(() => {
    const positions = []
    for (let i = 0; i <= cells; i += 1) {
      const coord = -half + i * cellSize
      positions.push(-half, coord, 0.08, half, coord, 0.08)
      positions.push(coord, -half, 0.08, coord, half, 0.08)
    }
    return new Float32Array(positions)
  }, [cellSize, cells, half])

  const coordinateLabels = useMemo(
    () => Array.from({ length: cells }, (_, i) => String.fromCharCode(ASCII_A + i)),
    [cells],
  )
  const displayedColumnLabels = useMemo(
    () => (flipColumns ? [...coordinateLabels].reverse() : coordinateLabels),
    [coordinateLabels, flipColumns],
  )
  const displayedRowLabels = useMemo(() => {
    const rows = Array.from({ length: cells }, (_, i) => i + 1)
    return flipRows ? [...rows].reverse() : rows
  }, [cells, flipRows])

  return { gridPositions, displayedColumnLabels, displayedRowLabels }
}
