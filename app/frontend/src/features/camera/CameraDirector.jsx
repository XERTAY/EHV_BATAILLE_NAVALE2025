import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { cameraTopDownOverBoard, cameraTopDownOverview, inferDirectionFromBoard, inferDirectionFromOffset } from './cameraMath'
import { savePreset } from './cameraPresetStorage'
import { bezierAt, computeArcMidpoints, easeTransition, isOffsetSignificant } from './cameraTransitions'

const DEFAULT_TRANSITION_S = 0.7
const FIRST_TRANSITION_S = 0.55
const ARC_TRANSITION_S = 1.15
const ENTER_BATTLE_TRANSITION_S = 0.45
const EXIT_BATTLE_TRANSITION_S = 0.6

function buildTransitionState({ camera, controls, focusX, focusZ, toPosition, toTarget, duration, arc }) {
  const fromPosition = new Vector3(camera.position.x, camera.position.y, camera.position.z)
  const fromTarget = controls
    ? new Vector3(controls.target.x, controls.target.y, controls.target.z)
    : new Vector3(focusX, 0, focusZ)
  const base = { elapsed: 0, duration, fromPosition, fromTarget, toPosition, toTarget }
  if (!arc) return base
  return { ...base, arcMidpoint: arc.arcMidpoint, arcTargetMidpoint: arc.arcTargetMidpoint }
}

function applyArcInterpolation({ controls, camera, transition, eased }) {
  camera.position.set(
    bezierAt({ p0: transition.fromPosition.x, p1: transition.arcMidpoint.x, p2: transition.toPosition.x, t: eased }),
    bezierAt({ p0: transition.fromPosition.y, p1: transition.arcMidpoint.y, p2: transition.toPosition.y, t: eased }),
    bezierAt({ p0: transition.fromPosition.z, p1: transition.arcMidpoint.z, p2: transition.toPosition.z, t: eased }),
  )
  if (!controls) {
    const interpolatedTarget = new Vector3()
    interpolatedTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased)
    camera.lookAt(interpolatedTarget)
    return
  }
  controls.target.set(
    bezierAt({ p0: transition.fromTarget.x, p1: transition.arcTargetMidpoint.x, p2: transition.toTarget.x, t: eased }),
    bezierAt({ p0: transition.fromTarget.y, p1: transition.arcTargetMidpoint.y, p2: transition.toTarget.y, t: eased }),
    bezierAt({ p0: transition.fromTarget.z, p1: transition.arcTargetMidpoint.z, p2: transition.toTarget.z, t: eased }),
  )
  controls.update()
}

function applyLinearInterpolation({ controls, camera, transition, eased }) {
  camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased)
  if (controls) {
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased)
    controls.update()
    return
  }
  const interpolatedTarget = new Vector3().lerpVectors(transition.fromTarget, transition.toTarget, eased)
  camera.lookAt(interpolatedTarget)
}

function pickTransitionDuration({ initialized, battleView, prevBattle }) {
  if (!initialized) return FIRST_TRANSITION_S
  if (battleView !== prevBattle) return ARC_TRANSITION_S
  return battleView ? ENTER_BATTLE_TRANSITION_S : EXIT_BATTLE_TRANSITION_S
}

/**
 * Pilote la camera : cale sa position au-dessus du plateau focalise, joue les
 * transitions (lerp/arc), persiste le preset au moment d'entrer en mode tir,
 * et notifie l'orientation (`onCameraDirectionChange`).
 */
export default function CameraDirector({
  controlsRef,
  focusBoard,
  focusX,
  focusZ,
  battleView,
  cameraDirection,
  focusDirection,
  cameraStateKey,
  boards,
  targetSelectionView,
  onCameraDirectionChange,
}) {
  const { camera } = useThree()
  const transitionRef = useRef(null)
  const previousBattleRef = useRef(battleView)
  const initializedRef = useRef(false)
  const previousDirectionRef = useRef(null)
  const previousTargetSelectionViewRef = useRef(targetSelectionView)

  useEffect(() => {
    const overviewPosition = cameraTopDownOverview(boards)
    const [overviewX, overviewY, overviewZ] = overviewPosition
    const targetLookAt = targetSelectionView
      ? new Vector3(overviewX, 0, overviewZ)
      : new Vector3(focusX, 0, focusZ)
    const effectiveDirection = targetSelectionView
      ? cameraDirection
      : (battleView
        ? (focusDirection ?? inferDirectionFromBoard({ focusBoard, focusX, focusZ }))
        : cameraDirection)
    const [selectionX, , selectionZ] = cameraTopDownOverBoard(overviewX, overviewZ, effectiveDirection)
    const [px, py, pz] = targetSelectionView
      ? [selectionX, overviewY, selectionZ]
      : cameraTopDownOverBoard(focusX, focusZ, effectiveDirection)
    const nextPosition = new Vector3(px, py, pz)
    const controls = controlsRef.current

    const goingIntoBattle = battleView && !previousBattleRef.current
    const goingOutOfBattle = !battleView && previousBattleRef.current

    if (battleView && previousBattleRef.current !== battleView) {
      savePreset({ camera, controls, key: cameraStateKey })
    }

    const selectionViewChanged = targetSelectionView !== previousTargetSelectionViewRef.current
    const useArc = ((goingIntoBattle || goingOutOfBattle) && initializedRef.current) || selectionViewChanged
    const arcSideMultiplier = goingIntoBattle ? -1 : 1
    const arc = useArc
      ? computeArcMidpoints({
        from: {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: controls
            ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
            : { x: focusX, y: 0, z: focusZ },
        },
        to: {
          position: { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z },
          target: { x: targetLookAt.x, y: targetLookAt.y, z: targetLookAt.z },
        },
        direction: effectiveDirection,
        arcSideMultiplier,
      })
      : null

    transitionRef.current = buildTransitionState({
      camera,
      controls,
      focusX,
      focusZ,
      toPosition: nextPosition,
      toTarget: targetLookAt,
      duration: useArc
        ? ARC_TRANSITION_S
        : pickTransitionDuration({
          initialized: initializedRef.current,
          battleView,
          prevBattle: previousBattleRef.current,
        }) || DEFAULT_TRANSITION_S,
      arc,
    })

    initializedRef.current = true
    previousBattleRef.current = battleView
    previousTargetSelectionViewRef.current = targetSelectionView
  }, [camera, controlsRef, focusBoard, focusX, focusZ, battleView, cameraDirection, focusDirection, cameraStateKey, boards, targetSelectionView])

  useFrame((_, delta) => {
    const transition = transitionRef.current
    if (!transition) return
    transition.elapsed += delta
    const t = Math.min(1, transition.elapsed / transition.duration)
    const hasArc = Boolean(transition.arcMidpoint)
    const eased = easeTransition(t, hasArc)
    if (hasArc) {
      applyArcInterpolation({ controls: controlsRef.current, camera, transition, eased })
    } else {
      applyLinearInterpolation({ controls: controlsRef.current, camera, transition, eased })
    }
    if (t >= 1) transitionRef.current = null
  })

  useFrame(() => {
    if (!onCameraDirectionChange || !controlsRef.current) return
    const dx = camera.position.x - controlsRef.current.target.x
    const dz = camera.position.z - controlsRef.current.target.z
    if (!isOffsetSignificant({ dx, dz })) return
    const nextDirection = inferDirectionFromOffset({ dx, dz })
    if (previousDirectionRef.current === nextDirection) return
    previousDirectionRef.current = nextDirection
    onCameraDirectionChange(nextDirection)
  })

  return null
}
