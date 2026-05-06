import { Box3, Matrix4, NoColorSpace, SRGBColorSpace, Vector3 } from 'three'

/**
 * Marge (Z local plateau) entre le bas du mesh et le plan de grille (z ~= 0).
 */
export const GRID_SURFACE_MARGIN = 0.028

/**
 * Textures couleur (sRGB) vs donnees lineaires - requis avec un renderer
 * configure en `outputColorSpace: SRGBColorSpace`.
 */
export const TEXTURE_COLOR_SPACES = Object.freeze({
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
})

const DARK_COLOR_THRESHOLD = 0.03
const FALLBACK_GRAY = 0xb8c4d4
const MIN_ENV_INTENSITY = 0.2

function fixMaterialTextureColorSpace(mat) {
  for (const [key, space] of Object.entries(TEXTURE_COLOR_SPACES)) {
    const tex = mat[key]
    if (tex?.isTexture) tex.colorSpace = space
  }
}

function neutralizeTransmission(mat) {
  if (mat.isMeshPhysicalMaterial && mat.transmission > 0) {
    mat.transmission = 0
    mat.thickness = 0
  }
}

function ensureEnvIntensity(mat) {
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    if (mat.envMapIntensity === undefined || mat.envMapIntensity < MIN_ENV_INTENSITY) {
      mat.envMapIntensity = 1
    }
  }
}

function fixDarkBaseColor(mat) {
  if (mat.color && !mat.map) {
    const { r, g, b } = mat.color
    if (r < DARK_COLOR_THRESHOLD && g < DARK_COLOR_THRESHOLD && b < DARK_COLOR_THRESHOLD) {
      mat.color.setHex(FALLBACK_GRAY)
    }
  }
}

/**
 * FBXLoader peut produire des PBR avec transmission ou des textures sans
 * colorSpace : avec tone mapping / sRGB sortie, le navire peut apparaitre
 * entierement noir. Cette fonction normalise les materiaux charges.
 */
export function normalizeLoadedFbxMaterials(root) {
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
      fixMaterialTextureColorSpace(mat)
      neutralizeTransmission(mat)
      ensureEnvIntensity(mat)
      fixDarkBaseColor(mat)
      mat.needsUpdate = true
    }
  })
}

/** Texture diffuse partagee par tous les clones de navire (FBX + TGA). */
export function applyWaterTransportDiffuse(root, map) {
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

export function cloneMaterialsDeep(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => (m ? m.clone() : m))
    } else {
      child.material = child.material.clone()
    }
  })
}

export function applyOpacity(root, opacity) {
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

/**
 * Calcule la AABB (size + center) d'un Object3D et la longueur dominante
 * (`horizontalSpan = max(size.x, size.z)`).
 */
export function computeModelBounds(root) {
  const box = new Box3()
  let hasMesh = false
  root.updateMatrixWorld(true)
  root.traverse((child) => {
    if (!child.isMesh) return
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
  })
  if (!hasMesh) box.setFromObject(root)
  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)
  box.getCenter(center)
  return { size, center, horizontalSpan: Math.max(size.x, size.z) }
}

/**
 * AABB des sommets des meshes sous `root`, dans l'espace local du parent
 * de `root` (repere WaterBoard : XY = grille, +Z = au-dessus de l'eau).
 */
export function expandBoxMeshesInParentLocal(root, targetBox) {
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
