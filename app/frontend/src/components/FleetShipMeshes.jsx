import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Box3, Matrix4, NoColorSpace, SRGBColorSpace, Vector3 } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'
import { buildPreviewSegment, extractShipSegments } from '../utils/shipSegmentsFromGrid'
import dacar2ModelUrl from '../assets/models/dacar2.fbx?url'
import waterTransportMapUrl from '../assets/WaterTransport.tga?url'

/** Textures couleur (sRGB) vs données linéaires — requis si le renderer est en `outputColorSpace: SRGBColorSpace`. */
const TEXTURE_COLOR_SPACES = {
  map: SRGBColorSpace,
  emissiveMap: SRGBColorSpace,
  specularMap: SRGBColorSpace,
  sheenColorMap: SRGBColorSpace,
  transmissionMap: SRGBColorSpace,
  normalMap: NoColorSpace,
  roughnessMap: NoColorSpace,
  metalnessMap: NoColorSpace,
  aoMap: NoColorSpace,
  bumpMap: NoColorSpace,
  displacementMap: NoColorSpace,
  alphaMap: NoColorSpace,
  clearcoatNormalMap: NoColorSpace,
}

/**
 * FBXLoader peut produire des PBR avec transmission ou des textures sans colorSpace :
 * avec tone mapping / sRGB sortie, le navire peut apparaître entièrement noir.
 */
function normalizeLoadedFbxMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    const geo = child.geometry
    if (geo && (!geo.attributes.normal || geo.attributes.normal.count === 0)) {
      geo.computeVertexNormals()
    }
    if (!child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      if (!mat) continue
      for (const [key, space] of Object.entries(TEXTURE_COLOR_SPACES)) {
        const tex = mat[key]
        if (tex && tex.isTexture) tex.colorSpace = space
      }
      if (mat.isMeshPhysicalMaterial && mat.transmission > 0) {
        mat.transmission = 0
        mat.thickness = 0
      }
      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        if (mat.envMapIntensity === undefined || mat.envMapIntensity < 0.2) {
          mat.envMapIntensity = 1
        }
      }
      if (mat.color && !mat.map) {
        const { r, g, b } = mat.color
        if (r < 0.03 && g < 0.03 && b < 0.03) {
          mat.color.setHex(0xb8c4d4)
        }
      }
      mat.needsUpdate = true
    }
  })
}

/** Texture diffuse partagée par les clones de navire (FBX + TGA). */
function applyWaterTransportDiffuse(root, map) {
  if (!map) return
  map.colorSpace = SRGBColorSpace
  map.flipY = true
  map.needsUpdate = true
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      if (!mat || typeof mat.map === 'undefined') continue
      mat.map = map
      if (mat.color) mat.color.setHex(0xffffff)
      mat.needsUpdate = true
    }
  })
}

function cloneMaterialsDeep(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => (m ? m.clone() : m))
    } else {
      child.material = child.material.clone()
    }
  })
}

function applyOpacity(root, opacity) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      if (!mat) continue
      mat.transparent = opacity < 1
      mat.opacity = opacity
      mat.depthWrite = opacity >= 1
    }
  })
}

function computeModelBounds(root) {
  const box = new Box3()
  let hasMesh = false
  root.updateMatrixWorld(true)
  root.traverse((child) => {
    if (child.isMesh) {
      const geometry = child.geometry
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const meshBox = geometry.boundingBox.clone()
      meshBox.applyMatrix4(child.matrixWorld)
      if (!hasMesh) {
        box.copy(meshBox)
        hasMesh = true
      } else {
        box.union(meshBox)
      }
    }
  })
  if (!hasMesh) {
    box.setFromObject(root)
  }
  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)
  box.getCenter(center)
  const horizontalSpan = Math.max(size.x, size.z)
  return { size, center, horizontalSpan }
}

/** Marge (Z local plateau) entre le bas du mesh et le plan de grille (z ≈ 0). */
const GRID_SURFACE_MARGIN = 0.028

/**
 * AABB des sommets des meshes sous `root`, dans l'espace local du parent de `root`
 * (repère WaterBoard : XY = grille, +Z = au-dessus de l'eau).
 */
