import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'

import dacar2ModelUrl from '@/assets/models/dacar2.fbx?url'
import pirataGallionModelUrl from '@/assets/models/PirataGallion.fbx?url'
import pirataShipAModelUrl from '@/assets/models/PirataShipA.fbx?url'
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
const AIRCRAFT_CARRIER_LENGTH = 5
const GALLION_LENGTH = 6

function pickSegmentOpacity({ segment, impactedSegmentKeys, hasActiveDamageFx }) {
  if (segment.ghost) return PREVIEW_GHOST_OPACITY
  if (!impactedSegmentKeys.has(segment.key)) return 1
  return hasActiveDamageFx ? IMPACTED_ACTIVE_FX_OPACITY : IMPACTED_DEFAULT_OPACITY
}

function useFleetTemplate() {
  const [defaultFbx, aircraftCarrierFbx, gallionFbx] = useLoader(FBXLoader, [
    dacar2ModelUrl,
    pirataShipAModelUrl,
    pirataGallionModelUrl,
  ])
  const waterTransportMap = useLoader(TGALoader, waterTransportMapUrl)
  const defaultTemplate = useMemo(() => {
    normalizeLoadedFbxMaterials(defaultFbx)
    applyWaterTransportDiffuse(defaultFbx, waterTransportMap)
    return defaultFbx
  }, [defaultFbx, waterTransportMap])
  const aircraftCarrierTemplate = useMemo(() => {
    normalizeLoadedFbxMaterials(aircraftCarrierFbx)
    applyWaterTransportDiffuse(aircraftCarrierFbx, waterTransportMap)
    return aircraftCarrierFbx
  }, [aircraftCarrierFbx, waterTransportMap])
  const gallionTemplate = useMemo(() => {
    normalizeLoadedFbxMaterials(gallionFbx)
    applyWaterTransportDiffuse(gallionFbx, waterTransportMap)
    return gallionFbx
  }, [gallionFbx, waterTransportMap])
  const defaultModelInfo = useMemo(() => computeModelBounds(defaultTemplate), [defaultTemplate])
  const aircraftCarrierModelInfo = useMemo(
    () => computeModelBounds(aircraftCarrierTemplate),
    [aircraftCarrierTemplate],
  )
  const gallionModelInfo = useMemo(() => computeModelBounds(gallionTemplate), [gallionTemplate])
  return {
    defaultTemplate,
    aircraftCarrierTemplate,
    gallionTemplate,
    defaultModelInfo,
    aircraftCarrierModelInfo,
    gallionModelInfo,
  }
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
  const {
    defaultTemplate,
    aircraftCarrierTemplate,
    gallionTemplate,
    defaultModelInfo,
    aircraftCarrierModelInfo,
    gallionModelInfo,
  } = useFleetTemplate()
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
      template={
        segment.length === AIRCRAFT_CARRIER_LENGTH
          ? aircraftCarrierTemplate
          : segment.length === GALLION_LENGTH
            ? gallionTemplate
            : defaultTemplate
      }
      modelInfo={
        segment.length === AIRCRAFT_CARRIER_LENGTH
          ? aircraftCarrierModelInfo
          : segment.length === GALLION_LENGTH
            ? gallionModelInfo
            : defaultModelInfo
      }
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
