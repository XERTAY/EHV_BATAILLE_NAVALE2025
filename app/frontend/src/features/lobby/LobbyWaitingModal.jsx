export default function LobbyWaitingModal({ open, preview, playersLabel, onLeave }) {
  if (!open) return null
  return (
    <div className="menu-modal-backdrop" role="presentation">
      <div className="menu-modal" role="dialog" aria-modal="true">
        <div className="menu-modal__header">
          <h2>En attente de l hote</h2>
        </div>
        <div className="menu-summary">
          <span>{playersLabel}</span>
          <span>Grille: {preview.boardSize} x {preview.boardSize}</span>
          <span>Mode: {preview.playerCount} joueurs</span>
          <span>Humains: {preview.humanPlayers} / IA: {preview.aiPlayers}</span>
          <span>Flotte: {preview.fleetShipCount} navires ({preview.fleetTotalCells} cases)</span>
        </div>
        <div className="menu-actions menu-actions--inline">
          <button
            type="button"
            className="menu-button menu-button--ghost"
            onClick={onLeave}
          >
            Quitter le lobby
          </button>
        </div>
      </div>
    </div>
  )
}
