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
  const [placementOrientation, setPlacementOrientation] = useState('HORIZONTAL')
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

  const placementPreview = useMemo(() => {
    if (!hoveredPlacementCell || !selectedShip || gamePhase !== 'PLACEMENT') return []
    const cells = []
    for (let index = 0; index < selectedShip.size; index += 1) {
      const x = placementOrientation === 'HORIZONTAL' ? hoveredPlacementCell.x + index : hoveredPlacementCell.x
      const y = placementOrientation === 'VERTICAL' ? hoveredPlacementCell.y + index : hoveredPlacementCell.y
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
    setPlacementOrientation('HORIZONTAL')
  }, [fleet])

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
    setSelectedShipType,
    placementOrientation,
    setPlacementOrientation,
    remainingShips,
    placementPreview,
    handlePlacementSuccess,
    handleCellHover,
    resetPlacement,
  }
}
