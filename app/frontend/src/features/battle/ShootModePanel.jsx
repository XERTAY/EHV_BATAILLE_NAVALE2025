const PROGRESS_FACTOR = 100

/**
 * Panneau "Passer en mode tir" : bouton + barre de progression jusqu'au
 * basculement automatique.
 */
export default function ShootModePanel({
  shootModeButtonUnlocked,
  shootModeProgress,
  onEnterShootMode,
}) {
  return (
    <div className="shoot-mode-panel">
      <button
        type="button"
        className="shoot-mode-panel__button"
        onClick={onEnterShootMode}
        disabled={!shootModeButtonUnlocked}
      >
        Passer en mode tir
      </button>
      <div className="shoot-mode-panel__progress">
        <div
          className="shoot-mode-panel__progress-fill"
          style={{ width: `${Math.round(shootModeProgress * PROGRESS_FACTOR)}%` }}
        />
      </div>
    </div>
  )
}
