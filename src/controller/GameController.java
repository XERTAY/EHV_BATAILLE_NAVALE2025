package com.ehv.battleship.controller;

import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;
import com.ehv.battleship.model.ShipOrientation;
import com.ehv.battleship.model.ShotResult;

import java.util.List;

public class GameController {

    private final Game game;

    public GameController(Game game) {
        if (game == null) {
            throw new IllegalArgumentException("Le jeu ne peut pas être nul");
        }
        this.game = game;
    }

    public int getGridSize() {
        return game.getGridSize();
    }

    public Player getCurrentPlayer() {
        return game.getCurrentPlayer();
    }

    public Player getTargetPlayer() {
        Player current = game.getCurrentPlayer();
        List<Player> opponents = game.getOpponents(current);
        // Pour l'instant, on prend le premier adversaire
        // Plus tard, on pourra gérer plusieurs adversaires
        if (opponents.isEmpty()) {
            throw new IllegalStateException("Aucun adversaire disponible");
        }
        return opponents.get(0);
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
}

