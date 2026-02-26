package com.ehv.battleship.model;

import java.util.List;
import java.util.Random;
import java.io.Serializable;

public class AI implements Serializable {

    private static final long serialVersionUID = 1L;

    private final Random random;

    public AI() {
        this.random = new Random();
    }

    /**
     * Choisit une coordonnée pour tirer sur un adversaire
     * @param game Le jeu actuel
     * @param aiPlayer Le joueur IA qui doit tirer
     * @return La coordonnée choisie, ou null si aucun adversaire disponible
     */
    public Coordinate chooseTarget(Game game, Player aiPlayer) {
        List<Player> opponents = game.getOpponents(aiPlayer);
        if (opponents.isEmpty()) {
            return null;
        }

        Player target = opponents.get(random.nextInt(opponents.size()));
        int gridSize = game.getGridSize();

        int attempts = 0;
        int maxAttempts = gridSize * gridSize;
        
        while (attempts < maxAttempts) {
            int x = random.nextInt(gridSize);
            int y = random.nextInt(gridSize);
            Coordinate coordinate = new Coordinate(x, y);
            
            CellStatus status = target.getGrid().getCell(coordinate);
            if (status == CellStatus.EMPTY || status == CellStatus.SHIP) {
                return coordinate;
            }
            
            attempts++;
        }

        
        return null;
    }

    /**
     * Place automatiquement la flotte du joueur IA
     * @param game Le jeu actuel
     * @param aiPlayer Le joueur IA qui doit placer sa flotte
     */
    public void placeFleet(Game game, Player aiPlayer) {
        // TODO: Implémenter le placement automatique des navires
    }
}

