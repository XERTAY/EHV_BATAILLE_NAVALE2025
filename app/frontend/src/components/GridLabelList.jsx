import { Html } from '@react-three/drei'

function GridLabelList({ axis, labels, half, cellSize, swapLabelSide, boardId }) {
  return labels.map((label, index) => {
    const isColumn = axis === 'column'
    const x = isColumn ? -half + (index + 0.5) * cellSize : swapLabelSide ? half + 4 : -half - 4
    const z = isColumn ? (swapLabelSide ? half + 4 : -half - 4) : -half + (index + 0.5) * cellSize
    const kind = isColumn ? 'col' : 'row'

    return (
      <Html key={`${boardId}-${kind}-${label}`} position={[x, 1.5, z]} center transform sprite>
        <span className="board-label">{label}</span>
      </Html>
    )
  })
}

export default GridLabelList
