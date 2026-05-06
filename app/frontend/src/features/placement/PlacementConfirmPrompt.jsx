/**
 * Prompt "Valider la flotte" affiche quand tous les navires sont poses.
 */
export default function PlacementConfirmPrompt({ disabled, onConfirm }) {
  return (
    <div className="shoot-mode-panel">
      <button
        type="button"
        className="shoot-mode-panel__button shoot-mode-panel__button--confirm"
        onClick={onConfirm}
        disabled={disabled}
      >
        Valider la flotte
      </button>
    </div>
  )
}
