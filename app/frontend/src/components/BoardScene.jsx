import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, MOUSE, SRGBColorSpace, Vector3 } from 'three'
import { OrbitControls } from '@react-three/drei'
import SceneEnvironment from './SceneEnvironment'
import WaterBoard from './WaterBoard'

const CAMERA_PRESET_STORAGE_PREFIX = 'bataille-navale:camera-preset:'

function cameraInFrontOfBoard(focusBoard, direction = null) {
  const focusX = focusBoard?.position?.[0] ?? 0
  const focusZ = focusBoard?.position?.[2] ?? 0
  const distance = 170
  const cameraY = 150

  if (direction === 'NORTH') return [focusX, cameraY, focusZ - distance]
  if (direction === 'SOUTH') return [focusX, cameraY, focusZ + distance]
  if (direction === 'EAST') return [focusX + distance, cameraY, focusZ]
  if (direction === 'WEST') return [focusX - distance, cameraY, focusZ]

  if (Math.abs(focusX) > Math.abs(focusZ)) {
    const directionX = focusX >= 0 ? 1 : -1
    return [focusX + directionX * distance, cameraY, focusZ]
  }

  const directionZ = focusZ >= 0 ? 1 : -1
  return [focusX, cameraY, focusZ + directionZ * distance]
}

function cameraTopDownOverBoard(focusX, focusZ, direction = null) {
  const altitude = 230
  const offset = 1.2
  if (direction === 'NORTH') return [focusX, altitude, focusZ - offset]
  if (direction === 'SOUTH') return [focusX, altitude, focusZ + offset]
  if (direction === 'EAST') return [focusX + offset, altitude, focusZ]
  if (direction === 'WEST') return [focusX - offset, altitude, focusZ]
  return [focusX, altitude, focusZ + offset]
}

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

function CameraDirector({
  controlsRef,
  focusX,
  focusZ,
  battleView,
  cameraDirection,
  cameraStateKey,
  onCameraDirectionChange,
}) {
  const { camera } = useThree()
  const transitionRef = useRef(null)
  const previousBattleRef = useRef(battleView)
  const initializedRef = useRef(false)
  const previousDirectionRef = useRef(null)

  const savePreset = () => {
    if (!cameraStateKey || !controlsRef.current) return
    const payload = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z],
    }
    window.localStorage.setItem(`${CAMERA_PRESET_STORAGE_PREFIX}${cameraStateKey}`, JSON.stringify(payload))
  }

  const readPreset = () => {
    if (!cameraStateKey) return null
    try {
      const raw = window.localStorage.getItem(`${CAMERA_PRESET_STORAGE_PREFIX}${cameraStateKey}`)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed?.position) || !Array.isArray(parsed?.target)) return null
      if (parsed.position.length !== 3 || parsed.target.length !== 3) return null
      return parsed
    } catch {
      return null
    }
  }

  const startTransition = (toPosition, toTarget, duration = 0.7) => {
    const fromPosition = new Vector3(camera.position.x, camera.position.y, camera.position.z)
    const fromTarget = controlsRef.current
      ? new Vector3(controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z)
      : new Vector3(focusX, 0, focusZ)
    transitionRef.current = {
      elapsed: 0,
      duration,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
    }
  }

  useEffect(() => {
    const targetLookAt = new Vector3(focusX, 0, focusZ)
    const nextPosition = battleView
      ? (() => {
        const [x, y, z] = cameraTopDownOverBoard(focusX, focusZ, cameraDirection)
        return new Vector3(x, y, z)
      })()
      : (() => {
        const base = cameraInFrontOfBoard({ position: [focusX, 0, focusZ] }, cameraDirection)
        return new Vector3(base[0], base[1], base[2])
      })()

    if (!initializedRef.current) {
      camera.position.copy(nextPosition)
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLookAt)
        controlsRef.current.update()
      } else {
        camera.lookAt(targetLookAt)
      }
      initializedRef.current = true
      return
    }

    if (battleView && previousBattleRef.current !== battleView) {
      savePreset()
    }
    startTransition(nextPosition, targetLookAt)
    previousBattleRef.current = battleView
  }, [camera, controlsRef, focusX, focusZ, battleView, cameraDirection, cameraStateKey])

  useFrame((_, delta) => {
    const transition = transitionRef.current
    if (!transition) return
    transition.elapsed += delta
    const t = Math.min(1, transition.elapsed / transition.duration)
    const eased = 1 - ((1 - t) ** 3)
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased)
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(transition.fromTarget, transition.toTarget, eased)
      controlsRef.current.update()
    } else {
      const currentTarget = new Vector3().lerpVectors(transition.fromTarget, transition.toTarget, eased)
      camera.lookAt(currentTarget)
    }
    if (t >= 1) {
      transitionRef.current = null
    }
  })

  useFrame(() => {
    if (!onCameraDirectionChange || !controlsRef.current) return
    const dx = camera.position.x - controlsRef.current.target.x
    const dz = camera.position.z - controlsRef.current.target.z
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return
    let nextDirection = 'NORTH'
    if (Math.abs(dx) >= Math.abs(dz)) {
      nextDirection = dx >= 0 ? 'EAST' : 'WEST'
    } else {
      nextDirection = dz >= 0 ? 'SOUTH' : 'NORTH'
    }
    if (previousDirectionRef.current === nextDirection) return
    previousDirectionRef.current = nextDirection
    onCameraDirectionChange(nextDirection)
  })

  return null
}

