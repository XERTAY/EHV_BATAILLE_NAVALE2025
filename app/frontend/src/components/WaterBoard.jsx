import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import GridLabelList from './GridLabelList'
import HoveredCellHighlight from './HoveredCellHighlight'
import WaterShaderMaterial from './WaterShaderMaterial'
import { getCellLabel, resolveCellFromEvent } from '../utils/boardMath'

const CELL_COLORS = {
  EMPTY: null,
  SHIP: '#2d9a5e',
  MISS: '#cad8e6',
  HIT: '#f58b33',
  SUNK: '#c23232',
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
  interactive = true,
  cellStates = null,
  previewCells = [],
  onCellHover,
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
      }
    })
  }, [previewCells, flipColumns, flipRows, cells, half, cellSize])

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

        {projectedPreviewCells.map((cell) => (
          <mesh key={cell.key} position={[cell.x, cell.y, 0.06]}>
            <planeGeometry args={[cellSize * 0.88, cellSize * 0.88]} />
            <meshBasicMaterial color="#5fd4ff" transparent opacity={0.45} />
          </mesh>
        ))}

        {interactive && hoveredCell && (
          <HoveredCellHighlight hoveredCell={hoveredCell} cellSize={cellSize} />
        )}
      </group>
    </group>
  )
}

export default WaterBoard
