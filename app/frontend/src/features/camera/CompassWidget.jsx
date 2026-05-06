const DIRECTIONS = [
  { id: 'NORTH', short: 'N', aria: 'Orienter la camera vers le nord' },
  { id: 'EAST', short: 'E', aria: 'Orienter la camera vers l est' },
  { id: 'SOUTH', short: 'S', aria: 'Orienter la camera vers le sud' },
  { id: 'WEST', short: 'W', aria: 'Orienter la camera vers l ouest' },
]

/**
 * Boussole de selection de direction de camera (4 boutons N/E/S/W).
 */
export default function CompassWidget({
  cameraFacingDirection,
  cameraDirectionLabel,
  canChooseCameraDirection,
  onSelect,
}) {
  return (
    <div className="compass-widget" aria-label={`Boussole, direction ${cameraDirectionLabel}`}>
      {DIRECTIONS.map((direction) => {
        const isActive = cameraFacingDirection === direction.id
        return (
          <button
            key={direction.id}
            type="button"
            className={`compass-widget__dir ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(direction.id)}
            disabled={!canChooseCameraDirection}
            aria-label={direction.aria}
          >
            {direction.short}
          </button>
        )
      })}
    </div>
  )
}
