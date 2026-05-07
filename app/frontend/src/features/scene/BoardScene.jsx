import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { ACESFilmicToneMapping, MOUSE, SRGBColorSpace } from 'three'

import WaterBoard from '@/features/board/WaterBoard'
import CameraDirector from '@/features/camera/CameraDirector'
import { cameraTopDownOverBoard } from '@/features/camera/cameraMath'
import {
  BOARD_ID_TO_PLAYER,
  FACE_OFF_CAMERA_DIRECTION_BY_PLAYER,
  STAR4_CAMERA_DIRECTION_BY_PLAYER,
} from '@/constants/game'

import PerformanceProbe from './PerformanceProbe'
import SceneEnvironment from './SceneEnvironment'

const DECORATIVE_CAMERA_POSITION = [0, 130, 230]
const OCEAN_BOARD_POSITION = [0, -1.5, 0]

function selectFocusBoard({
  battleView,
  boards,
  ownBoard,
  ownBoardId,
  interactiveBoards,
  selectedTargetBoardId,
  currentTargetPlayer,
}) {
  if (!battleView) return ownBoard
  if (selectedTargetBoardId) {
    const selected = boards.find((board) => board.boardId === selectedTargetBoardId)
    if (selected) return selected
  }
  if (currentTargetPlayer) {
    const targetBoard = boards[currentTargetPlayer - 1]
    if (targetBoard?.boardId) return targetBoard
  }
  const interactiveEnemyBoard = boards.find(
    (board) => board.boardId !== ownBoardId && Boolean(interactiveBoards?.[board.boardId]),
  )
  if (interactiveEnemyBoard) return interactiveEnemyBoard
  if (boards.length === 2) {
    return boards.find((board) => board.boardId !== ownBoardId) ?? ownBoard
  }
  return ownBoard
}

function getDefaultDirectionForBoard(boardId, boardsCount) {
  const playerNumber = BOARD_ID_TO_PLAYER[boardId]
  if (!playerNumber) return null
  if (boardsCount > 2) return STAR4_CAMERA_DIRECTION_BY_PLAYER[playerNumber] ?? null
  return FACE_OFF_CAMERA_DIRECTION_BY_PLAYER[playerNumber] ?? null
}

function PlayerBoards({
  boards,
  boardSize,
  boardStatesById,
  recentImpactsByBoard,
  previewCells,
  previewBoardId,
  showCoordinates,
  aiBoardIds,
  interactiveBoards,
  targetSelectionView,
  selectedTargetBoardId,
  waveMode,
  gamePhase,
  onCellHover,
  onCellClick,
}) {
  return boards.map((board) => (
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
      boardSelectable={targetSelectionView}
      boardSelected={selectedTargetBoardId === board.boardId}
      gamePhase={gamePhase}
      waveMode={waveMode}
      onCellHover={onCellHover}
      onCellClick={onCellClick}
    />
  ))
}

/**
 * Scene 3D : compose le Canvas R3F, l'environnement (ciel/lumieres), la sonde
 * de performance, le director de camera, l'ocean decoratif et les plateaux
 * jouables. Toute la logique camera vit dans `CameraDirector`.
 */
export default function BoardScene({
  boards = [],
  aiBoardIds,
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
  topDownView = false,
  targetSelectionView = false,
  onCellHover,
  onCellClick,
  onCameraDirectionChange,
  selectedTargetBoardId = null,
  currentTargetPlayer = null,
  decorativeOnly = false,
  gamePhase = null,
}) {
  const battleView = Boolean(topDownView)
  const ownBoard = boards.find((board) => board.boardId === ownBoardId) ?? boards[0]
  const focusBoard = useMemo(
    () => selectFocusBoard({
      battleView,
      boards,
      ownBoard,
      ownBoardId,
      interactiveBoards,
      selectedTargetBoardId,
      currentTargetPlayer,
    }),
    [battleView, boards, ownBoard, ownBoardId, interactiveBoards, selectedTargetBoardId, currentTargetPlayer],
  )
  const focusDirection = useMemo(
    () => getDefaultDirectionForBoard(focusBoard?.boardId, boards.length),
    [focusBoard?.boardId, boards.length],
  )
  const focusX = focusBoard?.position?.[0] ?? 0
  const focusZ = focusBoard?.position?.[2] ?? 0
  const cameraPosition = decorativeOnly
    ? DECORATIVE_CAMERA_POSITION
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
          focusDirection={focusDirection}
          cameraStateKey={cameraStateKey}
          boards={boards}
          targetSelectionView={targetSelectionView}
          onCameraDirectionChange={onCameraDirectionChange}
        />
      )}
      <WaterBoard
        boardId="Ocean"
        size={2400}
        segments={180}
        cells={10}
        position={OCEAN_BOARD_POSITION}
        rotationY={0}
        showTitle={false}
        showCoordinates={false}
        showGrid={false}
        showWater
        interactive={false}
        waveMode={waveMode}
        gamePhase={gamePhase}
      />
      {!decorativeOnly ? (
        <PlayerBoards
          boards={boards}
          boardSize={boardSize}
          boardStatesById={boardStatesById}
          recentImpactsByBoard={recentImpactsByBoard}
          previewCells={previewCells}
          previewBoardId={previewBoardId}
          showCoordinates={showCoordinates}
          aiBoardIds={aiBoardIds}
          interactiveBoards={interactiveBoards}
          targetSelectionView={targetSelectionView}
          selectedTargetBoardId={selectedTargetBoardId}
          waveMode={waveMode}
          gamePhase={gamePhase}
          onCellHover={onCellHover}
          onCellClick={onCellClick}
        />
      ) : null}
      {!decorativeOnly ? (
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
      ) : null}
    </Canvas>
  )
}
