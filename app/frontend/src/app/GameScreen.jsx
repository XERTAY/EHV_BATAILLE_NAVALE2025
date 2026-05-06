import ErrorToast from '@/components/feedback/ErrorToast'
import LayoutControls from '@/components/LayoutControls'
import CompassWidget from '@/features/camera/CompassWidget'
import BoardScene from '@/features/scene/BoardScene'
import ShootModePanel from '@/features/battle/ShootModePanel'
import GameBanner from '@/features/hud/GameBanner'
import SavePanel from '@/features/hud/SavePanel'
import TurnBanner from '@/features/hud/TurnBanner'
import OpponentPresencePanel from '@/features/hud/OpponentPresencePanel'
import PlacementConfirmPrompt from '@/features/placement/PlacementConfirmPrompt'
import PlacementPanel from '@/features/placement/PlacementPanel'
import PlacementWaitBanner from '@/features/placement/PlacementWaitBanner'

/**
 * Ecran de jeu : compose les sous-composants HUD/placement/battle/feedback
 * autour de la scene 3D. Aucune logique metier ici - tout vient des hooks.
 */
export default function GameScreen({
  // HUD / setup
  gameSummary,
  lobbyPartLabel,
  localPlayerNumber,
  clientOwnBoardId,
  cameraDirectionLabel,
  setup,
  loading,
  applySetupPatch,
  // Actions
  onBackToMenu,
  onSaveCurrentGame,
  onCellClick,
  onCellHover,
  onConfirmPlacement,
  onRemoveSelectedShip,
  onEnterShootMode,
  onCompassDirectionClick,
  onCameraDirectionChange,
  // Selectors
  turnOverlayLabel,
  isGameOver,
  didLocalPlayerWin,
  gamePhase,
  showCoordinates,
  toggleCoordinates,
  errorMessage,
  // Compass
  cameraFacingDirection,
  canChooseCameraDirection,
  // Shoot mode
  shouldShowShootModePrompt,
  shootModeButtonUnlocked,
  shootModeProgress,
  // Placement
  shouldShowPlacementConfirmPrompt,
  localPlacementCompleted,
  localPlacementLocked,
  showShipSelectionRow,
  selectedShipType,
  setSelectedShipType,
  selectableShips,
  canRemoveSelectedShip,
  removalModeEnabled,
  setRemovalModeEnabled,
  placementOrientation,
  setPlacementOrientation,
  remainingShipsCount,
  expectedOwnBoardId,
  selectedShipLabel,
  // Scene
  boards,
  aiBoardIds,
  isDuelWithAi,
  topDownView,
  effectiveCameraDirection,
  cameraStateKey,
  boardSize,
  boardStatesById,
  recentImpactsByBoard,
  opponentPresence,
  interactiveBoards,
  placementPreview,
  waveMode,
  benchmarkEnabled,
}) {
  const placementAlreadyValidatedByServer = String(errorMessage ?? '')
    .toLowerCase()
    .includes('placement deja valide')
  const shouldShowPlacementWaitBanner = localPlacementCompleted || placementAlreadyValidatedByServer
  const shouldShowPlacementPanel =
    gamePhase === 'PLACEMENT'
    && !localPlacementLocked
    && !placementAlreadyValidatedByServer
    && !localPlacementCompleted

  return (
    <main className="app-root">
      <LayoutControls
        showCoordinates={showCoordinates}
        onToggleCoordinates={toggleCoordinates}
      />
      <GameBanner
        gameSummary={gameSummary}
        lobbyPartLabel={lobbyPartLabel}
        localPlayerNumber={localPlayerNumber}
        clientOwnBoardId={clientOwnBoardId}
        cameraDirectionLabel={cameraDirectionLabel}
        onBackToMenu={onBackToMenu}
      />
      <SavePanel
        saveFileName={setup.saveFileName}
        onChangeName={(name) => applySetupPatch({ saveFileName: name })}
        onSave={onSaveCurrentGame}
        disabled={loading}
      />
      <TurnBanner
        label={turnOverlayLabel}
        isGameOver={isGameOver}
        didLocalPlayerWin={didLocalPlayerWin}
      />
      <OpponentPresencePanel presence={opponentPresence} />
      <CompassWidget
        cameraFacingDirection={cameraFacingDirection}
        cameraDirectionLabel={cameraDirectionLabel}
        canChooseCameraDirection={canChooseCameraDirection}
        onSelect={onCompassDirectionClick}
      />
      {shouldShowShootModePrompt ? (
        <ShootModePanel
          shootModeButtonUnlocked={shootModeButtonUnlocked}
          shootModeProgress={shootModeProgress}
          onEnterShootMode={onEnterShootMode}
        />
      ) : null}
      {shouldShowPlacementConfirmPrompt ? (
        <PlacementConfirmPrompt
          disabled={loading || localPlacementLocked}
          onConfirm={onConfirmPlacement}
        />
      ) : null}
      {shouldShowPlacementWaitBanner ? <PlacementWaitBanner /> : null}
      {shouldShowPlacementPanel ? (
        <PlacementPanel
          localPlayerNumber={localPlayerNumber}
          showShipSelectionRow={showShipSelectionRow}
          selectedShipType={selectedShipType}
          setSelectedShipType={setSelectedShipType}
          selectableShips={selectableShips}
          onRemoveSelectedShip={onRemoveSelectedShip}
          removeDisabled={loading || localPlacementLocked || !canRemoveSelectedShip}
          removalModeEnabled={removalModeEnabled}
          setRemovalModeEnabled={setRemovalModeEnabled}
          localPlacementLocked={localPlacementLocked}
          placementOrientation={placementOrientation}
          setPlacementOrientation={setPlacementOrientation}
          remainingShipsCount={remainingShipsCount}
          expectedOwnBoardId={expectedOwnBoardId}
          selectedShipLabel={selectedShipLabel}
        />
      ) : null}
      <ErrorToast message={errorMessage} />
      <BoardScene
        boards={boards}
        aiBoardIds={aiBoardIds}
        duelAiFocus={isDuelWithAi}
        gamePhase={gamePhase}
        topDownView={topDownView}
        ownBoardId={clientOwnBoardId}
        cameraDirection={effectiveCameraDirection}
        cameraStateKey={cameraStateKey}
        boardSize={boardSize}
        boardStatesById={boardStatesById}
        recentImpactsByBoard={recentImpactsByBoard}
        interactiveBoards={interactiveBoards}
        previewCells={placementPreview}
        previewBoardId={expectedOwnBoardId}
        showCoordinates={showCoordinates}
        waveMode={waveMode}
        benchmarkEnabled={benchmarkEnabled}
        onCameraDirectionChange={onCameraDirectionChange}
        onCellHover={onCellHover}
        onCellClick={onCellClick}
      />
    </main>
  )
}
