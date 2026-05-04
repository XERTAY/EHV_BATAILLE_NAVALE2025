import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { OrbitControls } from '@react-three/drei'
import SceneEnvironment from './SceneEnvironment'
import WaterBoard from './WaterBoard'

function PerformanceProbe({ enabled, waveMode }) {
  const samplesRef = useRef([])
  const elapsedRef = useRef(0)

  useEffect(() => {
    samplesRef.current = []
    elapsedRef.current = 0
  }, [enabled, waveMode])

  useFrame((_, delta) => {
    if (!enabled) return
    const frameMs = delta * 1000
    samplesRef.current.push(frameMs)
    elapsedRef.current += delta

    if (elapsedRef.current < 5) return

    const samples = samplesRef.current.slice().sort((a, b) => a - b)
    const count = samples.length
    const avg = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, count)
    const p95 = samples[Math.min(count - 1, Math.floor(count * 0.95))]
    const drops = samples.filter((value) => value > 22).length
    const fps = avg > 0 ? 1000 / avg : 0

    console.info(
      `[Perf] mode=${waveMode} fps=${fps.toFixed(1)} avgMs=${avg.toFixed(2)} p95Ms=${p95.toFixed(2)} drops(>22ms)=${drops}/${count}`,
    )

    samplesRef.current = []
    elapsedRef.current = 0
  })

  return null
}

function BoardScene({
  boards = [],
  aiBoardIds,
  duelAiFocus = false,
  ownBoardId = 'A1',
  boardSize = 10,
  boardStatesById,
  recentImpactsByBoard,
  interactiveBoards,
  previewCells,
  previewBoardId,
  showCoordinates,
  waveMode,
  benchmarkEnabled,
  onCellHover,
  onCellClick,
  decorativeOnly = false,
}) {
  const focusBoard = boards.find((board) => board.boardId === ownBoardId) ?? boards[0]
  const focusX = focusBoard?.position?.[0] ?? 0
  const focusZ = focusBoard?.position?.[2] ?? 0
  const focusDirection = focusZ >= 0 ? 1 : -1
  const cameraPosition = decorativeOnly
    ? [0, 130, 230]
    : duelAiFocus
    ? [focusX, 150, focusZ + focusDirection * 170]
    : [0, 150, 185]

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 45 }}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1,
        outputColorSpace: SRGBColorSpace,
      }}
    >
      <color attach="background" args={['#0b1524']} />
      <fog attach="fog" args={['#0b1524', 280, 2200]} />
      <SceneEnvironment />
      <PerformanceProbe enabled={benchmarkEnabled} waveMode={waveMode} />
      <WaterBoard
        boardId="Ocean"
        size={2400}
        segments={180}
        cells={10}
        position={[0, -1.5, 0]}
        rotationY={0}
        showTitle={false}
        showCoordinates={false}
        showGrid={false}
        showWater
        interactive={false}
        waveMode={waveMode}
      />
      {!decorativeOnly && boards.map((board) => (
        <WaterBoard
          key={board.boardId}
          boardId={board.boardId}
          cells={boardSize}
          cellStates={boardStatesById?.[board.boardId]?.cells}
          ownBoard={Boolean(boardStatesById?.[board.boardId]?.ownBoard)}
          recentImpacts={recentImpactsByBoard?.[board.boardId] ?? []}
          previewCells={board.boardId === previewBoardId ? previewCells : []}
          position={board.position}
          rotationY={board.rotationY}
          showCoordinates={showCoordinates}
          flipColumns={board.flipColumns}
          flipRows={board.flipRows}
          swapColumnLabelSide={board.swapColumnLabelSide}
          swapRowLabelSide={board.swapRowLabelSide}
          showWater={false}
          showGrid
          showTitle
          showAiTag={Boolean(aiBoardIds?.has(board.boardId))}
          interactive={Boolean(interactiveBoards?.[board.boardId])}
          waveMode={waveMode}
          onCellHover={onCellHover}
          onCellClick={onCellClick}
        />
      ))}
      {!decorativeOnly && (
        <OrbitControls
          target={[focusX, 0, focusZ]}
          minDistance={115}
          maxDistance={380}
          minPolarAngle={0.62}
          maxPolarAngle={1.45}
          enablePan
          enableRotate
        />
      )}
    </Canvas>
  )
}

export default BoardScene