function expandBoxMeshesInParentLocal(root, targetBox) {
  targetBox.makeEmpty()
  const parent = root.parent
  if (!parent) return
  root.updateMatrixWorld(true)
  parent.updateMatrixWorld(true)
  const invParent = new Matrix4().copy(parent.matrixWorld).invert()
  const v = new Vector3()
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return
    const pos = child.geometry.attributes.position
    if (!pos) return
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld).applyMatrix4(invParent)
      targetBox.expandByPoint(v)
    }
  })
}

function ShipInstance({
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
  /** Hauteur Z (repère plateau) après alignement sur la grille — mis à jour au layout. */
  const zOnGridRef = useRef(0.02)

  const clone = useMemo(() => {
    const next = template.clone(true)
    cloneMaterialsDeep(next)
    return next
  }, [template])

  useLayoutEffect(() => {
    applyOpacity(clone, opacity)
  }, [clone, opacity])

  const { centerX, centerY, length, orientation } = segment
  const rawX = flipColumns ? cells - 1 - centerX : centerX
  const rawY = flipRows ? centerY : cells - 1 - centerY
  const px = -half + (rawX + 0.5) * cellSize
  const py = -half + (rawY + 0.5) * cellSize

  const targetLength = length * cellSize * 0.8
  const s = targetLength / Math.max(modelInfo.horizontalSpan, 1e-6)
  /** Ligne du navire : +π/2 sur Z aligne la longueur du FBX sur l’axe Y de la grille (vertical). */
  const rotZAlongLine = orientation === 'HORIZONTAL' ? Math.PI / 2 : 0
  /**
   * FBX souvent Y-up : on aligne Y modèle sur Z monde (au-dessus de l’eau).
   * +π/2 (et non −π/2) remet le pont au-dessus du plan d’eau pour dacar2.
   * +π sur Z retourne la proue pour suivre le sens de la ligne sur la grille.
   */
  const rotZ = rotZAlongLine + Math.PI

  const offsetX = -modelInfo.center.x * s
  const offsetY = -modelInfo.center.y * s
  const offsetZ = -modelInfo.center.z * s

  useLayoutEffect(() => {
    const root = outerRef.current
    if (!root?.parent) return
    const baseZ = 0.02
    root.position.set(px, py, baseZ)
    root.updateMatrixWorld(true)
    const box = new Box3()
    expandBoxMeshesInParentLocal(root, box)
    if (box.isEmpty()) return
    zOnGridRef.current = baseZ + (GRID_SURFACE_MARGIN - box.min.z)
  }, [px, py, rotZ, offsetX, offsetY, offsetZ, s, clone])

  useFrame(() => {
    const root = outerRef.current
    if (!root) return
    root.position.set(px, py, zOnGridRef.current)
  })

  return (
    <group ref={outerRef} rotation-z={rotZ}>
      <group rotation-x={Math.PI / 2}>
        <group scale={[s, s, s]} position={[offsetX, offsetY, offsetZ]}>
          <primitive object={clone} />
        </group>
      </group>
    </group>
  )
}

function FleetShipMeshesInner({
  cellStates,
  previewCells,
  cells,
  half,
  cellSize,
  flipColumns,
  flipRows,
  showPreviewGhost,
}) {
  const fbx = useLoader(FBXLoader, dacar2ModelUrl)
  const waterTransportMap = useLoader(TGALoader, waterTransportMapUrl)
  const templateRoot = useMemo(() => {
    normalizeLoadedFbxMaterials(fbx)
    applyWaterTransportDiffuse(fbx, waterTransportMap)
    return fbx
  }, [fbx, waterTransportMap])
  const modelInfo = useMemo(() => computeModelBounds(templateRoot), [templateRoot])

  const segments = useMemo(() => {
    const placed = extractShipSegments(cellStates, cells)
    if (!showPreviewGhost) return placed
    const preview = buildPreviewSegment(previewCells, cells)
    if (!preview) return placed
    return [...placed, preview]
  }, [cellStates, cells, previewCells, showPreviewGhost])

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
      opacity={segment.ghost ? 0.42 : 1}
    />
  ))
}

export default function FleetShipMeshes(props) {
  return (
    <Suspense fallback={null}>
      <FleetShipMeshesInner {...props} />
    </Suspense>
  )
}
