import { useEffect, useMemo, useRef, useState } from 'react'
import LobbyWaitingModal from '@/features/lobby/LobbyWaitingModal'
import BoardScene from '@/features/scene/BoardScene'

function GameSetupMenu({
  setup,
  availableSaves,
  onChange,
  onStart,
  onStartLobbyGame,
  onCreateLobby,
  onJoinLobby,
  onRefreshSaves,
  onLeaveLobby,
  onUpdateLobbyConfig,
  loading,
  wsConnected,
  ensureWs,
  lobby,
  statusMessage,
}) {
  const [menuStep, setMenuStep] = useState('home')
  const [fleetModalOpen, setFleetModalOpen] = useState(false)
  const [joinGameId, setJoinGameId] = useState('')
  const [copyLabel, setCopyLabel] = useState('Copier l ID')
  const createLobbyRequestedRef = useRef(false)
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
    onStart({ startMode: 'new', setupPatch: setup })
  }
  const launchLobbyGame = () => {
    onStartLobbyGame(setup)
  }

  const launchLoadGame = () => {
    onStart({ startMode: 'load', setupPatch: setup })
  }
  const humanSlotsRemaining = Math.max(0, setup.playerCount - 1 - effectiveAiPlayers)
  const shouldShareId = humanSlotsRemaining > 0
  const canLaunchFromLobby = Boolean(lobby?.inLobby && lobby?.players >= 2)
  const canCopyGameId = Boolean(shouldShareId && lobby?.gameId)
  const hostRole = Boolean(lobby?.isHost || (lobby?.inLobby && Number(lobby?.playerNumber ?? 0) === 1))
  const isGuestInLobby = Boolean(shouldShareId && lobby?.inLobby && !hostRole)
  const isHostInLobby = Boolean(shouldShareId && lobby?.inLobby && hostRole)
  const canLaunchNewGame = shouldShareId ? Boolean(isHostInLobby && canLaunchFromLobby && canStart) : canStart
  const playersLabel = `Joueurs: ${lobby?.players ?? 0}/${lobby?.maxPlayers ?? setup.playerCount}`

  const handleCopyGameId = async () => {
    if (!lobby?.gameId) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(lobby.gameId)
      } else {
        throw new Error('clipboard-api-unavailable')
      }
      setCopyLabel('ID copie')
      window.setTimeout(() => setCopyLabel('Copier l ID'), 1200)
    } catch {
      try {
        const helperInput = document.createElement('textarea')
        helperInput.value = lobby.gameId
        helperInput.setAttribute('readonly', '')
        helperInput.style.position = 'fixed'
        helperInput.style.opacity = '0'
        helperInput.style.pointerEvents = 'none'
        document.body.appendChild(helperInput)
        helperInput.focus()
        helperInput.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(helperInput)
        if (!copied) throw new Error('copy-failed')
        setCopyLabel('ID copie')
      } catch {
        setCopyLabel('Copie impossible')
      }
      window.setTimeout(() => setCopyLabel('Copier l ID'), 1200)
    }
  }

  const openNewGameMenu = () => {
    onChange({ startMode: 'new' })
    setMenuStep('new')
  }

  useEffect(() => {
    const needsWs =
      menuStep === 'online' || (menuStep === 'new' && shouldShareId)
    if (needsWs) {
      ensureWs?.()
    }
  }, [menuStep, shouldShareId, ensureWs])

  useEffect(() => {
    // Ne pas attendre wsConnected: createGame/join appellent ensureOpen avant send.
    if (menuStep !== 'new' || !shouldShareId) return
    if (!lobby?.inLobby) {
      if (!wsConnected) {
        // Autorise une nouvelle tentative des que la socket est de nouveau connectee.
        createLobbyRequestedRef.current = false
        ensureWs?.()
        return
      }
      if (createLobbyRequestedRef.current) return
      createLobbyRequestedRef.current = true
      onCreateLobby(setup.playerCount)
      return
    }
    createLobbyRequestedRef.current = false
    // Si l'hote modifie 2/4 joueurs avant que d'autres rejoignent,
    // on recree le lobby pour appliquer la nouvelle capacite max.
    if (hostRole && (lobby.players ?? 0) <= 1 && lobby.maxPlayers !== setup.playerCount) {
      onCreateLobby(setup.playerCount)
    }
  }, [menuStep, shouldShareId, lobby?.inLobby, lobby?.players, lobby?.maxPlayers, setup.playerCount, onCreateLobby, wsConnected, ensureWs, hostRole])

  useEffect(() => {
    if (menuStep !== 'new' || !shouldShareId || lobby?.inLobby) return undefined
    if (!createLobbyRequestedRef.current) return undefined
    // Si aucun GAME_CREATED n'arrive (latence/reseau), on de-verrouille et on retente.
    const retryId = window.setTimeout(() => {
      createLobbyRequestedRef.current = false
    }, 2500)
    return () => window.clearTimeout(retryId)
  }, [menuStep, shouldShareId, lobby?.inLobby, wsConnected])

  useEffect(() => {
    if (menuStep !== 'new' || !shouldShareId) {
      createLobbyRequestedRef.current = false
    }
  }, [menuStep, shouldShareId])

  useEffect(() => {
    if (lobby?.inLobby && !hostRole && menuStep !== 'online') {
      setMenuStep('online')
    }
  }, [lobby?.inLobby, menuStep, hostRole])

  useEffect(() => {
    if (menuStep !== 'new' || !shouldShareId || !lobby?.inLobby || !hostRole) return
    const fleetShipCount = setup.fleetShipSizes.length
    const fleetTotalCells = setup.fleetShipSizes.reduce((sum, size) => sum + (Number(size) || 0), 0)
    const payload = {
      boardSize: setup.boardSize,
      playerCount: setup.playerCount,
      humanPlayers: effectiveHumanPlayers,
      aiPlayers: effectiveAiPlayers,
      fleetShipCount,
      fleetTotalCells,
    }
    const timeoutId = window.setTimeout(() => {
      onUpdateLobbyConfig?.(payload)
    }, 180)
    return () => window.clearTimeout(timeoutId)
  }, [
    menuStep,
    shouldShareId,
    lobby?.inLobby,
    hostRole,
    setup.boardSize,
    setup.playerCount,
    setup.fleetShipSizes,
    effectiveHumanPlayers,
    effectiveAiPlayers,
    onUpdateLobbyConfig,
  ])

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
        {menuStep === 'new' ? (
          <div className="menu-topbar menu-topbar--new">
            <h1>Bataille Navale</h1>
            <div className="menu-topbar__right">
              {shouldShareId && (
                <div className="menu-topbar__lobby">
                  <span>ID: {lobby?.gameId ?? '---'}</span>
                  <button
                    type="button"
                    className="menu-button menu-button--secondary"
                    onClick={handleCopyGameId}
                    disabled={!canCopyGameId}
                  >
                    {copyLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="menu-topbar">
            <div className="menu-topbar__left">
              {menuStep !== 'home' && (
                <button type="button" className="menu-button menu-button--ghost" onClick={() => setMenuStep('home')}>
                  Retour
                </button>
              )}
              {menuStep === 'new' && shouldShareId && (
                <div className="menu-topbar__lobby">
                  <span>ID: {lobby?.gameId ?? '---'}</span>
                  <button
                    type="button"
                    className="menu-button menu-button--secondary"
                    onClick={handleCopyGameId}
                    disabled={!canCopyGameId}
                  >
                    {copyLabel}
                  </button>
                </div>
              )}
            </div>
            <h1>Bataille Navale</h1>
          </div>
        )}

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
            <button type="button" className="menu-main-cta" onClick={openNewGameMenu}>
              Nouvelle partie
            </button>
            <button type="button" className="menu-main-cta menu-main-cta--secondary" onClick={() => setMenuStep('online')}>
              Rejoindre une partie
            </button>
            <button type="button" className="menu-main-cta menu-main-cta--secondary" onClick={() => { onChange({ startMode: 'load' }); setMenuStep('load') }}>
              Charger une partie
            </button>
          </div>
        )}

        {menuStep === 'online' && (
          <div className="menu-stage menu-stage--panel">
            <article className="menu-card">
              <h2>Lobby en ligne</h2>
              <p className="menu-start-note">
                Etat WebSocket: {wsConnected ? 'connecte' : 'deconnecte'}
              </p>
              <div className="menu-field-group">
                <label htmlFor="join-game-id">ID de la partie</label>
                <input
                  id="join-game-id"
                  type="text"
                  value={joinGameId}
                  onChange={(event) => setJoinGameId(event.target.value)}
                  placeholder="Collez l'ID ici"
                />
              </div>
              <div className="menu-actions menu-actions--inline">
                <button
                  type="button"
                  className="menu-button menu-button--secondary"
                  onClick={() => onJoinLobby(joinGameId)}
                  disabled={!joinGameId.trim() || loading}
                >
                  Rejoindre
                </button>
              </div>

              {lobby?.inLobby && (
                <div className="menu-summary">
                  <span>ID partie: {lobby.gameId}</span>
                  <span>Joueurs: {lobby.players}/{lobby.maxPlayers}</span>
                  <span>{hostRole ? 'Vous etes l hote' : 'Vous avez rejoint une partie'}</span>
                  {!hostRole && <span>En attente du lancement par l hote...</span>}
                </div>
              )}
            </article>
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
                {shouldShareId
                  ? (
                    <div className="menu-summary">
                      <span>Joueurs: {lobby?.players ?? 0}/{lobby?.maxPlayers ?? setup.playerCount}</span>
                      <span>ID a partager ({humanSlotsRemaining} place(s) humaine(s) restante(s))</span>
                    </div>
                    )
                  : (
                    <div className="menu-summary">
                      <span>Lobby complet avec IA (aucune place humaine restante)</span>
                    </div>
                    )}
              </article>
            </div>
          </div>
        )}

        <div className="menu-footer">
          {menuStep === 'new' && !isGuestInLobby && (
            <>
              <button
                type="button"
                className="menu-button menu-button--secondary"
                onClick={() => setMenuStep('home')}
              >
                Retour
              </button>
              <button
                type="button"
                className="menu-button menu-button--primary"
                onClick={shouldShareId ? launchLobbyGame : launchNewGame}
                disabled={!canLaunchNewGame}
              >
                Lancer la partie
              </button>
            </>
          )}
          {menuStep === 'new' && isGuestInLobby && (
            <div className="menu-start-note">En attente du lancement par l hote...</div>
          )}
          {menuStep === 'online' && lobby?.inLobby && hostRole && (
            <button
              type="button"
              className="menu-button menu-button--primary"
              onClick={launchLobbyGame}
              disabled={!canStart || !canLaunchFromLobby}
            >
              Lancer la partie
            </button>
          )}
        </div>
        {statusMessage && <div className="menu-status">{statusMessage}</div>}

        <LobbyWaitingModal
          open={Boolean(lobby?.inLobby && !hostRole)}
          preview={lobby?.lobbyConfigPreview ?? {
            boardSize: 10,
            playerCount: 2,
            humanPlayers: 2,
            aiPlayers: 0,
            fleetShipCount: 5,
            fleetTotalCells: 17,
          }}
          playersLabel={playersLabel}
          onLeave={() => onLeaveLobby?.()}
        />

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
              {statusMessage && <div className="menu-status">{statusMessage}</div>}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default GameSetupMenu