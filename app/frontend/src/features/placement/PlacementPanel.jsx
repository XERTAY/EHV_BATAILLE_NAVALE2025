function ShipSelectionRow({
  selectedShipType,
  onChangeShipType,
  selectableShips,
  onRemoveSelectedShip,
  removeDisabled,
}) {
  return (
    <div className="placement-panel__row">
      <label htmlFor="ship-select">Navire</label>
      <select
        id="ship-select"
        value={selectedShipType}
        onChange={(event) => onChangeShipType(event.target.value)}
        disabled={selectableShips.length === 0}
      >
        {selectableShips.map((ship) => (
          <option key={ship.type} value={ship.type}>
            {ship.label} ({ship.size} cases)
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemoveSelectedShip}
        disabled={removeDisabled}
      >
        Retirer
      </button>
    </div>
  )
}

function buildHint({ remainingCount, removalModeEnabled, expectedOwnBoardId, selectedShipLabel, localPlayerNumber }) {
  if (remainingCount > 0) {
    if (removalModeEnabled) {
      return `Mode suppression: cliquez un bateau sur la grille ${expectedOwnBoardId}.`
    }
    return `Cliquez sur la grille ${expectedOwnBoardId} pour poser ${selectedShipLabel}.`
  }
  return `Tous vos navires (joueur ${localPlayerNumber}) sont places. Utilisez le bouton Valider la flotte.`
}

/**
 * Panneau de placement manuel : selection navire, mode suppression,
 * orientation horizontale/verticale, hint textuel.
 */
export default function PlacementPanel({
  localPlayerNumber,
  showShipSelectionRow,
  selectedShipType,
  setSelectedShipType,
  selectableShips,
  onRemoveSelectedShip,
  removeDisabled,
  removalModeEnabled,
  setRemovalModeEnabled,
  localPlacementLocked,
  placementOrientation,
  setPlacementOrientation,
  remainingShipsCount,
  expectedOwnBoardId,
  selectedShipLabel,
}) {
  return (
    <div className="placement-panel">
      <div className="placement-panel__title">
        {`Placement manuel - Joueur ${localPlayerNumber}`}
      </div>
      {showShipSelectionRow ? (
        <ShipSelectionRow
          selectedShipType={selectedShipType}
          onChangeShipType={setSelectedShipType}
          selectableShips={selectableShips}
          onRemoveSelectedShip={onRemoveSelectedShip}
          removeDisabled={removeDisabled}
        />
      ) : null}
      <div className="placement-panel__row">
        <button
          type="button"
          className={removalModeEnabled ? 'active' : ''}
          onClick={() => setRemovalModeEnabled((value) => !value)}
          disabled={localPlacementLocked}
        >
          {removalModeEnabled ? 'Suppression active' : 'Mode suppression'}
        </button>
      </div>
      <div className="placement-panel__row">
        <button
          type="button"
          className={placementOrientation === 'EAST' || placementOrientation === 'WEST' ? 'active' : ''}
          onClick={() => setPlacementOrientation('EAST')}
          disabled={removalModeEnabled}
        >
          Horizontal
        </button>
        <button
          type="button"
          className={placementOrientation === 'SOUTH' || placementOrientation === 'NORTH' ? 'active' : ''}
          onClick={() => setPlacementOrientation('SOUTH')}
          disabled={removalModeEnabled}
        >
          Vertical
        </button>
      </div>
      <div className="placement-panel__hint">
        {buildHint({
          remainingCount: remainingShipsCount,
          removalModeEnabled,
          expectedOwnBoardId,
          selectedShipLabel,
          localPlayerNumber,
        })}
      </div>
    </div>
  )
}
