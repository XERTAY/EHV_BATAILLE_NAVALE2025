import { useMemo } from 'react'
import * as THREE from 'three'

const BOX_SIZE_FACTOR = 0.86
const DEPTH_FACTOR = 0.36
const FLOAT_OFFSET = 0.25
const FLOAT_HEIGHT = 0.18

/**
 * Surbrillance flottante de la cellule survolee : box translucide + arretes.
 */
export default function HoveredCellHighlight({ hoveredCell, cellSize }) {
  const boxSize = cellSize * BOX_SIZE_FACTOR
  const depth = cellSize * DEPTH_FACTOR

  const edgeGeometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(boxSize, boxSize, depth)),
    [boxSize, depth],
  )

  return (
    <group
      position={[
        hoveredCell.centerX,
        hoveredCell.centerY,
        cellSize * FLOAT_HEIGHT + FLOAT_OFFSET,
      ]}
    >
      <mesh>
        <boxGeometry args={[boxSize, boxSize, depth]} />
        <meshStandardMaterial
          color="#7ef4ff"
          emissive="#38deff"
          emissiveIntensity={0.6}
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#cfffff" transparent opacity={0.95} />
      </lineSegments>
    </group>
  )
}
