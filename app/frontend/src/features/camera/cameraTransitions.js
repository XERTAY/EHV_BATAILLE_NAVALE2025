const ARC_SIDE_OFFSET = 75
const ARC_SIDE_OFFSET_TARGET = ARC_SIDE_OFFSET * 0.25
const ARC_SIDE_OFFSET_Z = ARC_SIDE_OFFSET * 0.35
const ARC_LIFT = 35

/**
 * Calcule un easing cubique pour une transition (avec ou sans arc).
 *
 * @param {number} t Progression normalisee dans [0, 1].
 * @param {boolean} hasArc
 * @returns {number}
 */
export function easeTransition(t, hasArc) {
  if (hasArc) {
    return t < 0.5 ? 4 * t * t * t : 1 - (((-2 * t + 2) ** 3) / 2)
  }
  return 1 - ((1 - t) ** 3)
}

/**
 * Quadratic Bezier ponctuel (canal scalaire) entre `p0` et `p2` avec point
 * de controle `p1` et progression `t` deja eased.
 */
export function bezierAt({ p0, p1, p2, t }) {
  const oneMinus = 1 - t
  return oneMinus * oneMinus * p0 + 2 * oneMinus * t * p1 + t * t * p2
}

/**
 * Calcule les midpoints d'arc (camera position + camera target) pour une
 * transition spectaculaire en entree/sortie de mode tir.
 *
 * Pures coordinates only - aucun appel Three.js.
 *
 * @param {{
 *   from: { position: { x:number, y:number, z:number }, target: { x:number, y:number, z:number } },
 *   to: { position: { x:number, y:number, z:number }, target: { x:number, y:number, z:number } },
 *   direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | string,
 *   arcSideMultiplier: number,
 * }} params
 */
export function computeArcMidpoints({ from, to, direction, arcSideMultiplier }) {
  const baseSideSign = direction === 'EAST' || direction === 'SOUTH' ? 1 : -1
  const sideSign = baseSideSign * (arcSideMultiplier >= 0 ? 1 : -1)
  const arcMidpoint = {
    x: (from.position.x + to.position.x) * 0.5 + sideSign * ARC_SIDE_OFFSET,
    y: Math.max(from.position.y, to.position.y) + ARC_LIFT,
    z: (from.position.z + to.position.z) * 0.5 - sideSign * ARC_SIDE_OFFSET_Z,
  }
  const arcTargetMidpoint = {
    x: (from.target.x + to.target.x) * 0.5 + sideSign * ARC_SIDE_OFFSET_TARGET,
    y: (from.target.y + to.target.y) * 0.5,
    z: (from.target.z + to.target.z) * 0.5 - sideSign * ARC_SIDE_OFFSET_TARGET * 0.8,
  }
  return { arcMidpoint, arcTargetMidpoint }
}

/** Direction de camera deduite d'un offset, seuil pour eviter les jitter. */
export function isOffsetSignificant({ dx, dz, threshold = 0.001 }) {
  return Math.abs(dx) >= threshold || Math.abs(dz) >= threshold
}
