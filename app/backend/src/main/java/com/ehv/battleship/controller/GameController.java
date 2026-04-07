package com.ehv.battleship.legacy.controller;

import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GamePersistence;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;
import com.ehv.battleship.model.ShipOrientation;
import com.ehv.battleship.model.ShotResult;
import com.ehv.battleship.model.AI;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

public class GameController {

    public static class PlaceShipResult {
        private final boolean success;
        private final String message;

        private PlaceShipResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() {
            return success;
        }

        public String getMessage() {
            return message;
        }

        public static PlaceShipResult ok() {
            return new PlaceShipResult(true, null);
        }

        public static PlaceShipResult error(String message) {
            return new PlaceShipResult(false, message);
        }
    }

    private final Game game;

    public GameController(Game game) {
        if (game == null) {
            throw new IllegalArgumentException("Le jeu ne peut pas être nul");
        }
        this.game = game;
    }


    public static Game loadGame(String filePath) throws IOException {
        return GamePersistence.load(filePath);
    }

    public void saveGame(String filePath) throws IOException {
        GamePersistence.save(game, filePath);
    }

    /**
     * Crée une nouvelle partie avec 2 joueurs humains et la flotte donnée.
     * @throws IllegalArgumentException si la configuration de flotte est invalide (trop de cases)
     */
    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes) {
        return createNewGame(gridSize, fleetShipSizes, 2);
    }

    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes, int playerCount) {
        if (!isValidFleetConfiguration(gridSize, fleetShipSizes)) {
            int total = 0;
            for (Integer size : fleetShipSizes) {
                if (size != null) {
                    total += size;
                }
            }
            int gridCells = gridSize * gridSize;
            throw new IllegalArgumentException(
                "Le total des cases de navires (" + total + ") dépasse le nombre de cases de la grille (" + gridCells + ").");
        }

        if (playerCount != 2 && playerCount != 4) {
            throw new IllegalArgumentException("Le nombre de joueurs doit être 2 ou 4.");
        }

        List<Player> players = new java.util.ArrayList<>();
        for (int i = 1; i <= playerCount; i++) {
            players.add(new Player("Joueur " + i, gridSize, fleetShipSizes));
        }

        return new Game(gridSize, players);
    }

    public static boolean isValidFleetConfiguration(int gridSize, List<Integer> shipSizes) {
        int total = 0;
        for (Integer size : shipSizes) {
            if (size != null) {
                total += size;
            }
        }
        return total <= gridSize * gridSize;
    }

    public List<Player> getPlayers() {
        return game.getPlayers();
    }

    public int getGridSize() {
        return game.getGridSize();
    }

    public Player getCurrentPlayer() {
        return game.getCurrentPlayer();
    }

    public Player getTargetPlayer() {
        List<Player> targets = getAvailableTargets();
        if (targets.isEmpty()) {
            throw new IllegalStateException("Aucune cible disponible");
        }
        return targets.get(0);
    }

    public List<Player> getAvailableTargets() {
        Player current = game.getCurrentPlayer();
        List<Player> opponents = game.getOpponents(current);
        List<Player> availableTargets = new java.util.ArrayList<>();
        for (Player opponent : opponents) {
            if (!opponent.hasLost()) {
                availableTargets.add(opponent);
            }
        }
        return availableTargets;
    }

    public boolean isCoordinateInRange(int x, int y) {
        int size = game.getGridSize();
        return x >= 0 && x < size && y >= 0 && y < size;
    }

    public ShotResult playShot(int x, int y) {
        Player current = getCurrentPlayer();
        Player target = getTargetPlayer();
        Coordinate coordinate = new Coordinate(x, y);
        return game.shoot(current, target, coordinate);
    }

    public ShotResult playShot(Player target, int x, int y) {
        if (target == null) {
            throw new IllegalArgumentException("La cible ne peut pas être nulle");
        }

        Player current = getCurrentPlayer();
        if (current.equals(target)) {
            throw new IllegalArgumentException("Un joueur ne peut pas se cibler lui-même");
        }
        if (target.hasLost()) {
            throw new IllegalArgumentException("Ce joueur est déjà éliminé");
        }

        Coordinate coordinate = new Coordinate(x, y);
        return game.shoot(current, target, coordinate);
    }

    public boolean isGameFinished() {
        return game.isFinished() || game.getState() == GameState.FINISHED;
    }

    public Player getWinner() {
        return game.getWinner();
    }

    public void endTurn() {
        game.switchTurn();
    }

    // Place un navire 
    public void placeShip(int x, int y, int size, ShipOrientation orientation, String shipName) {
        Player current = getCurrentPlayer();
        Coordinate startCoord = new Coordinate(x, y);
        
        if (!isCoordinateInRange(x, y)) {
            throw new IllegalArgumentException("Coordonnées hors de la grille");
        }
        
        //  coordonnées navire
        List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(
            startCoord, size, orientation);
        
        int shipId = Ship.generateId(); // Note: ID unique pour chaque navire
        Ship ship = new Ship(shipId, shipName, size, coordinates, orientation);
        game.placeShip(current, ship);
        
        if (game.getState() == GameState.PLACEMENT
                && current.getFleet().isComplete()
                && !areAllFleetsReady()) {
            game.switchTurn();
        }
    }

    // Vérifie si un placement est valide avant de le faire
    public boolean canPlaceShip(int x, int y, int size, ShipOrientation orientation) {
        Player current = getCurrentPlayer();
        Coordinate startCoord = new Coordinate(x, y);
        
        if (!isCoordinateInRange(x, y)) {
            return false;
        }
        
        if (!current.getGrid().canPlaceShip(startCoord, size, orientation)) {
            return false;
        }
        
        // Vérifier chevauchement avec navires existants
        List<Coordinate> coordinates = current.getGrid().generateShipCoordinates(
            startCoord, size, orientation);
        Ship tempShip = new Ship(0, "temp", size, coordinates, orientation); // Note: navire temporaire pour validation
        
        return current.getFleet().canAddShip(tempShip);
    }

    // Vérifie si toutes les flottes sont complètes
    public boolean areAllFleetsReady() {
        for (Player player : game.getPlayers()) {
            if (!player.getFleet().isComplete()) {
                return false;
            }
        }
        return true;
    }

    // Démarre la phase de placement
    public void startPlacementPhase() {
        game.setState(GameState.PLACEMENT);
    }

    // Termine le placement et démarre le jeu
    public void finishPlacementPhase() {
        if (!areAllFleetsReady()) {
            throw new IllegalStateException("Toutes les flottes doivent être complètes avant de commencer");
        }
        game.start();
    }

    /**
     * Tente de placer un navire (parsing de l'orientation et validation dans le contrôleur).
     * @param x coordonnée x 0-based
     * @param y coordonnée y 0-based
     * @return résultat avec message d'erreur éventuel
     */
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

    /**
     * Parse une chaîne d'orientation (H, -H, V, -V) en enum.
     * @return l'orientation ou null si invalide
     */
    public static ShipOrientation parseOrientation(String s) {
        if (s == null) return null;
        switch (s.trim().toUpperCase()) {
            case "H":  return ShipOrientation.HORIZONTAL;
            case "-H": return ShipOrientation.HORIZONTAL_LEFT;
            case "V":  return ShipOrientation.VERTICAL;
            case "-V": return ShipOrientation.VERTICAL_UP;
            default:   return null;
        }
    }


    // IA
    public boolean isCurrentPlayerAI() {
        return getCurrentPlayer() instanceof AI;
    }

    // Méthode pour que l'IA place automatiquement sa flotte

    public void autoPlaceFleetForAI() {

    Player current = getCurrentPlayer();

    if (!(current instanceof AI)) {
        throw new IllegalStateException("Le joueur courant n'est pas une IA");
    }

    AI ai = (AI) current;

    ai.autoPlaceFleet(this);
}

