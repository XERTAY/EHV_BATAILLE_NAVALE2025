import { useMemo, useState } from 'react'
import BoardScene from './BoardScene'

function GameSetupMenu({
  setup,
  availableSaves,
  onChange,
  onStart,
  onRefreshSaves,
  loading,
}) {
  const [menuStep, setMenuStep] = useState('home')
  const [fleetModalOpen, setFleetModalOpen] = useState(false)
  const totalShipCells = useMemo(() => {
    return setup.fleetShipSizes.reduce((sum, size) => sum + Number(size || 0), 0)
  }, [setup.fleetShipSizes])

  const gridCells = setup.boardSize * setup.boardSize
  const canStart = !loading && (setup.startMode === 'load' || (totalShipCells > 0 && totalShipCells <= gridCells))
  const humanCap = setup.playerCount
  const effectiveHumanPlayers = Math.min(setup.humanPlayers, humanCap)
  const effectiveAiPlayers = setup.withAI ? Math.max(0, humanCap - effectiveHumanPlayers) : 0

  const updateFleetSize = (index, value) => {
    const nextFleet = [...setup.fleetShipSizes]
    nextFleet[index] = Math.max(1, Number(value) || 1)
    onChange({ fleetShipSizes: nextFleet })
  }

  const addShipSize = () => {
    if (setup.fleetShipSizes.length >= 10) return
    onChange({ fleetShipSizes: [...setup.fleetShipSizes, 3] })
  }

  const removeShipSize = (index) => {
    if (setup.fleetShipSizes.length <= 1) return
    onChange({ fleetShipSizes: setup.fleetShipSizes.filter((_, shipIndex) => shipIndex !== index) })
  }

  const updateAiCount = (aiCount) => {
    const safeAiCount = Math.max(0, Math.min(setup.playerCount - 1, Number(aiCount) || 0))
    if (safeAiCount === 0) {
      onChange({ withAI: false, humanPlayers: setup.playerCount })
      return
    }
    onChange({ withAI: true, humanPlayers: setup.playerCount - safeAiCount })
  }

  const aiCountValue = setup.withAI ? Math.max(1, setup.playerCount - effectiveHumanPlayers) : 0

  const launchNewGame = () => {
    onChange({ startMode: 'new' })
    onStart()
  }

  const launchLoadGame = () => {
    onChange({ startMode: 'load' })
    onStart()
  }

  return (
    <main className="menu-screen">
      <div className="menu-water-backdrop" aria-hidden="true">
        <BoardScene
          decorativeOnly
          waveMode="gpu"
          benchmarkEnabled={false}
          showCoordinates={false}
          boards={[]}
          boardStatesById={{}}
          recentImpactsByBoard={{}}
          interactiveBoards={{}}
          previewCells={[]}
          previewBoardId=""
          aiBoardIds={new Set()}
        />
      </div>
      <section className="menu-shell">
        <div className="menu-topbar">
          {menuStep !== 'home' && (
            <button type="button" className="menu-button menu-button--ghost" onClick={() => setMenuStep('home')}>
              Retour
            </button>
          )}
          <h1>Bataille Navale</h1>
        </div>

        {menuStep === 'home' && (
          <div className="menu-stage menu-stage--home">
            <button type="button" className="menu-main-cta" onClick={() => setMenuStep('play')}>
              Jouer
            </button>
            <button type="button" className="menu-main-cta menu-main-cta--secondary" onClick={() => setMenuStep('options')}>
              Options
            </button>
          </div>
        )}

        {menuStep === 'play' && (
          <div className="menu-stage menu-stage--play">
            <button type="button" className="menu-main-cta" onClick={() => { onChange({ startMode: 'new' }); setMenuStep('new') }}>
              Nouvelle partie
            </button>
            <button type="button" className="menu-main-cta menu-main-cta--secondary" onClick={() => { onChange({ startMode: 'load' }); setMenuStep('load') }}>
              Charger une partie
            </button>
          </div>
        )}

        {menuStep === 'options' && (
          <div className="menu-stage menu-stage--panel">
            <article className="menu-card">
              <h2>Options</h2>
              <p className="menu-start-note">
                Les options de confort (audio, raccourcis, accessibilite) seront ajoutees ici.
                Les reglages de partie se trouvent dans "Nouvelle partie".
              </p>
            </article>
          </div>
        )}

        {menuStep === 'load' && (
          <div className="menu-stage menu-stage--panel">
            <article className="menu-card">
              <h2>Charger une sauvegarde</h2>
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
                <button type="button" className="menu-button menu-button--primary" onClick={launchLoadGame} disabled={!canStart}>
                  Charger
                </button>
              </div>
            </article>
          </div>
        )}

        {menuStep === 'new' && (
          <div className="menu-stage menu-stage--panel">
            <div className="menu-grid menu-grid--compact">
              <article className="menu-card">
                <h2>Partie</h2>
                <div className="menu-field-group">
                  <label htmlFor="board-size">Taille de la grille</label>
                  <input
                    id="board-size"
                    type="number"
                    min="5"
                    max="20"
                    step="1"
                    value={setup.boardSize}
                    onChange={(event) => onChange({ boardSize: Number(event.target.value) })}
                  />
                </div>
                <div className="menu-field-group">
                  <label>Mode de jeu</label>
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
                  <label htmlFor="ai-count">Nombre d'IA</label>
                  <select
                    id="ai-count"
                    value={aiCountValue}
                    onChange={(event) => updateAiCount(event.target.value)}
                  >
                    {Array.from({ length: setup.playerCount }, (_, index) => index).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </div>
              </article>

              <article className="menu-card">
                <h2>Resume</h2>
                <div className="menu-summary">
                  <span>{setup.boardSize} x {setup.boardSize}</span>
                  <span>{setup.playerCount} joueurs</span>
                  <span>{setup.fleetShipSizes.length} navires</span>
                  <span>{totalShipCells} cases de coque</span>
                  <span>{effectiveHumanPlayers} humains / {effectiveAiPlayers} IA</span>
                  <span>{totalShipCells > gridCells ? 'Flotte invalide' : 'Flotte valide'}</span>
                </div>
                <div className="menu-actions menu-actions--inline">
                  <button type="button" className="menu-button menu-button--secondary" onClick={() => setFleetModalOpen(true)}>
                    Modifier la flotte
                  </button>
                </div>
              </article>
            </div>
          </div>
        )}

        <div className="menu-footer">
          {menuStep === 'new' && (
            <button type="button" className="menu-button menu-button--primary" onClick={launchNewGame} disabled={!canStart}>
              Lancer la partie
            </button>
          )}
        </div>

        {fleetModalOpen && (
          <div className="menu-modal-backdrop" role="presentation" onClick={() => setFleetModalOpen(false)}>
            <div className="menu-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="menu-modal__header">
                <h2>Composition de la flotte</h2>
                <button type="button" className="menu-button menu-button--ghost" onClick={() => setFleetModalOpen(false)}>
                  Fermer
                </button>
              </div>
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
                <button
                  type="button"
                  className="menu-button menu-button--secondary"
                  onClick={addShipSize}
                  disabled={setup.fleetShipSizes.length >= 10}
                >
                  Ajouter un navire
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default GameSetupMenu