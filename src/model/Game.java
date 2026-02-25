package com.ehv.battleship.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public class Game {

    private static int nextId = 1;
    private final int id;
    private final int gridSize;
    private GameState state;
    private final Random random;

    private final List<Player> players;
    private int currentPlayerIndex;

    public Game(int gridSize, List<Player> players) {
        if (players == null || players.size() < 2) {
            throw new IllegalArgumentException("Il faut au moins 2 joueurs");
        }
        this.id = nextId++;
        this.gridSize = gridSize;
        this.state = GameState.SETUP;
        this.players = new ArrayList<>(players);
        this.currentPlayerIndex = 0;
        this.random = new Random();
    }

    public int getId() {
        return id;
    }

    public int getGridSize() {
        return gridSize;
    }

    public GameState getState() {
        return state;
    }

    public void setState(GameState state) {
        this.state = state;
    }

    public List<Player> getPlayers() {
        return Collections.unmodifiableList(players);
    }

    public Player getCurrentPlayer() {
        return players.get(currentPlayerIndex);
    }

    /**
     * Retourne la liste des adversaires d'un joueur donné
     * @param player Le joueur pour lequel on cherche les adversaires
     * @return La liste des adversaires
     */
    public List<Player> getOpponents(Player player) {
        List<Player> opponents = new ArrayList<>();
        for (Player p : players) {
            if (!p.equals(player)) {
                opponents.add(p);
            }
        }
        return opponents;
    }

    public void start() {
        for (Player player : players) {
            if (!player.getFleet().isComplete()) {
                throw new IllegalStateException("La flotte de " + player.getName() + " n'est pas complète");
            }
        }
        this.state = GameState.PLAYING;
        this.currentPlayerIndex = 0;
    }

    public void switchTurn() {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
    }

    public boolean isFinished() {
        if (state != GameState.PLAYING) {
            return state == GameState.FINISHED;
        }
        // Le jeu est fini si un seul joueur ou moins reste actif
        long activePlayers = players.stream()
            .filter(p -> !p.hasLost())
            .count();
        return activePlayers <= 1;
    }

    public Player getWinner() {
        if (!isFinished()) {
            return null;
        }
        // Retourner le premier joueur qui n'a pas perdu
        return players.stream()
            .filter(p -> !p.hasLost())
            .findFirst()
            .orElse(null);
    }

    public ShotResult shoot(Player attacker, Player defender, Coordinate coordinate) {
        if (attacker == null || defender == null) {
            throw new IllegalArgumentException("Les joueurs ne peuvent pas être nuls");
        }
        if (!coordinate.isValid(gridSize)) {
            throw new IllegalArgumentException("Coordonnée invalide : " + coordinate);
        }

        CellStatus currentStatus = defender.getGrid().getCell(coordinate);

        if (currentStatus == CellStatus.HIT || currentStatus == CellStatus.SUNK) {
            return ShotResult.ALREADY_HIT;
        } else if (currentStatus == CellStatus.MISS) {
            return ShotResult.ALREADY_MISS;
        }

        boolean isHit = random.nextBoolean();
        if (isHit) {
            defender.getGrid().setCell(coordinate, CellStatus.HIT);
            return ShotResult.HIT;
        } else {
            defender.getGrid().setCell(coordinate, CellStatus.MISS);
            return ShotResult.MISS;
        }
    }

    // Place un navire pour un joueur avec validation complète
    public void placeShip(Player player, Ship ship) {
        if (player == null || ship == null) {
            throw new IllegalArgumentException("Le joueur et le navire ne peuvent pas être nuls");
        }
        
        if (!players.contains(player)) {
            throw new IllegalArgumentException("Le joueur n'appartient pas à ce jeu");
        }
        
        // Vérifier placement sur la grille
        if (!player.getGrid().canPlaceShip(
            ship.getCoordinates().get(0), 
            ship.getSize(), 
            ship.getOrientation())) {
            throw new IllegalArgumentException("Le navire ne peut pas être placé à cette position");
        }
        
        // Vérifier chevauchement avec autres navires
        if (!player.getFleet().canAddShip(ship)) {
            throw new IllegalArgumentException("Le navire chevauche un autre navire existant");
        }
        
        // Placer sur la grille et ajouter à la flotte
        player.getGrid().placeShip(ship); // Note: marque les cellules sur la grille
        player.getFleet().addShip(ship); // Note: ajoute à la liste de la flotte
    }
}


