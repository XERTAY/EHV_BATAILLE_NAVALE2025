function LayoutControls({
  showCoordinates,
  onToggleCoordinates,
}) {
  return (
    <div className="layout-controls">
      <button
        type="button"
        className={showCoordinates ? 'active' : ''}
        onClick={onToggleCoordinates}
      >
        Coordonnees overlay
      </button>
    </div>
  )
}

export default LayoutControls
