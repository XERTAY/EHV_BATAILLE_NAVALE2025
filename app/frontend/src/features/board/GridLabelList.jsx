import { Html } from '@react-three/drei'

const LABEL_OFFSET = 4
const LABEL_HEIGHT = 1.5

/**
 * Liste de labels HTML alignes sur les axes du plateau (colonnes A-J,
 * lignes 1-10), positionnes en R3F via `<Html transform sprite>`.
 */
export default function GridLabelList({ axis, labels, half, cellSize, swapLabelSide, boardId }) {
  return labels.map((label, index) => {
    const isColumn = axis === 'column'
    const x = isColumn
      ? -half + (index + 0.5) * cellSize
      : swapLabelSide ? half + LABEL_OFFSET : -half - LABEL_OFFSET
    const z = isColumn
      ? (swapLabelSide ? half + LABEL_OFFSET : -half - LABEL_OFFSET)
      : -half + (index + 0.5) * cellSize
    const kind = isColumn ? 'col' : 'row'
    return (
      <Html
        key={`${boardId}-${kind}-${label}`}
        position={[x, LABEL_HEIGHT, z]}
        center
        transform
        sprite
        zIndexRange={[0, 2]}
      >
        <span className="board-label">{label}</span>
      </Html>
    )
  })
}
