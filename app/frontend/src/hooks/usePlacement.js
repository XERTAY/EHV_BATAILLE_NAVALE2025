import { useCallback, useMemo, useState } from 'react'

export const FLEET = [
  { type: 'CARRIER', size: 5 },
  { type: 'BATTLESHIP', size: 4 },
  { type: 'CRUISER', size: 3 },
  { type: 'SUBMARINE', size: 3 },
  { type: 'DESTROYER', size: 2 },
]

export default function usePlacement({ currentPlayer, gamePhase, boardSize = 10, fleetShipSizes = [5, 4, 3, 3, 2] }) {
  // Build dynamic fleet from fleetShipSizes
  const FLEET = useMemo(() => {
    const shipTypes = ['CARRIER', 'BATTLESHIP', 'CRUISER', 'SUBMARINE', 'DESTROYER']
    return fleetShipSizes.map((size, index) => ({
      type: `SHIP_${index}`, // Use unique type per size/position
      size: Math.max(1, Number(size) || 1),
    }))
  }, [fleetShipSizes])

  const [selectedShipType, setSelectedShipType] = useState(FLEET[0]?.type ?? 'SHIP_0')
  const [placementOrientation, setPlacementOrientation] = useState('HORIZONTAL')
  const [hoveredPlacementCell, setHoveredPlacementCell] = useState(null)
  const [placedShipsByPlayer, setPlacedShipsByPlayer] = useState({ 1: [], 2: [] })

  const remainingShips = useMemo(() => {
    const alreadyPlaced = new Set(placedShipsByPlayer[currentPlayer] ?? [])
    return FLEET.filter((ship) => !alreadyPlaced.has(ship.type))
  }, [placedShipsByPlayer, currentPlayer])

  const effectiveSelectedShipType = useMemo(() => {
    if (remainingShips.length === 0) return selectedShipType
    if (remainingShips.some((ship) => ship.type === selectedShipType)) return selectedShipType
    return remainingShips[0].type
  }, [remainingShips, selectedShipType])

  const selectedShip = useMemo(
    () => FLEET.find((ship) => ship.type === effectiveSelectedShipType) ?? FLEET[0],
    [effectiveSelectedShipType],
  )

  const placementPreview = useMemo(() => {
    if (!hoveredPlacementCell || !selectedShip || gamePhase !== 'PLACEMENT') return []
    const cells = []
    for (let index = 0; index < selectedShip.size; index += 1) {
      const x = placementOrientation === 'HORIZONTAL' ? hoveredPlacementCell.x + index : hoveredPlacementCell.x
      const y = placementOrientation === 'VERTICAL' ? hoveredPlacementCell.y + index : hoveredPlacementCell.y
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        cells.push({ x, y })
      }
    }
    return cells
  }, [hoveredPlacementCell, selectedShip, placementOrientation, gamePhase, boardSize])
  }, [hoveredPlacementCell, selectedShip, placementOrientation, gamePhase, boardSize])

  const handlePlacementSuccess = useCallback((player, shipType) => {
    setHoveredPlacementCell(null)
    setPlacedShipsByPlayer((value) => ({
      ...value,
      [player]: [...value[player], shipType],
    }))
  }, [])

  const resetPlacement = useCallback(() => {
    setPlacedShipsByPlayer({ 1: [], 2: [] })
    setHoveredPlacementCell(null)
    setSelectedShipType(FLEET[0]?.type ?? 'SHIP_0')
    setPlacementOrientation('HORIZONTAL')
  }, [FLEET])

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
