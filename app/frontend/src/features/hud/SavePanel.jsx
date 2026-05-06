/**
 * Panneau de sauvegarde : champ nom de fichier + bouton enregistrer.
 */
export default function SavePanel({ saveFileName, onChangeName, onSave, disabled }) {
  return (
    <div className="save-panel">
      <input
        type="text"
        value={saveFileName}
        onChange={(event) => onChangeName(event.target.value)}
        placeholder="bataille-navale"
      />
      <button
        type="button"
        className="menu-button menu-button--secondary"
        onClick={onSave}
        disabled={disabled}
      >
        Enregistrer la partie
      </button>
    </div>
  )
}
