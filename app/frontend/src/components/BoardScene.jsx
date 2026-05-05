import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, MOUSE, SRGBColorSpace, Vector3 } from 'three'
import { OrbitControls } from '@react-three/drei'
import SceneEnvironment from './SceneEnvironment'
import WaterBoard from './WaterBoard'

const CAMERA_PRESET_STORAGE_PREFIX = 'bataille-navale:camera-preset:'

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
  focusBoard,
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

  const inferDirectionFromBoard = () => {
    const boardX = focusBoard?.position?.[0] ?? focusX
    const boardZ = focusBoard?.position?.[2] ?? focusZ
    if (Math.abs(boardX) >= Math.abs(boardZ)) {
      return boardX >= 0 ? 'EAST' : 'WEST'
    }
    return boardZ >= 0 ? 'SOUTH' : 'NORTH'
  }

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

  const startArcTransition = (toPosition, toTarget, direction, arcSideMultiplier = 1) => {
    const fromPosition = new Vector3(camera.position.x, camera.position.y, camera.position.z)
    const fromTarget = controlsRef.current
      ? new Vector3(controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z)
      : new Vector3(focusX, 0, focusZ)

    const baseSideSign = direction === 'EAST' || direction === 'SOUTH' ? 1 : -1
    const sideSign = baseSideSign * (arcSideMultiplier >= 0 ? 1 : -1)
    const sideOffset = 75
    const lift = 35
    const midpoint = new Vector3(
      (fromPosition.x + toPosition.x) * 0.5 + sideSign * sideOffset,
      Math.max(fromPosition.y, toPosition.y) + lift,
      (fromPosition.z + toPosition.z) * 0.5 - sideSign * sideOffset * 0.35,
    )
    const targetMidpoint = new Vector3(
      (fromTarget.x + toTarget.x) * 0.5 + sideSign * sideOffset * 0.25,
      (fromTarget.y + toTarget.y) * 0.5,
      (fromTarget.z + toTarget.z) * 0.5 - sideSign * sideOffset * 0.2,
    )

    transitionRef.current = {
      elapsed: 0,
      duration: 1.15,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcMidpoint: midpoint,
      arcTargetMidpoint: targetMidpoint,
    }
  }

  useEffect(() => {
    const targetLookAt = new Vector3(focusX, 0, focusZ)
    const effectiveDirection = battleView ? inferDirectionFromBoard() : cameraDirection
    const nextPosition = (() => {
      const [x, y, z] = cameraTopDownOverBoard(focusX, focusZ, effectiveDirection)
      return new Vector3(x, y, z)
    })()

    if (!initializedRef.current) {
      initializedRef.current = true
      // Evite toute teleportation: meme la toute premiere mise en place passe
      // par une interpolation depuis la camera courante.
      startTransition(nextPosition, targetLookAt, 0.55)
      previousBattleRef.current = battleView
      return
    }

    if (battleView && previousBattleRef.current !== battleView) {
      savePreset()
    }
    // En entree/sortie de tir: transition en arc sur des cotes opposes.
    if (battleView && !previousBattleRef.current) {
      startArcTransition(nextPosition, targetLookAt, effectiveDirection, -1)
    } else if (!battleView && previousBattleRef.current) {
      startArcTransition(nextPosition, targetLookAt, effectiveDirection, 1)
    } else {
      // Animation fluide mais rapide: rotation et travelling demarrent ensemble.
      startTransition(nextPosition, targetLookAt, battleView ? 0.45 : 0.6)
    }
    previousBattleRef.current = battleView
  }, [camera, controlsRef, focusBoard, focusX, focusZ, battleView, cameraDirection, cameraStateKey])

  useFrame((_, delta) => {
    const transition = transitionRef.current
    if (!transition) return
    transition.elapsed += delta
    const t = Math.min(1, transition.elapsed / transition.duration)
    const eased = transition.arcMidpoint
      ? (t < 0.5 ? 4 * t * t * t : 1 - (((-2 * t + 2) ** 3) / 2))
      : 1 - ((1 - t) ** 3)
    if (transition.arcMidpoint) {
      // Courbe quadratique (Bezier) pour un retour visuel en arc.
      const p0 = transition.fromPosition
      const p1 = transition.arcMidpoint
      const p2 = transition.toPosition
      const oneMinus = 1 - eased
      camera.position.set(
        oneMinus * oneMinus * p0.x + 2 * oneMinus * eased * p1.x + eased * eased * p2.x,
        oneMinus * oneMinus * p0.y + 2 * oneMinus * eased * p1.y + eased * eased * p2.y,
        oneMinus * oneMinus * p0.z + 2 * oneMinus * eased * p1.z + eased * eased * p2.z,
      )
    } else {
      camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased)
    }
    if (controlsRef.current) {
      if (transition.arcTargetMidpoint) {
        const t0 = transition.fromTarget
        const t1 = transition.arcTargetMidpoint
        const t2 = transition.toTarget
        const oneMinus = 1 - eased
        controlsRef.current.target.set(
          oneMinus * oneMinus * t0.x + 2 * oneMinus * eased * t1.x + eased * eased * t2.x,
          oneMinus * oneMinus * t0.y + 2 * oneMinus * eased * t1.y + eased * eased * t2.y,
          oneMinus * oneMinus * t0.z + 2 * oneMinus * eased * t1.z + eased * eased * t2.z,
        )
      } else {
        controlsRef.current.target.lerpVectors(transition.fromTarget, transition.toTarget, eased)
      }
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
    const interactiveEnemyBoard = boards.find(
      (board) => board.boardId !== ownBoardId && Boolean(interactiveBoards?.[board.boardId]),
    )
    if (interactiveEnemyBoard) return interactiveEnemyBoard
    if (boards.length === 2) {
      return boards.find((board) => board.boardId !== ownBoardId) ?? ownBoard
    }
    return ownBoard
  }, [battleView, boards, ownBoardId, ownBoard])
  const focusX = focusBoard?.position?.[0] ?? 0
  const focusZ = focusBoard?.position?.[2] ?? 0
  const cameraPosition = decorativeOnly
    ? [0, 130, 230]
    : cameraTopDownOverBoard(focusX, focusZ, cameraDirection)
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
          focusBoard={focusBoard}
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
          minDistance={85}
          maxDistance={420}
          minPolarAngle={0.015}
          maxPolarAngle={Math.PI - 0.05}
          enablePan
          screenSpacePanning
          enableRotate
          mouseButtons={{
            LEFT: MOUSE.ROTATE,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.PAN,
          }}
        />
      )}
    </Canvas>
  )
}

export default BoardScene
