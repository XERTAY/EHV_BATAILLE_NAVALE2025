import { useCallback, useMemo, useState } from 'react'

/** Libellés UI pour les tailles classiques ; au-delà, nom générique par index. */
const DEFAULT_SHIP_LABELS = ['Porte-avions', 'Cuirassé', 'Croiseur', 'Sous-marin', 'Destroyer']

const EMPTY_PLACED_BY_PLAYER = () => ({
  1: [],
  2: [],
  3: [],
  4: [],
})
/**
 * Rotation de placement en pivotant sur la case d'ancrage (x, y),
 * dans le sens horaire.
 */
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
  const [removalModeEnabled, setRemovalModeEnabled] = useState(false)
  const [placedShipsByPlayer, setPlacedShipsByPlayer] = useState(() => EMPTY_PLACED_BY_PLAYER())

  const remainingShips = useMemo(() => {
    const alreadyPlaced = new Set(placedShipsByPlayer[currentPlayer] ?? [])
    return fleet.filter((ship) => !alreadyPlaced.has(ship.type))
  }, [placedShipsByPlayer, currentPlayer, fleet])
  const placedShips = useMemo(() => {
    const alreadyPlaced = new Set(placedShipsByPlayer[currentPlayer] ?? [])
    return fleet.filter((ship) => alreadyPlaced.has(ship.type))
  }, [placedShipsByPlayer, currentPlayer, fleet])
  const selectableShips = useMemo(() => (
    removalModeEnabled ? placedShips : remainingShips
  ), [removalModeEnabled, placedShips, remainingShips])

  const effectiveSelectedShipType = useMemo(() => {
    if (selectableShips.length === 0) return selectedShipType
    if (selectableShips.some((ship) => ship.type === selectedShipType)) return selectedShipType
    return selectableShips[0].type
  }, [selectableShips, selectedShipType])

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
      const inBounds = x >= 0 && x < boardSize && y >= 0 && y < boardSize
      cells.push({ x, y, inBounds, previewDirection: placementOrientation })
    }
    return cells
  }, [hoveredPlacementCell, selectedShip, placementOrientation, gamePhase, boardSize])

  const handlePlacementSuccess = useCallback((player, shipType) => {
    setRemovalModeEnabled(false)
    setHoveredPlacementCell(null)
    setPlacedShipsByPlayer((value) => ({
      ...value,
      [player]: [...(value[player] ?? []), shipType],
    }))
  }, [])

  const handlePlacementRemoval = useCallback((player, shipType) => {
    setPlacedShipsByPlayer((value) => ({
      ...value,
      [player]: (value[player] ?? []).filter((type) => type !== shipType),
    }))
  }, [])

  const syncPlacedShipsForPlayer = useCallback((player, shipTypes) => {
    const normalized = Array.isArray(shipTypes) ? [...shipTypes].sort() : []
    setPlacedShipsByPlayer((value) => {
      const current = Array.isArray(value[player]) ? [...value[player]].sort() : []
      if (current.length === normalized.length && current.every((type, index) => type === normalized[index])) {
        return value
      }
      return {
        ...value,
        [player]: normalized,
      }
    })
  }, [])

  const resetPlacement = useCallback(() => {
    setPlacedShipsByPlayer(EMPTY_PLACED_BY_PLAYER())
    setHoveredPlacementCell(null)
    setRemovalModeEnabled(false)
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
    placedShips,
    setSelectedShipType,
    placementOrientation,
    setPlacementOrientation,
    rotatePlacementOrientationClockwise,
    removalModeEnabled,
    setRemovalModeEnabled,
    remainingShips,
    placementPreview,
    handlePlacementSuccess,
    handlePlacementRemoval,
    syncPlacedShipsForPlayer,
    handleCellHover,
    resetPlacement,
  }
}
