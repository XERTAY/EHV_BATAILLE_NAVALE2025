package com.ehv.battleship.legacy.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.CellStatus;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;
import com.ehv.battleship.model.ShipOrientation;
import com.ehv.battleship.model.ShootDecision;
import com.ehv.battleship.model.ShotResult;
import com.ehv.battleship.persistence.GamePersistence;
import com.ehv.battleship.persistence.SavedGameSnapshot;

/**
 * Contrôleur unique du jeu (couche Controller du MVC).
 *
 * <p>C'est une <b>façade</b> qui délègue à des collaborateurs spécialisés (présents dans le
 * même package) :
 * <ul>
 *   <li>{@link PlacementOrchestrator} : phase PLACEMENT (manuel, retrait, validation, IA auto) ;</li>
 *   <li>{@link BattleOrchestrator} : phase PLAYING (tirs humains, tirs IA pas-à-pas, verrouillage 4J) ;</li>
 *   <li>{@link GameFactories} : fabriques statiques de parties.</li>
 * </ul>
 *
 * <p>Aucun service annexe ne tient les règles : le présent contrôleur est la source de vérité unique.
 */
public class GameController {

    private static final int MAX_AI_PLACEMENT_ITERATIONS = 3000;
    private static final List<Integer> DEFAULT_FLEET = List.of(5, 4, 3, 3, 2);
    private static final int DEFAULT_BOARD_SIZE = 10;
    private static final int DEFAULT_PLAYER_COUNT = 2;

    private final SessionState state;
    private final PlacementOrchestrator placement;
    private final BattleOrchestrator battle;

    // ---------------------------------------------------------------------
    // Types résultat
    // ---------------------------------------------------------------------

    /** Résultat console de {@link #tryPlaceShip}. */
    public static final class PlaceShipResult {
        private final boolean success;
        private final String message;

        private PlaceShipResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }

