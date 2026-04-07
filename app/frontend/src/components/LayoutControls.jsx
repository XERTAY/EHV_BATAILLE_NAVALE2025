function LayoutControls({
  layoutSet,
  showCoordinates,
  waveMode,
  benchmarkEnabled,
  onLayoutChange,
  onToggleCoordinates,
  onToggleWaveMode,
  onToggleBenchmark,
}) {
  return (
    <div className="layout-controls">
      <button
        type="button"
        className={layoutSet === 'faceoff' ? 'active' : ''}
        onClick={() => onLayoutChange('faceoff')}
      >
        Duel (2 grilles face a face)
      </button>
      <button
        type="button"
        className={layoutSet === 'star4' ? 'active' : ''}
        onClick={() => onLayoutChange('star4')}
      >
        Etoile (4 grilles + centre vide)
      </button>
      <button
        type="button"
        className={showCoordinates ? 'active' : ''}
        onClick={onToggleCoordinates}
      >
        Coordonnees overlay
      </button>
      <button
        type="button"
        className={waveMode === 'gpu' ? 'active' : ''}
        onClick={onToggleWaveMode}
      >
        Onde {waveMode.toUpperCase()}
      </button>
      <button
        type="button"
        className={benchmarkEnabled ? 'active' : ''}
        onClick={onToggleBenchmark}
      >
        Benchmark FPS
      </button>
    </div>
  )
}

export default LayoutControls
