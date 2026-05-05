package com.ehv.api.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.ehv.api.dto.FireRequest;
import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ActionResult;
import com.ehv.api.view.BoardStateView;
import com.ehv.api.view.CellViewState;
import com.ehv.api.view.DuelPhase;
import com.ehv.api.view.GameStateResponse;
import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.CellStatus;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GamePersistence;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;
import com.ehv.battleship.model.ShipOrientation;
import com.ehv.battleship.model.ShootDecision;
import com.ehv.battleship.model.ShotResult;

public final class DuelGameService {

    private static final int MAX_AUTOMATIC_AI_STEPS = 3000;

    private final Random random = new Random();
    private Game game;
    private int boardSize;
    private int playerCount = 2;
    /** Slots 1..humanSlots = humains, au-delà = IA. */
    private int humanSlots = 2;
    private List<Integer> fleetSizes;
    private Map<String, Integer> FLEET; // Dynamic fleet map
    private DuelPhase phase;
    private int currentPlayer;
    private Integer winner;
    private final Map<Integer, Set<String>> placedShipsByPlayer = new LinkedHashMap<>();
    private final List<Integer> placementCompletionOrder = new ArrayList<>();

    public DuelGameService() {
        reset(10, List.of(5, 4, 3, 3, 2), null, false, null);
    }

