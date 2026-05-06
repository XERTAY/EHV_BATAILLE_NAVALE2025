/** Couleurs des etats de cellule (overlay 2D au-dessus de l'eau). */
export const CELL_COLORS = Object.freeze({
  EMPTY: null,
  SHIP: '#2d9a5e',
  MISS: '#cad8e6',
  HIT: '#f58b33',
  SUNK: '#c23232',
})

/** Duree d'animation des particules d'impact. */
export const IMPACT_ANIMATION_MS = 3000

/** Nombre de particules emises par impact. */
export const PARTICLE_COUNT = 26

/** Couleur principale d'un impact selon son type. */
export function impactColor(type) {
  if (type === 'SUNK') return '#ff2d2d'
  if (type === 'HIT') return '#ff9b2f'
  return '#cad8e6'
}

/** Couleur des particules pour un impact (legerement plus claire que la cellule). */
export function impactParticleColor(type) {
  if (type === 'SUNK') return '#ff2d2d'
  if (type === 'HIT') return '#ff9b2f'
  return '#d6e6f5'
}
