import GameSetupMenu from '@/components/GameSetupMenu'

/**
 * Ecran de menu : encapsule le `GameSetupMenu` et lui passe l'etat lobby +
 * les actions (creer/rejoindre, lancer, sauvegarder/charger, etc.).
 */
export default function MenuScreen({
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
  return (
    <GameSetupMenu
      setup={setup}
      availableSaves={availableSaves}
      onChange={onChange}
      onStart={onStart}
      onStartLobbyGame={onStartLobbyGame}
      onCreateLobby={onCreateLobby}
      onJoinLobby={onJoinLobby}
      onRefreshSaves={onRefreshSaves}
      onLeaveLobby={onLeaveLobby}
      onUpdateLobbyConfig={onUpdateLobbyConfig}
      loading={loading}
      wsConnected={wsConnected}
      ensureWs={ensureWs}
      lobby={lobby}
      statusMessage={statusMessage}
    />
  )
}