function BoardScene({
  boards = [],
  aiBoardIds,
  duelAiFocus = false,
  ownBoardId = 'A1',
  cameraDirection = null,
  cameraStateKey = 'default',
  boardSize = 10,
  boardStatesById,
  recentImpactsByBoard,
  interactiveBoards,
  previewCells,
  previewBoardId,
  showCoordinates,
  waveMode,
  benchmarkEnabled,
  gamePhase,
  topDownView = false,
  onCellHover,
  onCellClick,
  onCameraDirectionChange,
  decorativeOnly = false,
}) {
  const ownBoard = boards.find((board) => board.boardId === ownBoardId) ?? boards[0]
  const battleView = Boolean(topDownView)
  const focusBoard = useMemo(() => {
    if (!battleView) return ownBoard
    if (boards.length === 2) {
      return boards.find((board) => board.boardId !== ownBoardId) ?? ownBoard
    }
    return ownBoard
  }, [battleView, boards, ownBoardId, ownBoard])
  const focusX = focusBoard?.position?.[0] ?? 0
  const focusZ = focusBoard?.position?.[2] ?? 0
  const cameraPosition = decorativeOnly
    ? [0, 130, 230]
    : cameraInFrontOfBoard(focusBoard, cameraDirection)
  const controlsRef = useRef(null)

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
      {!decorativeOnly && (
        <CameraDirector
          controlsRef={controlsRef}
          focusX={focusX}
          focusZ={focusZ}
          battleView={battleView}
          cameraDirection={cameraDirection}
          cameraStateKey={cameraStateKey}
          onCameraDirectionChange={onCameraDirectionChange}
        />
      )}
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
          ref={controlsRef}
          minDistance={battleView ? 85 : 115}
          maxDistance={battleView ? 300 : 380}
          minPolarAngle={battleView ? 0.015 : 0.62}
          maxPolarAngle={battleView ? 0.08 : 1.45}
          enablePan
          screenSpacePanning
          enableRotate={!battleView}
          mouseButtons={
            battleView
              ? {
                LEFT: MOUSE.PAN,
                MIDDLE: MOUSE.DOLLY,
                RIGHT: MOUSE.PAN,
              }
              : undefined
          }
        />
      )}
    </Canvas>
  )
}

export default BoardScene
