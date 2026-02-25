package com.ehv.battleship.controller;

import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;
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

    public void endTurn() {
        game.switchTurn();
    }
}


