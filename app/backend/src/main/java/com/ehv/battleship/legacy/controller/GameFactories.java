package com.ehv.battleship.legacy.controller;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;

/**
 * Fabriques de parties (méthodes statiques) — autrefois imbriquées dans {@link GameController}.
 * <p>Aucune dépendance d'état : pure construction de modèle.
 */
public final class GameFactories {

    private GameFactories() {}

    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes) {
        return createNewGame(gridSize, fleetShipSizes, 2);
    }

    public static Game createNewGame(int gridSize, List<Integer> fleetShipSizes, int playerCount) {
        validateFleet(gridSize, fleetShipSizes);
        if (playerCount != 2 && playerCount != 4) {
            throw new IllegalArgumentException("Le nombre de joueurs doit être 2 ou 4.");
        }
        List<Player> players = new ArrayList<>();
        for (int i = 1; i <= playerCount; i++) {
            players.add(new Player("Joueur " + i, gridSize, fleetShipSizes));
        }
        return new Game(gridSize, players);
    }

    public static Game createNewGameVsAI(int gridSize, List<Integer> fleetShipSizes) {
        validateFleet(gridSize, fleetShipSizes);
        List<Player> players = Arrays.asList(
            new Player("Joueur 1", gridSize, fleetShipSizes),
            new AI("Ordinateur", gridSize, fleetShipSizes)
        );
        return new Game(gridSize, players);
    }

    public static Game createNewGameWithAI(int gridSize, List<Integer> fleetShipSizes,
                                            int humanCount, int aiCount) {
        validateFleet(gridSize, fleetShipSizes);
        if (humanCount < 1) throw new IllegalArgumentException("Il faut au moins 1 joueur humain.");
        if (aiCount < 1)    throw new IllegalArgumentException("Il faut au moins 1 IA.");
        int totalPlayers = humanCount + aiCount;
        if (totalPlayers != 2 && totalPlayers != 4) {
            throw new IllegalArgumentException("Cette configuration doit contenir 2 ou 4 joueurs au total.");
        }
        List<Player> players = new ArrayList<>();
        for (int i = 1; i <= humanCount; i++) {
            players.add(new Player("Joueur " + i, gridSize, fleetShipSizes));
        }
        for (int i = 1; i <= aiCount; i++) {
            players.add(new AI("Ordinateur " + i, gridSize, fleetShipSizes));
        }
        return new Game(gridSize, players);
    }

    public static boolean isValidFleetConfiguration(int gridSize, List<Integer> shipSizes) {
        int total = 0;
        for (Integer size : shipSizes) if (size != null) total += size;
        return total <= gridSize * gridSize;
    }

    static void validateFleet(int gridSize, List<Integer> sizes) {
        if (!isValidFleetConfiguration(gridSize, sizes)) {
            int total = 0;
            for (Integer s : sizes) if (s != null) total += s;
            int cells = gridSize * gridSize;
            throw new IllegalArgumentException(
                "Le total des cases de navires (" + total + ") dépasse le nombre de cases (" + cells + ").");
        }
    }

    static void validateFleetFitsBoard(int boardSize, List<Integer> sizes) {
        long capacity = (long) boardSize * boardSize;
        long total = 0;
        for (Integer s : sizes) total += Math.max(1, (s == null ? 0 : s));
        if (total > capacity) {
            throw new IllegalArgumentException(
                "Flotte invalide: " + total + " cases pour une grille " + boardSize + "x" + boardSize + ".");
        }
    }
}