        public static PlaceShipResult ok() { return new PlaceShipResult(true, null); }
        public static PlaceShipResult error(String message) { return new PlaceShipResult(false, message); }
    }

    /** Décrit un tir résolu (utilisé par l'API + tests, neutre vis-à-vis de la vue). */
    public record ShotOutcome(int shooter, int targetPlayer, int x, int y, ShotResult result) {}

    /** Décrit l'action effectuée par l'IA lors d'un avancement. */
    public record AiStepOutcome(ShotOutcome shot, int aiPlayer) {
        public boolean hasShot() { return shot != null; }
    }

    // ---------------------------------------------------------------------
    // Constructeurs / initialisation
    // ---------------------------------------------------------------------

    public GameController() {
        this(GameFactories.createNewGame(DEFAULT_BOARD_SIZE, DEFAULT_FLEET, DEFAULT_PLAYER_COUNT), DEFAULT_FLEET);
    }

    public GameController(Game game) {
        this(game, deriveFleetSizesFromGame(game));
    }

    private GameController(Game game, List<Integer> fleetSizes) {
        if (game == null) {
            throw new IllegalArgumentException("Le jeu ne peut pas être nul");
        }
        this.state = new SessionState(game, fleetSizes);
        this.placement = new PlacementOrchestrator(state);
        this.battle = new BattleOrchestrator(state);
    }

    public synchronized void reset(int boardSize, List<Integer> newFleetSizes,
                                   Integer requestedPlayerCount, Boolean withAI,
                                   Integer humanPlayers) {
        int normalizedBoardSize = Math.max(5, boardSize);
        int playerCount = normalizePlayerCount(requestedPlayerCount);
        int humans = humanSlotsFromRequest(withAI, humanPlayers, playerCount);
        List<Integer> sizes = (newFleetSizes != null && !newFleetSizes.isEmpty())
            ? List.copyOf(newFleetSizes)
            : DEFAULT_FLEET;
        GameFactories.validateFleetFitsBoard(normalizedBoardSize, sizes);

        java.util.List<Player> players = new java.util.ArrayList<>(playerCount);
        for (int i = 1; i <= humans; i++) {
            players.add(new Player("Joueur " + i, normalizedBoardSize, sizes));
        }
        for (int i = 1; i <= playerCount - humans; i++) {
            players.add(new AI("Ordinateur " + i, normalizedBoardSize, sizes));
        }

        Game replacement = new Game(normalizedBoardSize, players);
        replacement.setState(GameState.PLACEMENT);
        state.replaceGame(replacement, sizes, humans);
        state.game.setCurrentPlayerByNumber(1);
        advanceUntilHumanOrTerminal();
    }

    private static List<Integer> deriveFleetSizesFromGame(Game game) {
        if (game == null) return DEFAULT_FLEET;
        List<Player> players = game.getPlayers();
        if (players.isEmpty()) return DEFAULT_FLEET;
        List<Integer> required = players.get(0).getFleet().getRequiredSizes();
        return (required == null || required.isEmpty()) ? DEFAULT_FLEET : required;
    }

    private static int normalizePlayerCount(Integer value) {
        if (value == null) return DEFAULT_PLAYER_COUNT;
        int v = value;
        if (v == 4) return 4;
        return DEFAULT_PLAYER_COUNT;
    }

    private static int humanSlotsFromRequest(Boolean withAI, Integer humanPlayers, int playerCount) {
        if (Boolean.TRUE.equals(withAI)) {
            int humans = humanPlayers == null ? Math.max(1, playerCount - 1) : humanPlayers;
            humans = Math.max(1, Math.min(humans, playerCount - 1));
            return Math.max(1, humans);
        }
        return playerCount;
    }

    // ---------------------------------------------------------------------
    // Persistance
    // ---------------------------------------------------------------------

    public static Game loadGame(String filePath) throws IOException {
        return GamePersistence.loadSnapshot(filePath).getGame();
    }

    /** Charge une sauvegarde complète (modèle + état de session) pour la console. */
    public static GameController openFromSaveFile(String fileName) throws IOException {
        SavedGameSnapshot snapshot = GamePersistence.loadSnapshot(fileName);
        GameController controller = new GameController(snapshot.getGame(), snapshot.getFleetSizes());
        controller.applySnapshot(snapshot);
        return controller;
    }

    public String exportSnapshotJson() {
        return GamePersistence.toJson(buildSnapshot());
    }

    public void saveGame(String filePath) throws IOException {
        GamePersistence.saveSnapshot(buildSnapshot(), filePath);
    }

    public synchronized void loadAndAttachGame(String fileName) throws IOException {
        applySnapshot(GamePersistence.loadSnapshot(fileName));
    }

    public synchronized void loadFromSnapshotJson(String json) {
        applySnapshot(GamePersistence.fromJson(json));
    }

    public synchronized List<String> listSaveFiles() {
        Path savesDir = GamePersistence.savesDirectory();
        if (!Files.exists(savesDir)) {
            return List.of();
        }
        try (Stream<Path> paths = Files.list(savesDir)) {
            return paths
                .filter(Files::isRegularFile)
                .map(path -> path.getFileName().toString())
                .filter(name -> name.endsWith(".save"))
                .map(name -> name.substring(0, name.length() - ".save".length()))
                .sorted()
                .toList();
        } catch (IOException exception) {
            throw new IllegalStateException("Impossible de lister les sauvegardes", exception);
        }
    }

    private SavedGameSnapshot buildSnapshot() {
        return new SavedGameSnapshot(
            state.game,
            state.fleetSizes,
            state.humanSlots,
            new LinkedHashMap<>(state.placementLockedByPlayer),
            copyPlacedShipTypes(state.placedShipTypesByPlayer),
            new LinkedHashMap<>(state.lockedTargetByPlayer),
            List.copyOf(state.placementCompletionOrder),
            state.cachedWinner);
    }

    private void applySnapshot(SavedGameSnapshot snapshot) {
        if (snapshot == null || snapshot.getGame() == null) {
            throw new IllegalArgumentException("Sauvegarde invalide");
        }
        state.replaceGame(snapshot.getGame(), snapshot.getFleetSizes(), snapshot.getHumanSlots());
        state.placementLockedByPlayer.clear();
        state.placementLockedByPlayer.putAll(snapshot.placementLockedByPlayerAsIntMap());
        state.placedShipTypesByPlayer.clear();
        state.placedShipTypesByPlayer.putAll(copyPlacedShipTypes(snapshot.placedShipTypesByPlayerAsIntMap()));
        state.lockedTargetByPlayer.clear();
        state.lockedTargetByPlayer.putAll(snapshot.lockedTargetByPlayerAsIntMap());
        state.placementCompletionOrder.clear();
        state.placementCompletionOrder.addAll(snapshot.getPlacementCompletionOrder());
        state.cachedWinner = snapshot.getCachedWinner();
        if (state.game.getState() == GameState.SETUP) {
            state.game.setState(GameState.PLACEMENT);
        }
    }

    private static Map<Integer, Set<String>> copyPlacedShipTypes(Map<Integer, Set<String>> source) {
        Map<Integer, Set<String>> copy = new LinkedHashMap<>();
        if (source == null) {
            return copy;
        }
        source.forEach((player, types) -> copy.put(player, types == null ? new LinkedHashSet<>() : new LinkedHashSet<>(types)));
        return copy;
    }

    // ---------------------------------------------------------------------
    // Fabriques statiques (passthrough vers GameFactories pour compat)
    // ---------------------------------------------------------------------

    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes) {
        return GameFactories.createNewGame(gridSize, fleetShipSizes);
    }

    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes, int playerCount) {
        return GameFactories.createNewGame(gridSize, fleetShipSizes, playerCount);
    }

    public static Game createNewGameVsAI(int gridSize, List<Integer> fleetShipSizes) {
        return GameFactories.createNewGameVsAI(gridSize, fleetShipSizes);
    }

    public static Game createNewGameWithAI(int gridSize, List<Integer> fleetShipSizes,
                                            int humanCount, int aiCount) {
        return GameFactories.createNewGameWithAI(gridSize, fleetShipSizes, humanCount, aiCount);
    }

    public static boolean isValidFleetConfiguration(int gridSize, List<Integer> shipSizes) {
        return GameFactories.isValidFleetConfiguration(gridSize, shipSizes);
    }

    // ---------------------------------------------------------------------
    // Getters domaine
    // ---------------------------------------------------------------------

    public Game getGame() { return state.game; }
    public List<Player> getPlayers() { return state.game.getPlayers(); }
    public int getPlayerCount() { return state.playerCount(); }
    public int getGridSize() { return state.boardSize(); }
    public int getBoardSize() { return state.boardSize(); }
    public GameState getGameState() { return state.game.getState(); }
    public Player getCurrentPlayer() { return state.game.getCurrentPlayer(); }
    public int getCurrentPlayerNumber() { return state.game.getCurrentPlayerNumber(); }
    public int getHumanSlots() { return state.humanSlots; }
    public List<Integer> getFleetSizes() { return List.copyOf(state.fleetSizes); }
    public Map<String, Integer> getFleetByType() { return Map.copyOf(state.fleetByType); }
    public boolean isHumanSlot(int playerNumber) { return state.isHumanSlot(playerNumber); }
    public boolean isAiSlot(int playerNumber) {
        return playerNumber >= 1 && playerNumber <= getPlayerCount() && !isHumanSlot(playerNumber);
    }
    public boolean isCoordinateInRange(int x, int y) {
        int size = getBoardSize();
        return x >= 0 && x < size && y >= 0 && y < size;
    }
    public Player getPlayerByNumber(int playerNumber) {
        return state.playerByNumber(playerNumber);
    }

    public boolean isPlacementLocked(int playerNumber) {
        return Boolean.TRUE.equals(state.placementLockedByPlayer.get(playerNumber));
    }

    public Set<String> getPlacedShipTypes(int playerNumber) {
        Set<String> s = state.placedShipTypesByPlayer.get(playerNumber);
        return s == null ? Set.of() : Set.copyOf(s);
    }

    public Integer getCurrentTargetPlayer() {
        return battle.currentTargetPlayer();
    }

    public Integer getWinnerNumber() {
        if (state.cachedWinner != null) return state.cachedWinner;
        if (!state.game.isFinished() && state.game.getState() != GameState.FINISHED) return null;
        Player w = state.game.getWinner();
        if (w == null) return null;
        int idx = state.game.getPlayers().indexOf(w);
        if (idx < 0) return null;
        state.cachedWinner = idx + 1;
        return state.cachedWinner;
    }

    public boolean isGameFinished() {
        return state.game.isFinished() || state.game.getState() == GameState.FINISHED;
    }

    public Player getWinner() { return state.game.getWinner(); }

    public List<Player> getAvailableTargets() {
        Player current = state.game.getCurrentPlayer();
        List<Player> opponents = state.game.getOpponents(current);
        java.util.List<Player> alive = new java.util.ArrayList<>();
        for (Player op : opponents) if (!op.hasLost()) alive.add(op);
        return alive;
    }

    public Player getTargetPlayer() {
        List<Player> targets = getAvailableTargets();
        if (targets.isEmpty()) throw new IllegalStateException("Aucune cible disponible");
        return targets.get(0);
    }

    // ---------------------------------------------------------------------
    // Placement console (helpers historiques)
    // ---------------------------------------------------------------------

    public void startPlacementPhase() {
        state.game.setState(GameState.PLACEMENT);
    }

    public void finishPlacementPhase() {
        if (!areAllFleetsReady()) {
            throw new IllegalStateException("Toutes les flottes doivent être complètes avant de commencer");
        }
        state.game.start();
    }

    public boolean areAllFleetsReady() {
        for (Player player : state.game.getPlayers()) {
            if (!player.getFleet().isComplete()) return false;
        }
        return true;
    }

    public void placeShip(int x, int y, int size, ShipOrientation orientation, String shipName) {
        Player current = getCurrentPlayer();
        Coordinate startCoord = new Coordinate(x, y);
        if (!isCoordinateInRange(x, y)) {
            throw new IllegalArgumentException("Coordonnées hors de la grille");
        }
        List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(startCoord, size, orientation);
        Ship ship = new Ship(Ship.generateId(), shipName, size, coordinates, orientation);
        state.game.placeShip(current, ship);
        if (shipName != null) {
            String normalized = shipName.trim().toUpperCase(Locale.ROOT);
            state.placedShipTypesByPlayer
                .computeIfAbsent(getCurrentPlayerNumber(), k -> new java.util.LinkedHashSet<>())
                .add(normalized);
        }
        if (state.game.getState() == GameState.PLACEMENT
                && current.getFleet().isComplete()
                && !areAllFleetsReady()) {
            state.game.switchTurn();
        }
    }

    public boolean canPlaceShip(int x, int y, int size, ShipOrientation orientation) {
        Player current = getCurrentPlayer();
        Coordinate startCoord = new Coordinate(x, y);
        if (!isCoordinateInRange(x, y)) return false;
        if (!current.getGrid().canPlaceShip(startCoord, size, orientation)) return false;
        List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(startCoord, size, orientation);
        Ship tempShip = new Ship(0, "temp", size, coordinates, orientation);
        return current.getFleet().canAddShip(tempShip);
    }

    public PlaceShipResult tryPlaceShip(int x, int y, int size, String orientationStr, String shipName) {
        ShipOrientation orientation = parseOrientation(orientationStr);
        if (orientation == null) {
            return PlaceShipResult.error(
                "Orientation invalide. Utilisez H, -H, V ou -V (H = droite, -H = gauche, V = bas, -V = haut).");
        }
        if (!isCoordinateInRange(x, y)) {
            return PlaceShipResult.error("Les coordonnées de départ sont hors de la grille (1 à " + getGridSize() + ").");
        }
        if (!canPlaceShip(x, y, size, orientation)) {
            return PlaceShipResult.error("Placement invalide : le navire dépasse ou chevauche un autre navire.");
        }
        try {
            placeShip(x, y, size, orientation, shipName);
            return PlaceShipResult.ok();
        } catch (IllegalArgumentException e) {
            return PlaceShipResult.error(e.getMessage());
        }
    }

    public static ShipOrientation parseOrientation(String s) {
        if (s == null) return null;
        switch (s.trim().toUpperCase(Locale.ROOT)) {
            case "H":          case "HORIZONTAL":      return ShipOrientation.HORIZONTAL;
            case "-H":         case "HORIZONTAL_LEFT": return ShipOrientation.HORIZONTAL_LEFT;
            case "V":          case "VERTICAL":        return ShipOrientation.VERTICAL;
            case "-V":         case "VERTICAL_UP":     return ShipOrientation.VERTICAL_UP;
            default: return null;
        }
    }

    // ---------------------------------------------------------------------
    // Placement web (délégation à PlacementOrchestrator)
    // ---------------------------------------------------------------------

    public synchronized void placeShipForPlayer(int playerNumber, String shipType, int x, int y, String orientation) {
        placement.placeShipForPlayer(playerNumber, shipType, x, y, orientation);
        advanceUntilHumanOrTerminal();
    }

    public synchronized void removeShipForPlayer(int playerNumber, String shipType, Integer x, Integer y) {
        placement.removeShipForPlayer(playerNumber, shipType, x, y);
        advanceUntilHumanOrTerminal();
    }

    public synchronized void confirmPlacementForPlayer(int playerNumber) {
        placement.confirmPlacementForPlayer(playerNumber);
        advanceUntilHumanOrTerminal();
    }

    public synchronized void autoPlaceFleetForAllPlayers() {
        placement.autoPlaceFleetForAllPlayers();
        advanceUntilHumanOrTerminal();
    }

    // ---------------------------------------------------------------------
    // Bataille (délégation à BattleOrchestrator)
    // ---------------------------------------------------------------------

    public ShotResult playShot(int x, int y) {
        Player current = getCurrentPlayer();
        Player target = getTargetPlayer();
        return state.game.shoot(current, target, new Coordinate(x, y));
    }

    public ShotResult playShot(Player target, int x, int y) {
        if (target == null) throw new IllegalArgumentException("La cible ne peut pas être nulle");
        Player current = getCurrentPlayer();
        if (current.equals(target)) throw new IllegalArgumentException("Un joueur ne peut pas se cibler lui-même");
        if (target.hasLost()) throw new IllegalArgumentException("Ce joueur est déjà éliminé");
        return state.game.shoot(current, target, new Coordinate(x, y));
    }

    public void endTurn() {
        state.game.switchTurn();
    }

    public synchronized ShotOutcome fireAt(int shooter, int x, int y, Integer requestedTarget) {
        ShotOutcome outcome = battle.fireAt(shooter, x, y, requestedTarget);
        advanceUntilHumanOrTerminal();
        return outcome;
    }

    public synchronized AiStepOutcome advanceAiSingleStep() {
        AiStepOutcome step = battle.advanceAiSingleStep();
        advanceUntilHumanOrTerminal();
        return step;
    }

    // ---------------------------------------------------------------------
    // IA console (helpers historiques)
    // ---------------------------------------------------------------------

    public boolean isCurrentPlayerAI() {
        return getCurrentPlayer() instanceof AI;
    }

    public void autoPlaceFleetForAI() {
        Player current = getCurrentPlayer();
        if (!(current instanceof AI)) {
            throw new IllegalStateException("Le joueur courant n'est pas une IA");
        }
        ((AI) current).placeFleetStandardTypes();
    }

    public Coordinate playAITurn() {
        Player current = getCurrentPlayer();
        if (!(current instanceof AI)) {
            throw new IllegalStateException("Le joueur courant n'est pas une IA");
        }
        AI ai = (AI) current;
        int selfNumber = state.game.getPlayers().indexOf(current) + 1;
        ShootDecision decision = ai.chooseShootingTarget(state.game, selfNumber);
        Player target = state.game.getPlayers().get(decision.defenderNumber() - 1);
        ShotResult result = state.game.shoot(current, target, decision.coordinate());
        ai.handleShotResult(decision.defenderNumber(), decision.coordinate(), result);
        return decision.coordinate();
    }

    /**
     * Boucle d'avancement : termine les placements IA, valide leur flotte et s'arrête sur un
     * humain ou en BATTLE. Les tirs IA passent par {@link #advanceAiSingleStep()}.
     */
    public void advanceUntilHumanOrTerminal() {
        if (state.game.getState() == GameState.SETUP) {
            state.game.setState(GameState.PLACEMENT);
        }
        int iterations = 0;
        while (iterations++ < MAX_AI_PLACEMENT_ITERATIONS) {
            if (state.game.getState() == GameState.FINISHED || state.game.isFinished()) return;
            int current = getCurrentPlayerNumber();
            if (isHumanSlot(current)) {
                if (state.game.getState() == GameState.PLACEMENT) {
                    // Humain déjà validé : enchaîner sur les IA (ou autre joueur non verrouillé).
                    if (Boolean.TRUE.equals(state.placementLockedByPlayer.get(current))) {
                        int next = placement.nextPlayerAwaitingPlacement(current);
                        if (next != current) {
                            state.game.setCurrentPlayerByNumber(next);
                            continue;
                        }
                    } else {
                        return;
                    }
                    continue;
                }
                if (!getPlayerByNumber(current).hasLost()) return;
                state.game.switchTurn();
                if (current == getCurrentPlayerNumber()) return;
                continue;
            }
            Player currentPlayer = getPlayerByNumber(current);
            if (!(currentPlayer instanceof AI)) return;
            if (state.game.getState() == GameState.PLACEMENT) {
                if (Boolean.TRUE.equals(state.placementLockedByPlayer.get(current))) {
                    int next = placement.nextPlayerAwaitingPlacement(current);
                    if (next == current) return;
                    state.game.setCurrentPlayerByNumber(next);
                    continue;
                }
                String missing = placement.nextMissingShipType(current);
                if (missing == null) {
                    placement.confirmPlacementInternal(current);
                    continue;
                }
                placement.placeShipRandomly(current, missing);
                continue;
            }
            if (state.game.getState() == GameState.PLAYING) return;
            return;
        }
    }

    // ---------------------------------------------------------------------
    // Forfait
    // ---------------------------------------------------------------------

    public synchronized ShotOutcome forfeitPlayer(int forfeitingPlayer) {
        int playerCount = getPlayerCount();
        if (forfeitingPlayer < 1 || forfeitingPlayer > playerCount) {
            throw new IllegalArgumentException("Le joueur doit être entre 1 et " + playerCount);
        }
        if (state.game.getState() == GameState.FINISHED || state.game.isFinished()) {
            return null;
        }
        Player forfeit = getPlayerByNumber(forfeitingPlayer);
        for (Ship ship : forfeit.getFleet().getShips()) {
            ship.setSunk(true);
            for (Coordinate c : ship.getCoordinates()) {
                forfeit.getGrid().setCell(c, CellStatus.SUNK);
            }
        }
        Integer next = null;
        for (int p = 1; p <= playerCount; p++) {
            if (p == forfeitingPlayer) continue;
            if (!getPlayerByNumber(p).hasLost()) { next = p; break; }
        }
        if (next != null) {
            state.cachedWinner = next;
            state.game.setCurrentPlayerByNumber(next);
        }
        state.game.setState(GameState.FINISHED);
        return null;
    }
}
