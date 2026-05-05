import { useCallback, useMemo, useState } from 'react'

/** Libellés UI pour les tailles classiques ; au-delà, nom générique par index. */
const DEFAULT_SHIP_LABELS = ['Porte-avions', 'Cuirassé', 'Croiseur', 'Sous-marin', 'Destroyer']

const EMPTY_PLACED_BY_PLAYER = () => ({
  1: [],
  2: [],
  3: [],
  4: [],
})
const ORIENTATION_SEQUENCE = ['EAST', 'SOUTH', 'WEST', 'NORTH']

/**
 * Flotte alignée sur le backend (`DuelGameService`) : types `SHIP_0`, `SHIP_1`, …
 */
export default function usePlacement({
  currentPlayer,
  gamePhase,
  boardSize = 10,
  fleetShipSizes = [5, 4, 3, 3, 2],
}) {
  const fleet = useMemo(() => {
    const sizes =
      Array.isArray(fleetShipSizes) && fleetShipSizes.length > 0
        ? fleetShipSizes
        : [5, 4, 3, 3, 2]
    return sizes.map((rawSize, index) => ({
      type: `SHIP_${index}`,
      size: Math.max(1, Number(rawSize) || 1),
      label: DEFAULT_SHIP_LABELS[index] ?? `Navire ${index + 1}`,
    }))
  }, [fleetShipSizes])

  const [selectedShipType, setSelectedShipType] = useState('SHIP_0')
  const [placementOrientation, setPlacementOrientation] = useState('EAST')
  const [hoveredPlacementCell, setHoveredPlacementCell] = useState(null)
  const [placedShipsByPlayer, setPlacedShipsByPlayer] = useState(() => EMPTY_PLACED_BY_PLAYER())

  const remainingShips = useMemo(() => {
    const alreadyPlaced = new Set(placedShipsByPlayer[currentPlayer] ?? [])
    return fleet.filter((ship) => !alreadyPlaced.has(ship.type))
  }, [placedShipsByPlayer, currentPlayer, fleet])

  const effectiveSelectedShipType = useMemo(() => {
    if (remainingShips.length === 0) return selectedShipType
    if (remainingShips.some((ship) => ship.type === selectedShipType)) return selectedShipType
    return remainingShips[0].type
  }, [remainingShips, selectedShipType])

  const selectedShip = useMemo(
    () => fleet.find((ship) => ship.type === effectiveSelectedShipType) ?? fleet[0],
    [fleet, effectiveSelectedShipType],
  )

  const selectedShipLabel = useMemo(() => {
    const ship = fleet.find((s) => s.type === effectiveSelectedShipType)
    return ship?.label ?? effectiveSelectedShipType
  }, [fleet, effectiveSelectedShipType])
  const selectedShipSize = selectedShip?.size ?? 1

  const placementPreview = useMemo(() => {
    if (!hoveredPlacementCell || !selectedShip || gamePhase !== 'PLACEMENT') return []
    const directionByOrientation = {
      EAST: { dx: 1, dy: 0 },
      SOUTH: { dx: 0, dy: 1 },
      WEST: { dx: -1, dy: 0 },
      NORTH: { dx: 0, dy: -1 },
    }
    const direction = directionByOrientation[placementOrientation] ?? directionByOrientation.EAST
    const cells = []
    for (let index = 0; index < selectedShip.size; index += 1) {
      const x = hoveredPlacementCell.x + direction.dx * index
      const y = hoveredPlacementCell.y + direction.dy * index
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        cells.push({ x, y })
      }
    }
    return cells
  }, [hoveredPlacementCell, selectedShip, placementOrientation, gamePhase, boardSize])

  const handlePlacementSuccess = useCallback((player, shipType) => {
    setHoveredPlacementCell(null)
    setPlacedShipsByPlayer((value) => ({
      ...value,
      [player]: [...(value[player] ?? []), shipType],
    }))
  }, [])

  const resetPlacement = useCallback(() => {
    setPlacedShipsByPlayer(EMPTY_PLACED_BY_PLAYER())
    setHoveredPlacementCell(null)
    setSelectedShipType(fleet[0]?.type ?? 'SHIP_0')
    setPlacementOrientation('EAST')
  }, [fleet])

  const rotatePlacementOrientationClockwise = useCallback(() => {
    setPlacementOrientation((current) => {
      const index = ORIENTATION_SEQUENCE.indexOf(current)
      if (index < 0) return ORIENTATION_SEQUENCE[0]
      return ORIENTATION_SEQUENCE[(index + 1) % ORIENTATION_SEQUENCE.length]
    })
  }, [])

  const handleCellHover = useCallback((cellData, expectedOwnBoardId) => {
    if (!cellData) {
      setHoveredPlacementCell(null)
      return
    }
    const { boardId, x, y } = cellData
    if (gamePhase !== 'PLACEMENT' || boardId !== expectedOwnBoardId) {
      setHoveredPlacementCell(null)
      return
    }
    setHoveredPlacementCell({ x, y })
  }, [gamePhase])

  return {
    selectedShipType: effectiveSelectedShipType,
    selectedShipLabel,
    selectedShipSize,
    setSelectedShipType,
    placementOrientation,
    setPlacementOrientation,
    rotatePlacementOrientationClockwise,
    remainingShips,
    placementPreview,
    handlePlacementSuccess,
    handleCellHover,
    resetPlacement,
  }
}
