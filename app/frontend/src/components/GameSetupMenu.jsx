import { useMemo } from 'react'

function GameSetupMenu({
  setup,
  availableSaves,
  onChange,
  onStart,
  onRefreshSaves,
  loading,
  statusMessage,
}) {
  const totalShipCells = useMemo(() => {
    return setup.fleetShipSizes.reduce((sum, size) => sum + Number(size || 0), 0)
  }, [setup.fleetShipSizes])

  const gridCells = setup.boardSize * setup.boardSize
  const canStart = totalShipCells > 0 && totalShipCells <= gridCells && !loading
  const humanCap = setup.playerCount
  const effectiveHumanPlayers = Math.min(setup.humanPlayers, humanCap)
  const effectiveAiPlayers = setup.withAI ? Math.max(0, humanCap - effectiveHumanPlayers) : 0

  const updateFleetSize = (index, value) => {
    const nextFleet = [...setup.fleetShipSizes]
    nextFleet[index] = Math.max(1, Number(value) || 1)
    onChange({ fleetShipSizes: nextFleet })
  }

  const addShipSize = () => {
    onChange({ fleetShipSizes: [...setup.fleetShipSizes, 3] })
  }

  const removeShipSize = (index) => {
    if (setup.fleetShipSizes.length <= 1) return
    onChange({ fleetShipSizes: setup.fleetShipSizes.filter((_, shipIndex) => shipIndex !== index) })
  }

  return (
    <main className="menu-screen">
      <section className="menu-shell">
        <div className="menu-hero">
          <h1>Bataille Navale</h1>
        </div>

        <div className="menu-grid">
          <article className="menu-card menu-card--start">
            <h2>Démarrage</h2>
            <div className="menu-start-buttons">
              <button
                type="button"
                className={setup.startMode === 'new' ? 'active' : ''}
                onClick={() => onChange({ startMode: 'new' })}
              >
                Nouvelle partie
              </button>
              <button
                type="button"
                className={setup.startMode === 'load' ? 'active' : ''}
                onClick={() => onChange({ startMode: 'load' })}
              >
                Charger une sauvegarde
              </button>
            </div>

            {setup.startMode === 'load' && (
              <>
                <div className="menu-field-group">
                  <label htmlFor="saved-game-file">Sauvegardes disponibles</label>
                  <select
                    id="saved-game-file"
                    value={setup.loadSaveFile}
                    onChange={(event) => onChange({ loadSaveFile: event.target.value })}
                  >
                    <option value="bataille-navale">bataille-navale.save (defaut)</option>
                    {availableSaves.map((saveFile) => {
                      const saveValue = saveFile.endsWith('.save') ? saveFile.slice(0, -5) : saveFile
                      return (
                        <option key={saveFile} value={saveValue}>
                          {saveFile}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="menu-field-group">
                  <label htmlFor="custom-save-file">Chemin/nom de sauvegarde</label>
                  <input
                    id="custom-save-file"
                    type="text"
                    value={setup.loadSaveFile}
                    onChange={(event) => onChange({ loadSaveFile: event.target.value })}
                    placeholder="bataille-navale"
                  />
                </div>
                <div className="menu-actions menu-actions--inline">
                  <button type="button" className="menu-button menu-button--secondary" onClick={onRefreshSaves} disabled={loading}>
                    Rafraichir la liste
                  </button>
                </div>
              </>
            )}

            {setup.startMode === 'new' && (
              <></>
            )}
          </article>

          <article className="menu-card">
            <h2>Plateau</h2>
            <div className="menu-field-group">
              <label htmlFor="board-size">Taille de la grille</label>
              <input
                id="board-size"
                type="number"
                min="5"
                step="1"
                value={setup.boardSize}
                onChange={(event) => onChange({ boardSize: Number(event.target.value) })}
              />
            </div>

            <div className="menu-field-group">
              <label>Nombre de joueurs</label>
              <div className="menu-choice-row">
                <button
                  type="button"
                  className={setup.playerCount === 2 ? 'active' : ''}
                  onClick={() => onChange({ playerCount: 2, humanPlayers: Math.min(setup.humanPlayers, 2) })}
                >
                  2 joueurs
                </button>
                <button
                  type="button"
                  className={setup.playerCount === 4 ? 'active' : ''}
                  onClick={() => onChange({ playerCount: 4, humanPlayers: Math.min(setup.humanPlayers, 4) })}
                >
                  4 joueurs
                </button>
              </div>
            </div>

            <div className="menu-field-group">
              <label>IA</label>
              <div className="menu-choice-row">
                <button
                  type="button"
                  className={setup.withAI ? 'active' : ''}
                  onClick={() => onChange({ withAI: true })}
                >
                  Avec IA
                </button>
                <button
                  type="button"
                  className={!setup.withAI ? 'active' : ''}
                  onClick={() => onChange({ withAI: false, humanPlayers: setup.playerCount })}
                >
                  Sans IA
                </button>
              </div>
            </div>

            <div className="menu-field-group">
              <label htmlFor="human-players">Joueurs humains</label>
              <select
                id="human-players"
                value={effectiveHumanPlayers}
                onChange={(event) => onChange({ humanPlayers: Number(event.target.value) })}
              >
                {Array.from({ length: setup.playerCount }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </div>

            <div className="menu-summary">
              <span>{setup.boardSize} x {setup.boardSize} cases</span>
              <span>{setup.playerCount} joueurs</span>
              <span>{effectiveHumanPlayers} humains / {effectiveAiPlayers} IA</span>
            </div>
          </article>

          <article className="menu-card menu-card--wide">
            <h2>Flotte</h2>

            <div className="menu-fleet-list">
              {setup.fleetShipSizes.map((size, index) => (
                <div className="menu-fleet-row" key={`${index}-${size}`}>
                  <label htmlFor={`ship-size-${index}`}>Navire {index + 1}</label>
                  <input
                    id={`ship-size-${index}`}
                    type="number"
                    min="1"
                    max={setup.boardSize}
                    value={size}
                    onChange={(event) => updateFleetSize(index, event.target.value)}
                  />
                  <button type="button" className="menu-button menu-button--ghost" onClick={() => removeShipSize(index)}>
                    Retirer
                  </button>
                </div>
              ))}
            </div>

            <div className="menu-actions menu-actions--inline">
              <button type="button" className="menu-button menu-button--secondary" onClick={addShipSize}>
                Ajouter un navire
              </button>
            </div>

            <div className="menu-warning">
              Total: {totalShipCells} cases de navires sur {gridCells} disponibles.
              {totalShipCells > gridCells ? ' La flotte ne rentre pas dans la grille.' : ' Configuration valide.'}
            </div>
          </article>
        </div>

        <div className="menu-footer">
          <div className="menu-status">{statusMessage}</div>
          <button type="button" className="menu-button menu-button--primary" onClick={onStart} disabled={!canStart}>
            {setup.startMode === 'load' ? 'Charger la partie' : 'Commencer la partie'}
          </button>
        </div>
      </section>
    </main>
  )
}

export default GameSetupMenu