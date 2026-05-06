import { DEFAULT_SETUP } from '@/constants/game'

const DEFAULT_FLEET = [5, 4, 3, 3, 2]
const MIN_BOARD_SIZE = 5
const MIN_HUMAN_PLAYERS = 1

function normalizeFleetShipSizes(fleetShipSizes) {
  if (!Array.isArray(fleetShipSizes) || fleetShipSizes.length === 0) {
    return [...DEFAULT_FLEET]
  }
  return fleetShipSizes.map((size) => Math.max(1, Number(size) || 1))
}

function normalizeHumanPlayers(setup, withAI, playerCount) {
  if (!withAI) return playerCount
  const requested = Number(setup.humanPlayers) || MIN_HUMAN_PLAYERS
  const aiCap = playerCount - 1 || MIN_HUMAN_PLAYERS
  return Math.min(Math.max(MIN_HUMAN_PLAYERS, requested), aiCap)
}

/**
 * Normalise un objet de configuration (partial setup) en une configuration
 * de partie utilisable par l'API backend et le front.
 *
 * @param {object} setup
 * @returns {typeof DEFAULT_SETUP}
 */
export function normalizeSetup(setup) {
  const playerCount = setup.playerCount === 4 ? 4 : 2
  const boardSize = Math.max(MIN_BOARD_SIZE, Number(setup.boardSize) || 10)
  const fleetShipSizes = normalizeFleetShipSizes(setup.fleetShipSizes)
  const withAI = Boolean(setup.withAI)
  const humanPlayers = normalizeHumanPlayers(setup, withAI, playerCount)

  return {
    ...DEFAULT_SETUP,
    ...setup,
    boardSize,
    fleetShipSizes,
    playerCount,
    humanPlayers,
    withAI,
    startMode: setup.startMode === 'load' ? 'load' : 'new',
    loadSaveFile: setup.loadSaveFile?.trim() ? setup.loadSaveFile.trim() : DEFAULT_SETUP.loadSaveFile,
    saveFileName: setup.saveFileName?.trim() ? setup.saveFileName.trim() : DEFAULT_SETUP.saveFileName,
  }
}