// Méthode pour que l'IA choisisse sa cible et joue son coup
    public Coordinate playAITurn() {

    Player current = getCurrentPlayer();
    Player target = getTargetPlayer();

    if (!(current instanceof AI)) {
        throw new IllegalStateException("Le joueur courant n'est pas une IA");
    }

    AI ai = (AI) current;

    Coordinate shot = ai.chooseTarget();

    ShotResult result = game.shoot(current, target, shot);

    ai.handleShotResult(shot, result);

    return shot;
}

public static Game createNewGameVsAI(int gridSize, List<Integer> fleetShipSizes) {

    if (!isValidFleetConfiguration(gridSize, fleetShipSizes)) {
        int total = 0;
        for (Integer size : fleetShipSizes) {
            if (size != null) {
                total += size;
            }
        }
        int gridCells = gridSize * gridSize;
        throw new IllegalArgumentException(
            "Le total des cases de navires (" + total +
            ") dépasse le nombre de cases de la grille (" + gridCells + ").");
    }

    List<Player> players = Arrays.asList(
        new Player("Joueur 1", gridSize, fleetShipSizes),
        new AI("Ordinateur", gridSize, fleetShipSizes)
    );

    return new Game(gridSize, players);
}

public static Game createNewGameWithAI(int gridSize, List<Integer> fleetShipSizes, int humanCount, int aiCount) {

    if (!isValidFleetConfiguration(gridSize, fleetShipSizes)) {
        int total = 0;
        for (Integer size : fleetShipSizes) {
            if (size != null) {
                total += size;
            }
        }
        int gridCells = gridSize * gridSize;
        throw new IllegalArgumentException(
            "Le total des cases de navires (" + total +
            ") dépasse le nombre de cases de la grille (" + gridCells + ").");
    }

    if (humanCount < 1) {
        throw new IllegalArgumentException("Il faut au moins 1 joueur humain.");
    }
    if (aiCount < 1) {
        throw new IllegalArgumentException("Il faut au moins 1 IA.");
    }
    int totalPlayers = humanCount + aiCount;
    if (totalPlayers != 2 && totalPlayers != 4) {
        throw new IllegalArgumentException("Cette configuration doit contenir 2 ou 4 joueurs au total.");
    }

    List<Player> players = new java.util.ArrayList<>();
    for (int i = 1; i <= humanCount; i++) {
        players.add(new Player("Joueur " + i, gridSize, fleetShipSizes));
    }
    for (int i = 1; i <= aiCount; i++) {
        players.add(new AI("Ordinateur " + i, gridSize, fleetShipSizes));
    }

    return new Game(gridSize, players);
}
}

