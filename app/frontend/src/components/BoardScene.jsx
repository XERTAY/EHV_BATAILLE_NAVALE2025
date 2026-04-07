import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
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
  boards,
  boardSize = 10,
  boardStatesById,
  interactiveBoards,
  previewCells,
  previewBoardId,
  showCoordinates,
  waveMode,
  benchmarkEnabled,
  onCellHover,
  onCellClick,
}) {
  return (
    <Canvas camera={{ position: [0, 150, 185], fov: 45 }}>
      <color attach="background" args={['#06131f']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[25, 40, 15]} intensity={1.1} />
      <directionalLight position={[-30, 25, -10]} intensity={0.4} />
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
      {boards.map((board) => (
        <WaterBoard
          key={board.boardId}
          boardId={board.boardId}
          cells={boardSize}
          cellStates={boardStatesById?.[board.boardId]?.cells}
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
          interactive={Boolean(interactiveBoards?.[board.boardId])}
          waveMode={waveMode}
          onCellHover={onCellHover}
          onCellClick={onCellClick}
        />
      ))}
      <OrbitControls
        minDistance={115}
        maxDistance={380}
        minPolarAngle={0.62}
        maxPolarAngle={1.45}
        enablePan
      />
    </Canvas>
  )
}

export default BoardScene
