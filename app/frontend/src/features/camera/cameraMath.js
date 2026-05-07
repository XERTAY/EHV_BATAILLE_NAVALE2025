const TOP_DOWN_ALTITUDE = 230
const TOP_DOWN_OFFSET = 1.2
const OVERVIEW_ALTITUDE_PADDING = 260

/**
 * Position de camera "top-down" au-dessus d'un plateau, decalee selon la
 * direction logique (NORTH/SOUTH/EAST/WEST). Renvoie un tuple `[x, y, z]`.
 *
 * @param {number} focusX
 * @param {number} focusZ
 * @param {?('NORTH'|'SOUTH'|'EAST'|'WEST')} direction
 * @returns {[number, number, number]}
 */
export function cameraTopDownOverBoard(focusX, focusZ, direction = null) {
  if (direction === 'NORTH') return [focusX, TOP_DOWN_ALTITUDE, focusZ - TOP_DOWN_OFFSET]
  if (direction === 'SOUTH') return [focusX, TOP_DOWN_ALTITUDE, focusZ + TOP_DOWN_OFFSET]
  if (direction === 'EAST') return [focusX + TOP_DOWN_OFFSET, TOP_DOWN_ALTITUDE, focusZ]
  if (direction === 'WEST') return [focusX - TOP_DOWN_OFFSET, TOP_DOWN_ALTITUDE, focusZ]
  return [focusX, TOP_DOWN_ALTITUDE, focusZ + TOP_DOWN_OFFSET]
}

/**
 * Devine une direction logique a partir de la position d'un plateau, en
 * privilegiant l'axe dominant (X pour EAST/WEST, Z pour NORTH/SOUTH).
 */
export function inferDirectionFromBoard({ focusBoard, focusX, focusZ }) {
  const boardX = focusBoard?.position?.[0] ?? focusX
  const boardZ = focusBoard?.position?.[2] ?? focusZ
  if (Math.abs(boardX) >= Math.abs(boardZ)) {
    return boardX >= 0 ? 'EAST' : 'WEST'
  }
  return boardZ >= 0 ? 'SOUTH' : 'NORTH'
}

/**
 * Devine une direction logique en fonction d'un offset
 * `cameraPos - cameraTarget`.
 */
export function inferDirectionFromOffset({ dx, dz }) {
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? 'EAST' : 'WEST'
  }
  return dz >= 0 ? 'SOUTH' : 'NORTH'
}

export function cameraTopDownOverview(boards = []) {
  if (!Array.isArray(boards) || boards.length === 0) return [0, TOP_DOWN_ALTITUDE + 140, 0]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const board of boards) {
    const x = board?.position?.[0] ?? 0
    const z = board?.position?.[2] ?? 0
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const spread = Math.max(maxX - minX, maxZ - minZ)
  return [centerX, OVERVIEW_ALTITUDE_PADDING + spread * 0.9, centerZ]
}
