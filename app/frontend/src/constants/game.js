/**
 * Mapping des identifiants de plateaux vers le numero de joueur correspondant.
 * @type {Readonly<Record<string, number>>}
 */
export const BOARD_ID_TO_PLAYER = Object.freeze({
  A1: 1,
  B1: 2,
  C1: 3,
  D1: 4,
})

/**
 * Direction par defaut de la camera pour le mode duel face-a-face (2 joueurs).
 * @type {Readonly<Record<number, string>>}
 */
export const FACE_OFF_CAMERA_DIRECTION_BY_PLAYER = Object.freeze({
  1: 'NORTH',
  2: 'SOUTH',
})

/**
 * Direction par defaut de la camera pour le mode etoile (4 joueurs).
 * @type {Readonly<Record<number, string>>}
 */
export const STAR4_CAMERA_DIRECTION_BY_PLAYER = Object.freeze({
  1: 'WEST',
  2: 'EAST',
  3: 'NORTH',
  4: 'SOUTH',
})

/**
 * Configuration par defaut d'une nouvelle partie.
 */
export const DEFAULT_SETUP = Object.freeze({
  startMode: 'new',
  loadSaveFile: 'bataille-navale',
  saveFileName: 'bataille-navale',
  boardSize: 10,
  fleetShipSizes: [5, 4, 3, 3, 2],
  playerCount: 2,
  humanPlayers: 2,
  withAI: false,
})
