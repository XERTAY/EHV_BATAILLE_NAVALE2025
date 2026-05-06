import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'

import dacar2ModelUrl from '@/assets/models/dacar2.fbx?url'
import waterTransportMapUrl from '@/assets/WaterTransport.tga?url'
import { buildPreviewSegment, extractShipSegments } from '@/utils/shipSegmentsFromGrid'

import ShipInstance from './ShipInstance'
import { buildShipComponentIndex } from './shipComponents'
import {
  applyWaterTransportDiffuse,
  computeModelBounds,
  normalizeLoadedFbxMaterials,
} from './threeMaterialUtils'

const PREVIEW_GHOST_OPACITY = 0.42
const IMPACTED_DEFAULT_OPACITY = 0.24
const IMPACTED_ACTIVE_FX_OPACITY = 0.08

function pickSegmentOpacity({ segment, impactedSegmentKeys, hasActiveDamageFx }) {
  if (segment.ghost) return PREVIEW_GHOST_OPACITY
  if (!impactedSegmentKeys.has(segment.key)) return 1
  return hasActiveDamageFx ? IMPACTED_ACTIVE_FX_OPACITY : IMPACTED_DEFAULT_OPACITY
}

function useFleetTemplate() {
  const fbx = useLoader(FBXLoader, dacar2ModelUrl)
  const waterTransportMap = useLoader(TGALoader, waterTransportMapUrl)
  const templateRoot = useMemo(() => {
    normalizeLoadedFbxMaterials(fbx)
    applyWaterTransportDiffuse(fbx, waterTransportMap)
    return fbx
  }, [fbx, waterTransportMap])
  const modelInfo = useMemo(() => computeModelBounds(templateRoot), [templateRoot])
  return { templateRoot, modelInfo }
}

function useSegments({ cellStates, cells, previewCells, showPreviewGhost }) {
  return useMemo(() => {
    const placed = extractShipSegments(cellStates, cells)
    if (!showPreviewGhost) return placed
    const preview = buildPreviewSegment(previewCells, cells)
    return preview ? [...placed, preview] : placed
  }, [cellStates, cells, previewCells, showPreviewGhost])
}

function isHitOrSunk(impact) {
  return impact.type === 'HIT' || impact.type === 'SUNK'
}

function findImpactedComponentIds({ recentImpacts, componentByCell }) {
  return new Set(
    recentImpacts
      .filter(isHitOrSunk)
      .map((impact) => componentByCell.get(`${impact.x},${impact.y}`))
      .filter((id) => Number.isInteger(id)),
  )
}

function findImpactedSegments({ segments, componentByCell, impactedComponentIds }) {
  const impacted = new Set()
  for (const segment of segments) {
    if (segment.ghost) continue
    let segmentImpacted = false
    for (let y = segment.minY; y <= segment.maxY && !segmentImpacted; y += 1) {
      for (let x = segment.minX; x <= segment.maxX; x += 1) {
        if (impactedComponentIds.has(componentByCell.get(`${x},${y}`))) {
          impacted.add(segment.key)
          segmentImpacted = true
          break
        }
      }
    }
  }
  return impacted
}

/**
 * Composant interne de la flotte 3D : charge le modele FBX + texture, deduit
 * les segments depuis la grille, calcule les segments impactes pour le FX
 * de degats, puis instancie un `ShipInstance` par segment.
 */
export default function FleetShipMeshesInner({
  cellStates,
  previewCells,
  recentImpacts,
  cells,
  half,
  cellSize,
  flipColumns,
  flipRows,
  showPreviewGhost,
}) {
  const { templateRoot, modelInfo } = useFleetTemplate()
  const segments = useSegments({ cellStates, cells, previewCells, showPreviewGhost })

  const impactedSegmentKeys = useMemo(() => {
    if (!recentImpacts?.length) return new Set()
    if (!recentImpacts.some(isHitOrSunk)) return new Set()
    const componentByCell = buildShipComponentIndex(cellStates, cells)
    const impactedComponentIds = findImpactedComponentIds({ recentImpacts, componentByCell })
    if (impactedComponentIds.size === 0) return new Set()
    return findImpactedSegments({ segments, componentByCell, impactedComponentIds })
  }, [recentImpacts, segments, cellStates, cells])

  const hasActiveDamageFx = useMemo(
    () => Array.isArray(recentImpacts) && recentImpacts.some(isHitOrSunk),
    [recentImpacts],
  )

  return segments.map((segment) => (
    <ShipInstance
      key={segment.key}
      template={templateRoot}
      modelInfo={modelInfo}
      segment={segment}
      half={half}
      cellSize={cellSize}
      cells={cells}
      flipColumns={flipColumns}
      flipRows={flipRows}
      opacity={pickSegmentOpacity({ segment, impactedSegmentKeys, hasActiveDamageFx })}
    />
  ))
}
