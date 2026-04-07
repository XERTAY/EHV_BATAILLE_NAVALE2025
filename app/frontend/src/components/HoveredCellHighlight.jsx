import { useMemo } from 'react'
import * as THREE from 'three'

function HoveredCellHighlight({ hoveredCell, cellSize }) {
  const boxSize = cellSize * 0.86
  const depth = cellSize * 0.36

  const edgeGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(boxSize, boxSize, depth))
  }, [boxSize, depth])

  return (
    <group
      position={[
        hoveredCell.centerX,
        hoveredCell.centerY,
        cellSize * 0.18 + 0.25,
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

export default HoveredCellHighlight