    public synchronized GameStateResponse resetAndGetState() {
        reset(10, List.of(5, 4, 3, 3, 2), null, false, null);
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized GameStateResponse resetAndGetState(int boardSize, List<Integer> fleetSizes) {
        return resetAndGetState(boardSize, fleetSizes, null, null, null);
    }

    public synchronized GameStateResponse resetAndGetState(int boardSize, List<Integer> fleetSizes, Integer requestedPlayerCount) {
        return resetAndGetState(boardSize, fleetSizes, requestedPlayerCount, null, null);
    }

    public synchronized GameStateResponse resetAndGetState(
            int boardSize,
            List<Integer> fleetSizes,
            Integer requestedPlayerCount,
            Boolean withAI,
            Integer humanPlayers) {
        reset(boardSize, fleetSizes, requestedPlayerCount, withAI, humanPlayers);
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized GameStateResponse autoPlaceFleetForBothPlayers() {
        ensurePhase(DuelPhase.PLACEMENT, "Le placement automatique est disponible uniquement pendant la phase PLACEMENT");
        for (int p = 1; p <= playerCount; p++) {
            for (String shipType : FLEET.keySet()) {
                placeShipRandomly(p, shipType);
            }
        }
        game.setState(GameState.PLAYING);
        phase = DuelPhase.BATTLE;
        currentPlayer = 1;
        advanceUntilHumanOrTerminal();
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized ActionResponse placeShip(PlaceShipRequest request) {
        validatePlacementRequest(request);
        String shipType = normalizeShipType(request.shipType());
        placeShipOnBoard(request, shipType);
        placedShipsByPlayer.get(request.player()).add(shipType);
        updatePlacementProgress(request.player());
        advanceUntilHumanOrTerminal();
        return buildActionResponse(ActionResult.PLACED, request.player());
    }

    public synchronized ActionResponse fireAt(FireRequest request) {
        validateFireRequest(request);
        Player shooter = getPlayerById(request.player());
        int targetNumber = resolveTargetPlayer(request);
        Player targetPlayer = getPlayerById(targetNumber);
        Coordinate target = new Coordinate(request.x(), request.y());
        ShotResult shotResult = game.shoot(shooter, targetPlayer, target);
        updateStateAfterShot(shotResult);
        advanceUntilHumanOrTerminal();
        return buildActionResponse(actionResultFromShot(shotResult), request.player());
    }

    public synchronized GameStateResponse advanceAiSingleStepAndGetState() {
        if (phase == DuelPhase.GAME_OVER || game.isFinished()) {
            return getStateForPlayer(viewSlotForClients());
        }
        if (isHumanSlot(currentPlayer)) {
            return getStateForPlayer(viewSlotForClients());
        }
        if (phase != DuelPhase.BATTLE) {
            return getStateForPlayer(viewSlotForClients());
        }

        Player current = getPlayerById(currentPlayer);
        if (current.hasLost()) {
            currentPlayer = nextLivingPlayerCircular(currentPlayer);
            return getStateForPlayer(viewSlotForClients());
        }
        AI ai = (AI) current;
        ShootDecision decision = ai.chooseShootingTarget(game, currentPlayer);
        Player defender = getPlayerById(decision.defenderNumber());
        ShotResult result = game.shoot(ai, defender, decision.coordinate());
        ai.handleShotResult(decision.defenderNumber(), decision.coordinate(), result);
        updateStateAfterShot(result);
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized GameStateResponse getStateForPlayer(int player) {
        validatePlayer(player);
        advanceUntilHumanOrTerminal();
        List<BoardStateView> boards = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            Player pl = getPlayerById(p);
            boolean ownBoard = p == player;
            boards.add(projectBoard(boardIdForPlayer(p), ownBoard, pl));
        }
        return new GameStateResponse(
            boardSize,
            phase,
            currentPlayer,
            winner,
            boards,
            computePlayersAlive(),
            computeAiPlayers()
        );
    }

    public synchronized List<String> listSaveFiles() {
        Path savesDir = Path.of("saves");
        if (!Files.exists(savesDir)) {
            return List.of();
        }
        try (Stream<Path> paths = Files.list(savesDir)) {
            return paths
                .filter(Files::isRegularFile)
                .map(path -> path.getFileName().toString())
                .filter(name -> name.endsWith(".save"))
                .sorted()
                .collect(Collectors.toList());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Impossible de lire les sauvegardes: " + exception.getMessage());
        }
    }

    public synchronized GameStateResponse loadGame(String fileName) {
        try {
            Game loadedGame = GamePersistence.load(fileName);
            int size = loadedGame.getPlayers().size();
            if (size != 2 && size != 4) {
                throw new IllegalArgumentException("L'API web ne supporte que les parties a 2 ou 4 joueurs");
            }
            game = loadedGame;
            synchronizeApiStateFromGame();
            return getStateForPlayer(viewSlotForClients());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Erreur de chargement: " + exception.getMessage());
        }
    }

    public synchronized GameStateResponse saveGame(String fileName) {
        try {
            GamePersistence.save(game, fileName);
            return getStateForPlayer(viewSlotForClients());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Erreur de sauvegarde: " + exception.getMessage());
        }
    }

    private static int normalizePlayerCount(Integer value) {
        if (value != null && value == 4) {
            return 4;
        }
        return 2;
    }

    private static int humanSlotsFromRequest(Boolean withAI, Integer humanPlayers, int pc) {
        if (!Boolean.TRUE.equals(withAI)) {
            return pc;
        }
        if (humanPlayers == null) {
            throw new IllegalArgumentException(
                "Le nombre de joueurs humains (humanPlayers) est requis lorsque withAI est true.");
        }
        int h = humanPlayers.intValue();
        if (h < 1 || h >= pc) {
            throw new IllegalArgumentException(
                "Nombre de joueurs humains invalide : il doit etre entre 1 et " + (pc - 1) + ".");
        }
        return h;
    }

    private boolean isHumanSlot(int playerNumber) {
        return playerNumber >= 1 && playerNumber <= humanSlots;
    }

    private void reset(
            int newBoardSize,
            List<Integer> newFleetSizes,
            Integer requestedPlayerCount,
            Boolean withAI,
            Integer humanPlayers) {
        this.boardSize = Math.max(5, newBoardSize);
        this.playerCount = normalizePlayerCount(requestedPlayerCount);
        this.humanSlots = humanSlotsFromRequest(withAI, humanPlayers, this.playerCount);

        this.fleetSizes = newFleetSizes != null && !newFleetSizes.isEmpty()
            ? new ArrayList<>(newFleetSizes)
            : List.of(5, 4, 3, 3, 2);

        this.FLEET = new LinkedHashMap<>();
        for (int index = 0; index < this.fleetSizes.size(); index++) {
            this.FLEET.put("SHIP_" + index, this.fleetSizes.get(index));
        }

        List<Player> playersList = new ArrayList<>(playerCount);
        for (int i = 1; i <= humanSlots; i++) {
            playersList.add(new Player("Joueur " + i, boardSize, fleetSizes));
        }
        for (int j = 1; j <= playerCount - humanSlots; j++) {
            playersList.add(new AI("Ordinateur " + j, boardSize, fleetSizes));
        }
        game = new Game(boardSize, playersList);
        game.setState(GameState.PLACEMENT);
        phase = DuelPhase.PLACEMENT;
        currentPlayer = 1;
        winner = null;
        placedShipsByPlayer.clear();
        placementCompletionOrder.clear();
        for (int i = 1; i <= playerCount; i++) {
            placedShipsByPlayer.put(i, new HashSet<>());
        }
        advanceUntilHumanOrTerminal();
    }

    private void synchronizeApiStateFromGame() {
        int size = game.getPlayers().size();
        if (size != 2 && size != 4) {
            throw new IllegalArgumentException("L'API requiert une partie a 2 ou 4 joueurs");
        }
        this.playerCount = size;

        humanSlots = 0;
        for (Player p : game.getPlayers()) {
            if (!p.isAI()) {
                humanSlots++;
            }
        }

        Player current = game.getCurrentPlayer();
        currentPlayer = resolvePlayerNumber(current);
        winner = null;

        if (game.getState() == GameState.FINISHED || game.isFinished()) {
            phase = DuelPhase.GAME_OVER;
            Player winningPlayer = game.getWinner();
            if (winningPlayer != null) {
                winner = resolvePlayerNumber(winningPlayer);
            }
        } else if (game.getState() == GameState.PLAYING) {
            phase = DuelPhase.BATTLE;
        } else {
            phase = DuelPhase.PLACEMENT;
        }

        placedShipsByPlayer.clear();
        placementCompletionOrder.clear();
        for (int p = 1; p <= playerCount; p++) {
            placedShipsByPlayer.put(p, collectPlacedShipTypes(p));
        }
    }

    private List<Boolean> computePlayersAlive() {
        List<Boolean> alive = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            alive.add(!getPlayerById(p).hasLost());
        }
        return List.copyOf(alive);
    }

    private List<Boolean> computeAiPlayers() {
        List<Boolean> ais = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            ais.add(getPlayerById(p).isAI());
        }
        return List.copyOf(ais);
    }

    /** Premier slot humain encore en jeu pour la vue client (hotseat sur poste unique). */
    private int viewSlotForClients() {
        for (int p = 1; p <= Math.min(humanSlots, playerCount); p++) {
            if (!getPlayerById(p).hasLost()) {
                return p;
            }
        }
        return 1;
    }

    private Set<String> collectPlacedShipTypes(int playerNumber) {
        Set<String> shipTypes = new HashSet<>();
        for (Ship ship : getPlayerById(playerNumber).getFleet().getShips()) {
            if (ship.getName() != null && !ship.getName().isBlank()) {
                shipTypes.add(ship.getName().trim().toUpperCase(Locale.ROOT));
            }
        }
        return shipTypes;
    }

    private int resolvePlayerNumber(Player player) {
        int index = game.getPlayers().indexOf(player);
        if (index < 0) {
            throw new IllegalArgumentException("Joueur introuvable dans la partie chargee");
        }
        return index + 1;
    }

    private void placeShipRandomly(int player, String shipType) {
        Player current = getPlayerById(player);
        int shipSize = FLEET.get(shipType);
        while (true) {
            ShipOrientation orientation = randomOrientation();
            int x = random.nextInt(boardSize);
            int y = random.nextInt(boardSize);
            try {
                List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(new Coordinate(x, y), shipSize, orientation);
                validateShipPlacement(current, coordinates);
                placeShipOnPlayer(current, shipType, shipSize, coordinates, orientation);
                placedShipsByPlayer.get(player).add(shipType);
                return;
            } catch (IllegalArgumentException ignored) {
                // Retry until we find a valid random position.
            }
        }
    }

    private void validatePlacementRequest(PlaceShipRequest request) {
        ensurePhase(DuelPhase.PLACEMENT, "Impossible de placer des navires hors phase PLACEMENT");
        validatePlayer(request.player());
        if (!isHumanSlot(request.player())) {
            throw new IllegalArgumentException(
                "L'ordinateur gere le placement pour les joueurs IA. Action refusee pour ce numero de joueur.");
        }
        if (isFleetComplete(request.player())) {
            throw new IllegalArgumentException("Tous les navires de ce joueur sont deja places");
        }
    }

    private void placeShipOnBoard(PlaceShipRequest request, String shipType) {
        if (placedShipsByPlayer.get(request.player()).contains(shipType)) {
            throw new IllegalArgumentException("Ce navire a deja ete place");
        }
        Player current = getPlayerById(request.player());
        int shipSize = FLEET.get(shipType);
        ShipOrientation orientation = parseOrientation(request.orientation());
        Coordinate start = new Coordinate(request.x(), request.y());
        List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(start, shipSize, orientation);
        validateShipPlacement(current, coordinates);
        placeShipOnPlayer(current, shipType, shipSize, coordinates, orientation);
    }

    private void placeShipOnPlayer(Player player, String shipType, int shipSize, List<Coordinate> coordinates, ShipOrientation orientation) {
        Ship ship = new Ship(Ship.generateId(), shipType, shipSize, coordinates, orientation);
        player.getGrid().placeShip(ship);
        player.getFleet().addShip(ship);
    }

    private void updatePlacementProgress(int player) {
        if (isFleetComplete(player) && !placementCompletionOrder.contains(player)) {
            placementCompletionOrder.add(player);
        }
        boolean allDone = true;
        for (int p = 1; p <= playerCount; p++) {
            if (!isFleetComplete(p)) {
                allDone = false;
                break;
            }
        }
        if (!allDone) {
            // Passe le tour au prochain joueur qui doit encore placer sa flotte.
            currentPlayer = nextPlayerAwaitingPlacement(player);
            return;
        }
        game.setState(GameState.PLAYING);
        phase = DuelPhase.BATTLE;
        currentPlayer = placementCompletionOrder.isEmpty() ? 1 : placementCompletionOrder.get(0);
    }

    private int nextPlayerAwaitingPlacement(int from) {
        int next = from;
        for (int i = 0; i < playerCount; i++) {
            next = (next % playerCount) + 1;
            if (!isFleetComplete(next)) {
                return next;
            }
        }
        return from;
    }

    /**
     * Joue les coups automatiques jusqu'à ce qu'un joueur humain doive décider ou la partie se termine.
     */
    private void advanceUntilHumanOrTerminal() {
        int iterations = 0;
        while (iterations++ < MAX_AUTOMATIC_AI_STEPS) {
            if (phase == DuelPhase.GAME_OVER || game.isFinished()) {
                return;
            }

            if (isHumanSlot(currentPlayer)) {
                if (phase == DuelPhase.PLACEMENT) {
                    return;
                }
                if (!getPlayerById(currentPlayer).hasLost()) {
                    return;
                }
                currentPlayer = nextLivingPlayerCircular(currentPlayer);
                continue;
            }

            Player current = getPlayerById(currentPlayer);
            AI ai = (AI) current;

            if (phase == DuelPhase.PLACEMENT) {
                if (isFleetComplete(currentPlayer)) {
                    updatePlacementProgress(currentPlayer);
                    continue;
                }
                String nextShip = nextMissingShipType(currentPlayer);
                if (nextShip == null) {
                    updatePlacementProgress(currentPlayer);
                    continue;
                }
                placeShipRandomly(currentPlayer, nextShip);
                updatePlacementProgress(currentPlayer);
                continue;
            }

            if (phase == DuelPhase.BATTLE) {
                return;
            }

            return;
        }
    }

    private String nextMissingShipType(int player) {
        Set<String> done = placedShipsByPlayer.get(player);
        for (String shipType : FLEET.keySet()) {
            if (!done.contains(shipType)) {
                return shipType;
            }
        }
        return null;
    }

    private void validateFireRequest(FireRequest request) {
        ensurePhase(DuelPhase.BATTLE, "Le tir est disponible uniquement pendant la phase BATTLE");
        validatePlayer(request.player());
        if (!isHumanSlot(request.player())) {
            throw new IllegalArgumentException(
                "L'ordinateur gere les tires des IA. Ce joueur ne peut pas utiliser cet endpoint.");
        }
        if (request.player() != currentPlayer) {
            throw new IllegalArgumentException("Ce n'est pas le tour de ce joueur");
        }
        validateCoordinateBounds(request.x(), request.y());
    }

    private int resolveTargetPlayer(FireRequest request) {
        Integer requested = request.targetPlayer();
        if (playerCount == 2) {
            if (requested == null) {
                return duelOpponent(request.player());
            }
            validatePlayer(requested);
            if (requested == request.player()) {
                throw new IllegalArgumentException("Impossible de se tirer dessus");
            }
            int expected = duelOpponent(request.player());
            if (requested != expected) {
                throw new IllegalArgumentException("Cible invalide pour le duel a 2 joueurs");
            }
            return requested;
        }
        if (requested == null) {
            throw new IllegalArgumentException("La cible (targetPlayer) est requise pour cette partie");
        }
        validatePlayer(requested);
        if (requested == request.player()) {
            throw new IllegalArgumentException("Impossible de se tirer dessus");
        }
        if (getPlayerById(requested).hasLost()) {
            throw new IllegalArgumentException("Ce joueur est elimine");
        }
        return requested;
    }

    private void updateStateAfterShot(ShotResult shotResult) {
        if (game.isFinished()) {
            phase = DuelPhase.GAME_OVER;
            game.setState(GameState.FINISHED);
            Player winningPlayer = game.getWinner();
            winner = winningPlayer != null ? resolvePlayerNumber(winningPlayer) : null;
        } else if (shotResult == ShotResult.MISS) {
            currentPlayer = nextLivingPlayerCircular(currentPlayer);
        }
    }

    private int nextLivingPlayerCircular(int from) {
        int next = from;
        for (int i = 0; i < playerCount; i++) {
            next = (next % playerCount) + 1;
            if (!getPlayerById(next).hasLost()) {
                return next;
            }
        }
        return from;
    }

    private int duelOpponent(int player) {
        return player == 1 ? 2 : 1;
    }

    private ActionResult actionResultFromShot(ShotResult shotResult) {
        return switch (shotResult) {
            case MISS -> ActionResult.MISS;
            case HIT -> ActionResult.HIT;
            case SUNK -> ActionResult.SUNK;
            case ALREADY_HIT -> ActionResult.ALREADY_HIT;
            case ALREADY_MISS -> ActionResult.ALREADY_MISS;
        };
    }

    private ActionResponse buildActionResponse(ActionResult result, int viewerPlayer) {
        return new ActionResponse(
            result,
            actionResultMessage(result),
            getStateForPlayer(viewerPlayer)
        );
    }

    private BoardStateView projectBoard(String boardId, boolean ownBoard, Player player) {
        List<List<CellViewState>> cells = new ArrayList<>(boardSize);
        for (int y = 0; y < boardSize; y += 1) {
            List<CellViewState> row = new ArrayList<>(boardSize);
            for (int x = 0; x < boardSize; x += 1) {
                row.add(computeCellState(player, ownBoard, x, y));
            }
            cells.add(row);
        }
        return new BoardStateView(boardId, ownBoard, cells);
    }

    private CellViewState computeCellState(Player player, boolean ownBoard, int x, int y) {
        CellStatus status = player.getGrid().getCell(new Coordinate(x, y));
        return switch (status) {
            case EMPTY -> CellViewState.EMPTY;
            case MISS -> CellViewState.MISS;
            case HIT -> CellViewState.HIT;
            case SUNK -> CellViewState.SUNK;
            case SHIP -> {
                if (ownBoard || phase == DuelPhase.GAME_OVER) {
                    yield CellViewState.SHIP;
                }
                yield CellViewState.EMPTY;
            }
        };
    }

    private void validateShipPlacement(Player player, List<Coordinate> coordinates) {
        for (Coordinate coordinate : coordinates) {
            if (!coordinate.isValid(boardSize)) {
                throw new IllegalArgumentException("Coordonnees hors grille");
            }
            if (player.getGrid().getCell(coordinate) == CellStatus.SHIP) {
                throw new IllegalArgumentException("Le navire chevauche un navire deja place");
            }
        }
    }

    private boolean isFleetComplete(int player) {
        return placedShipsByPlayer.get(player).size() == FLEET.size();
    }

    private String normalizeShipType(String shipType) {
        if (shipType == null || shipType.isBlank()) {
            throw new IllegalArgumentException("Le type de navire est requis");
        }
        String normalized = shipType.trim().toUpperCase(Locale.ROOT);
        if (!FLEET.containsKey(normalized)) {
            throw new IllegalArgumentException("Type de navire inconnu");
        }
        return normalized;
    }

    private ShipOrientation parseOrientation(String orientation) {
        if (orientation == null || orientation.isBlank()) {
            throw new IllegalArgumentException("L'orientation est requise");
        }
        return switch (orientation.trim().toUpperCase(Locale.ROOT)) {
            case "HORIZONTAL" -> ShipOrientation.HORIZONTAL;
            case "VERTICAL" -> ShipOrientation.VERTICAL;
            default -> throw new IllegalArgumentException("Orientation invalide");
        };
    }

    private String actionResultMessage(ActionResult result) {
        return switch (result) {
            case MISS -> "A l'eau";
            case HIT -> "Touche";
            case SUNK -> "Coule";
            case ALREADY_HIT -> "Case deja touchee";
            case ALREADY_MISS -> "Case deja visee (a l'eau)";
            case PLACED -> "Navire place avec succes";
        };
    }

    private Player getPlayerById(int player) {
        return game.getPlayers().get(player - 1);
    }

    private String boardIdForPlayer(int player) {
        return switch (player) {
            case 1 -> "A1";
            case 2 -> "B1";
            case 3 -> "C1";
            case 4 -> "D1";
            default -> throw new IllegalArgumentException("Joueur non supporte pour l'affichage: " + player);
        };
    }

    private void validatePlayer(int player) {
        if (player < 1 || player > playerCount) {
            throw new IllegalArgumentException("Le joueur doit etre entre 1 et " + playerCount);
        }
    }

    private void validateCoordinateBounds(int x, int y) {
        if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
            throw new IllegalArgumentException("Coordonnees hors grille");
        }
    }

    private void ensurePhase(DuelPhase expectedPhase, String message) {
        if (phase != expectedPhase) {
            throw new IllegalArgumentException(message);
        }
    }

    private ShipOrientation randomOrientation() {
        ShipOrientation[] values = ShipOrientation.values();
        return values[random.nextInt(values.length)];
    }
}
