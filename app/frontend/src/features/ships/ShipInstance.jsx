import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Box3 } from 'three'

import {
  GRID_SURFACE_MARGIN,
  applyOpacity,
  cloneMaterialsDeep,
  expandBoxMeshesInParentLocal,
} from './threeMaterialUtils'

const FACING_OFFSET_BY_DIRECTION = {
  EAST: Math.PI,
  SOUTH: Math.PI,
  WEST: 0,
  NORTH: 0,
}

const TARGET_LENGTH_FACTOR = 0.8
const BASE_Z = 0.02
const MIN_HORIZONTAL_SPAN = 1e-6

function useShipClone(template, opacity) {
  const clone = useMemo(() => {
    const next = template.clone(true)
    cloneMaterialsDeep(next)
    return next
  }, [template])
  useLayoutEffect(() => {
    applyOpacity(clone, opacity)
  }, [clone, opacity])
  return clone
}

function projectSegmentCenter({ segment, half, cellSize, cells, flipColumns, flipRows }) {
  const { centerX, centerY } = segment
  const rawX = flipColumns ? cells - 1 - centerX : centerX
  const rawY = flipRows ? centerY : cells - 1 - centerY
  return {
    px: -half + (rawX + 0.5) * cellSize,
    py: -half + (rawY + 0.5) * cellSize,
  }
}

function computeShipTransform({ segment, modelInfo, cellSize }) {
  const { length, orientation, direction } = segment
  const targetLength = length * cellSize * TARGET_LENGTH_FACTOR
  const scale = targetLength / Math.max(modelInfo.horizontalSpan, MIN_HORIZONTAL_SPAN)
  const rotZAlongLine = orientation === 'HORIZONTAL' ? Math.PI / 2 : 0
  const facingOffset = FACING_OFFSET_BY_DIRECTION[direction] ?? Math.PI
  return {
    scale,
    rotZ: rotZAlongLine + facingOffset,
    offsetX: -modelInfo.center.x * scale,
    offsetY: -modelInfo.center.y * scale,
    offsetZ: -modelInfo.center.z * scale,
  }
}

/**
 * Instance de navire : applique transforme/rotation, clone les materiaux,
 * et ajuste la hauteur pour que le bas du mesh effleure le plan d'eau.
 */
export default function ShipInstance({
  template,
  modelInfo,
  segment,
  half,
  cellSize,
  cells,
  flipColumns,
  flipRows,
  opacity,
}) {
  const outerRef = useRef(null)
  const zOnGridRef = useRef(BASE_Z)
  const clone = useShipClone(template, opacity)

  const { px, py } = projectSegmentCenter({ segment, half, cellSize, cells, flipColumns, flipRows })
  const { scale, rotZ, offsetX, offsetY, offsetZ } = useMemo(
    () => computeShipTransform({ segment, modelInfo, cellSize }),
    [segment, modelInfo, cellSize],
  )

  useLayoutEffect(() => {
    const root = outerRef.current
    if (!root?.parent) return
    root.position.set(px, py, BASE_Z)
    root.updateMatrixWorld(true)
    const box = new Box3()
    expandBoxMeshesInParentLocal(root, box)
    if (box.isEmpty()) return
    zOnGridRef.current = BASE_Z + (GRID_SURFACE_MARGIN - box.min.z)
  }, [px, py, rotZ, offsetX, offsetY, offsetZ, scale, clone])

  useFrame(() => {
    const root = outerRef.current
    if (!root) return
    root.position.set(px, py, zOnGridRef.current)
  })

  return (
    <group ref={outerRef} rotation-z={rotZ}>
      <group rotation-x={Math.PI / 2}>
        <group scale={[scale, scale, scale]} position={[offsetX, offsetY, offsetZ]}>
          <primitive object={clone} />
        </group>
      </group>
    </group>
  )
}
