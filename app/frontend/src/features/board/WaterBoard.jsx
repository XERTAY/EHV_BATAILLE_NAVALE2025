import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import FleetShipMeshes from '@/features/ships/FleetShipMeshes'

import GridLabelList from './GridLabelList'
import HoveredCellHighlight from './HoveredCellHighlight'
import ImpactFx from './ImpactFx'
import WaterShaderMaterial from './WaterShaderMaterial'
import useBoardGridGeometry from './hooks/useBoardGridGeometry'
import useBoardPointer from './hooks/useBoardPointer'
import useCpuWaveAnimation from './hooks/useCpuWaveAnimation'
import {
  getColoredCells,
  getProjectedImpactCells,
  getProjectedPreviewCells,
  getRevealedShipModelCells,
} from './projections'

function WaterMaterial({ showWater, waveMode }) {
  if (showWater && waveMode === 'gpu') return <WaterShaderMaterial />
  if (showWater) {
    return (
      <meshPhysicalMaterial
        color="#00cfff"
        roughness={0.18}
        metalness={0.25}
        transmission={0.1}
        thickness={0.6}
        clearcoat={0.65}
        clearcoatRoughness={0.2}
        side={THREE.DoubleSide}
      />
    )
  }
  return <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
}

function GridLines({ gridPositions }) {
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[gridPositions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#99f3ff" transparent opacity={0.72} />
    </lineSegments>
  )
}

function ColoredCellOverlays({ coloredCells, cellSize }) {
  return coloredCells.map((cell) => (
    <mesh key={cell.key} position={[cell.x, cell.y, 0.05]}>
      <planeGeometry args={[cellSize * 0.88, cellSize * 0.88]} />
      <meshBasicMaterial color={cell.color} transparent opacity={0.8} />
    </mesh>
  ))
}

function PreviewOverlays({ previewCells, cellSize }) {
  return previewCells.map((cell) => (
    <mesh key={cell.key} position={[cell.x, cell.y, 0.06]}>
      <planeGeometry args={[cellSize * 0.88, cellSize * 0.88]} />
      <meshBasicMaterial color={cell.inBounds ? '#5fd4ff' : '#ff4b4b'} transparent opacity={0.45} />
    </mesh>
  ))
}

function BoardSelectionOverlay({ size, selected, hovered }) {
  if (!selected && !hovered) return null
  return (
    <mesh position={[0, 0, 0.08]}>
      <planeGeometry args={[size * 0.96, size * 0.96]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={selected ? 0.5 : 0.32}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Plateau de jeu rendu en R3F : ocean/grille, overlays d'etat, navires 3D,
 * highlights de placement, FX d'impact et boussole de cellule survolee.
 */
export default function WaterBoard({
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
  boardSelectable = false,
  boardSelected = false,
  gamePhase = null,
}) {
  const geometryRef = useRef(null)
  const cellSize = size / cells
  const half = size / 2
  const boardMathOptions = { half, cellSize, cells, flipColumns, flipRows }

  const { gridPositions, displayedColumnLabels, displayedRowLabels } = useBoardGridGeometry({
    cells,
    half,
    cellSize,
    flipColumns,
    flipRows,
  })
  useCpuWaveAnimation({ geometryRef, waveMode })
  const { hoveredCell, isBoardHovered, onPointerMove, onPointerOut, onPointerDown } = useBoardPointer({
    boardId,
    interactive,
    boardMathOptions,
    onCellHover,
    onCellClick,
  })

  const coloredCells = useMemo(
    () => getColoredCells({ cellStates, flipColumns, flipRows, cells, half, cellSize, ownBoard, gamePhase }),
    [cellStates, flipColumns, flipRows, cells, half, cellSize, ownBoard, gamePhase],
  )
  const projectedPreviewCells = useMemo(
    () => getProjectedPreviewCells({ previewCells, flipColumns, flipRows, cells, half, cellSize }),
    [previewCells, flipColumns, flipRows, cells, half, cellSize],
  )
  const revealedShipModelCells = useMemo(
    () => getRevealedShipModelCells({ cellStates, ownBoard }),
    [cellStates, ownBoard],
  )
  const projectedImpactCells = useMemo(
    () => getProjectedImpactCells({ recentImpacts, flipColumns, flipRows, cells, half, cellSize }),
    [recentImpacts, flipColumns, flipRows, cells, half, cellSize],
  )

  return (
    <group position={position} rotation-y={rotationY + Math.PI}>
      {showTitle ? (
        <Html position={[0, 10, half + 8]} center transform sprite>
          <span className="board-title">{`Grille ${boardId}`}</span>
        </Html>
      ) : null}
      {showCoordinates ? (
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
      ) : null}

      <group rotation-x={-Math.PI / 2}>
        {showAiTag ? (
          <Html position={[0, 0, 0.12]} transform sprite>
            <span className="board-ai-tag">IA</span>
          </Html>
        ) : null}

        <mesh
          onPointerMove={onPointerMove}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
        >
          <planeGeometry ref={geometryRef} args={[size, size, segments, segments]} />
          <WaterMaterial showWater={showWater} waveMode={waveMode} />
        </mesh>

        {showGrid ? <GridLines gridPositions={gridPositions} /> : null}
        {boardSelectable ? (
          <BoardSelectionOverlay size={size} selected={boardSelected} hovered={isBoardHovered} />
        ) : null}

        <ColoredCellOverlays coloredCells={coloredCells} cellSize={cellSize} />

        {revealedShipModelCells ? (
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
        ) : null}

        <PreviewOverlays previewCells={projectedPreviewCells} cellSize={cellSize} />

        {projectedImpactCells.map((cell) => (
          <ImpactFx key={cell.key} cell={cell} cellSize={cellSize} />
        ))}

        {interactive && hoveredCell ? (
          <HoveredCellHighlight hoveredCell={hoveredCell} cellSize={cellSize} />
        ) : null}
      </group>
    </group>
  )
}
