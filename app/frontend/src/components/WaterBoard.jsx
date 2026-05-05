import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import GridLabelList from './GridLabelList'
import HoveredCellHighlight from './HoveredCellHighlight'
import FleetShipMeshes from './FleetShipMeshes'
import WaterShaderMaterial from './WaterShaderMaterial'
import { getCellLabel, resolveCellFromEvent } from '../utils/boardMath'

const CELL_COLORS = {
  EMPTY: null,
  SHIP: '#2d9a5e',
  MISS: '#cad8e6',
  HIT: '#f58b33',
  SUNK: '#c23232',
}
const IMPACT_ANIMATION_MS = 3000
const PARTICLE_COUNT = 26

function createImpactParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2
    const ring = 0.35 + ((index % 5) * 0.12)
    const speed = 0.35 + ((index % 7) * 0.09)
    const wobble = 0.2 + ((index % 3) * 0.08)
    const size = 0.18 + ((index % 4) * 0.08)
    return { angle, ring, speed, wobble, size }
  })
}

function ImpactParticles({ cell, cellSize }) {
  const groupRef = useRef(null)
  const particleRefs = useRef([])
  const particles = useMemo(() => createImpactParticles(), [])
  const color = cell.type === 'SUNK' ? '#ff2d2d' : cell.type === 'HIT' ? '#ff9b2f' : '#d6e6f5'

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const nowMs = Date.now()
    const startedAt = Number(cell.startedAt) || 0
    const elapsedMs = Math.max(0, nowMs - startedAt)
    const progress = Math.min(1, elapsedMs / IMPACT_ANIMATION_MS)
    const life = 1 - progress
    const t = elapsedMs * 0.001

    const burstScale = 0.55 + Math.sin(elapsedMs * 0.01) * 0.1
    group.scale.setScalar(0.8 + burstScale * life * 0.9)

    for (let i = 0; i < particles.length; i += 1) {
      const part = particles[i]
      const mesh = particleRefs.current[i]
      if (!mesh?.material) continue

      const radial = (part.ring + progress * (1.2 + part.speed)) * cellSize * 0.26
      const wave = Math.sin(t * (3 + part.speed) + i) * part.wobble * cellSize * 0.05
      const x = Math.cos(part.angle + t * 0.7) * radial + wave
      const y = Math.sin(part.angle + t * 0.7) * radial - wave
      const z = 0.12 + Math.sin(t * 5 + i) * 0.05 + progress * 0.18
      mesh.position.set(x, y, z)

      const s = (part.size * cellSize * 0.1) * (0.7 + life * 1.1)
      mesh.scale.set(s, s, s)
      mesh.material.opacity = Math.max(0.12, 0.25 + life * 0.75)
    }
  })

  return (
    <group ref={groupRef} position={[cell.x, cell.y, 0.08]}>
      {particles.map((part, idx) => (
        <mesh
          key={`p-${cell.key}-${idx}`}
          ref={(node) => { particleRefs.current[idx] = node }}
          renderOrder={8}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function AnimatedImpactCell({ cell, cellSize }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)

  useFrame(() => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (!mesh || !material) return

    const nowMs = Date.now()
    const startedAt = Number(cell.startedAt) || 0
    const elapsedMs = Math.max(0, nowMs - startedAt)
    const progress = Math.min(1, elapsedMs / IMPACT_ANIMATION_MS)
    const life = 1 - progress

    const pulse = Math.sin(elapsedMs * 0.006)
    const blink = Math.sin(elapsedMs * 0.022)
    const dynamicScale = 1 + pulse * 0.12 * (0.4 + life * 0.6)
    mesh.scale.set(dynamicScale, dynamicScale, 1)

    const baseOpacity = 0.46 + life * 0.32
    const blinkOpacity = blink * 0.06 * life
    material.opacity = Math.max(0.18, Math.min(0.92, baseOpacity + blinkOpacity))
  })

  return (
    <mesh ref={meshRef} position={[cell.x, cell.y, 0.07]}>
      <planeGeometry args={[cellSize * 0.95, cellSize * 0.95]} />
      <meshBasicMaterial
        ref={materialRef}
        color={cell.type === 'SUNK' ? '#ff2d2d' : cell.type === 'HIT' ? '#ff9b2f' : '#cad8e6'}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

function WaterBoard({
  boardId,
  size = 100,
  segments = 80,
  cells = 10,
  position = [0, 0, 0],
  rotationY = 0,
  showCoordinates = false,
  flipColumns = false,
  flipRows = false,
  swapColumnLabelSide = false,
  swapRowLabelSide = false,
  waveMode = 'gpu',
  onCellClick,
  showTitle = true,
  showGrid = true,
  showWater = true,
  showAiTag = false,
  interactive = true,
  cellStates = null,
  previewCells = [],
  recentImpacts = [],
  onCellHover,
  ownBoard = false,
}) {
  const [hoveredCell, setHoveredCell] = useState(null)
  const geometryRef = useRef(null)
  const baseVerticesRef = useRef(null)
  const frameCounterRef = useRef(0)

  const cellSize = size / cells
  const half = size / 2
  const boardMathOptions = { half, cellSize, cells, flipColumns, flipRows }

  const gridPositions = useMemo(() => {
    const positions = []
    for (let i = 0; i <= cells; i += 1) {
      const coord = -half + i * cellSize
      positions.push(-half, coord, 0.08, half, coord, 0.08)
      positions.push(coord, -half, 0.08, coord, half, 0.08)
    }
    return new Float32Array(positions)
  }, [cellSize, cells, half])

  const coordinateLabels = useMemo(() => {
    return Array.from({ length: cells }, (_, i) => String.fromCharCode(65 + i))
  }, [cells])

  const displayedColumnLabels = useMemo(() => {
    return flipColumns ? [...coordinateLabels].reverse() : coordinateLabels
  }, [coordinateLabels, flipColumns])

  const displayedRowLabels = useMemo(() => {
    const rows = Array.from({ length: cells }, (_, i) => i + 1)
    return flipRows ? [...rows].reverse() : rows
  }, [cells, flipRows])

  const coloredCells = useMemo(() => {
    if (!cellStates) return []
    const overlays = []
    for (let y = 0; y < cellStates.length; y += 1) {
      for (let x = 0; x < cellStates[y].length; x += 1) {
        const state = cellStates[y][x]
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
  }, [cellStates, flipColumns, flipRows, cells, half, cellSize])

  const projectedPreviewCells = useMemo(() => {
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
  }, [previewCells, flipColumns, flipRows, cells, half, cellSize])

  const revealedShipModelCells = useMemo(() => {
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
  }, [cellStates, ownBoard])

  const projectedImpactCells = useMemo(() => {
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
  }, [recentImpacts, flipColumns, flipRows, cells, half, cellSize])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (waveMode === 'gpu') return

    const geometry = geometryRef.current
    if (!geometry) return

    const positionAttribute = geometry.attributes.position
    if (!baseVerticesRef.current) {
      baseVerticesRef.current = positionAttribute.array.slice()
    }
    const baseVertices = baseVerticesRef.current
    const array = positionAttribute.array

    for (let i = 0; i < positionAttribute.count; i += 1) {
      const idx = i * 3
      const x = baseVertices[idx]
      const y = baseVertices[idx + 1]
      array[idx + 2] =
        Math.sin(x * 0.13 + t * 1.1) * Math.cos(y * 0.11 + t * 1.05) * 1.25 +
        Math.sin(x * 0.05 - t * 0.55) * Math.cos(y * 0.06 - t * 0.5) * 0.75
    }

    positionAttribute.needsUpdate = true
    frameCounterRef.current += 1
    if (frameCounterRef.current % 2 === 0) {
      geometry.computeVertexNormals()
    }
  })

  const onPointerMove = (event) => {
    if (!interactive) return
    const cellData = resolveCellFromEvent(event, boardMathOptions)
    setHoveredCell({
      boardId,
      ...cellData,
    })
    if (onCellHover) {
      onCellHover({
        boardId,
        ...cellData,
      })
    }
  }

  const onPointerDown = (event) => {
    if (!interactive) return
    const cellData = resolveCellFromEvent(event, boardMathOptions)
    if (!onCellClick) return
    onCellClick({
      boardId,
      ...cellData,
      label: getCellLabel(cellData),
    })
  }

  return (
    <group position={position} rotation-y={rotationY + Math.PI}>
      {showTitle && (
        <Html position={[0, 10, half + 8]} center transform sprite>
          <span className="board-title">{`Grille ${boardId}`}</span>
        </Html>
      )}
      {showCoordinates && (
        <>
          <GridLabelList
            axis="column"
            labels={displayedColumnLabels}
            half={half}
            cellSize={cellSize}
            swapLabelSide={swapColumnLabelSide}
            boardId={boardId}
          />
          <GridLabelList
            axis="row"
            labels={displayedRowLabels}
            half={half}
            cellSize={cellSize}
            swapLabelSide={swapRowLabelSide}
            boardId={boardId}
          />
        </>
      )}

      <group rotation-x={-Math.PI / 2}>
        {showAiTag && (
          <Html position={[0, 0, 0.12]} transform sprite>
            <span className="board-ai-tag">IA</span>
          </Html>
        )}

        <mesh
          onPointerMove={onPointerMove}
          onPointerOut={() => {
            if (interactive) {
              setHoveredCell(null)
              if (onCellHover) onCellHover(null)
            }
          }}
          onPointerDown={onPointerDown}
        >
          <planeGeometry ref={geometryRef} args={[size, size, segments, segments]} />
          {showWater && waveMode === 'gpu' ? (
            <WaterShaderMaterial />
          ) : showWater ? (
            <meshPhysicalMaterial
              color="#00cfff"
              roughness={0.18}
              metalness={0.25}
              transmission={0.1}
              thickness={0.6}
              clearcoat={0.65}
              clearcoatRoughness={0.2}
            />
          ) : (
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          )}
        </mesh>

        {showGrid && (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[gridPositions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#99f3ff" transparent opacity={0.72} />
          </lineSegments>
        )}

        {coloredCells.map((cell) => (
          <mesh key={cell.key} position={[cell.x, cell.y, 0.05]}>
            <planeGeometry args={[cellSize * 0.88, cellSize * 0.88]} />
            <meshBasicMaterial color={cell.color} transparent opacity={0.8} />
          </mesh>
        ))}

        {revealedShipModelCells && (
          <FleetShipMeshes
            cellStates={revealedShipModelCells}
            previewCells={previewCells}
            recentImpacts={recentImpacts}
            cells={cells}
            half={half}
            cellSize={cellSize}
            flipColumns={flipColumns}
            flipRows={flipRows}
            showPreviewGhost={ownBoard && Boolean(previewCells?.length)}
          />
        )}

        {projectedPreviewCells.map((cell) => (
          <mesh key={cell.key} position={[cell.x, cell.y, 0.06]}>
            <planeGeometry args={[cellSize * 0.88, cellSize * 0.88]} />
            <meshBasicMaterial color={cell.inBounds ? '#5fd4ff' : '#ff4b4b'} transparent opacity={0.45} />
          </mesh>
        ))}

        {projectedImpactCells.map((cell) => (
          <group key={cell.key}>
            <AnimatedImpactCell cell={cell} cellSize={cellSize} />
            <ImpactParticles cell={cell} cellSize={cellSize} />
          </group>
        ))}

        {interactive && hoveredCell && (
          <HoveredCellHighlight hoveredCell={hoveredCell} cellSize={cellSize} />
        )}
      </group>
    </group>
  )
}

export default WaterBoard
