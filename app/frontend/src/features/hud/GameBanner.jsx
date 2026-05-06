/**
 * Bandeau d'en-tete : resume de la partie + bouton retour menu.
 */
export default function GameBanner({
  gameSummary,
  lobbyPartLabel,
  localPlayerNumber,
  clientOwnBoardId,
  cameraDirectionLabel,
  onBackToMenu,
}) {
  return (
    <div className="game-banner">
      <div className="game-banner__summary">
        {gameSummary}
        {' \u00b7 '}
        {lobbyPartLabel ? `${lobbyPartLabel} \u00b7 ` : ''}
        Vous: joueur {localPlayerNumber} ( grille {clientOwnBoardId}, vue {cameraDirectionLabel})
      </div>
      <button type="button" className="game-banner__button" onClick={onBackToMenu}>
        Retour au menu
      </button>
    </div>
  )
}
