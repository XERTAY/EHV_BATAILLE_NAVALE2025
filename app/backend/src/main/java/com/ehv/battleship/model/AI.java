package com.ehv.battleship.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Joueur IA : placement aléatoire sur sa grille (sans dépendance contrôleur) et tir avec mémoire
 * séparée par adversaire pour le multi-joueurs (étoile / plusieurs grilles).
 */
public class AI extends Player {

    private static final long serialVersionUID = 2L;

    /** Gson ne persiste pas ce champ ; reçu après désérialisation si besoin. */
    private transient Random random;

    private Random rnd() {
        if (random == null) {
            random = new Random();
        }
        return random;
    }
    /** Mémoire de tir par numéro de joueur adverse (1-based). */
    private final Map<Integer, OpponentState> opponentBrains = new HashMap<>();

    public AI(String name, int gridSize) {
        super(name, gridSize);
    }

    public AI(String name, int gridSize, List<Integer> shipSizes) {
        super(name, gridSize, shipSizes);
    }

    @Override
    public boolean isAI() {
        return true;
    }

    /**
     * Pose toute la flotte requise avec des types SHIP_0 … SHIP_n (cohérence API web).
     */
    public void placeFleetStandardTypes() {
        List<Integer> requiredSizes = getFleet().getRequiredSizes();
        int gridSize = getGrid().getSize();
        for (int index = 0; index < requiredSizes.size(); index++) {
            String shipType = "SHIP_" + index;
            placeOneShipRandomly(shipType, requiredSizes.get(index), gridSize);
        }
    }

    /**
     * Prochain tir contre un adversaire donné (1-based index), après que la console a déjà choisi la cible.
     */
    public Coordinate chooseTargetForDefender(int defenderNumber) {
        int gridSize = getGrid().getSize();
        OpponentState memory = opponentState(defenderNumber);
        return memory.nextCoordinate(gridSize, rnd());
    }

    /**
     * Choisit un adversaire vivant puis une coordonnée sur sa grille ; une poursuite active sur une grille
     * (touchés non résolus) prévaut, sinon adversaire tiré au hasard.
     */
    public ShootDecision chooseShootingTarget(Game game, int selfNumber) {
        if (selfNumber < 1 || selfNumber > game.getPlayers().size()) {
            throw new IllegalArgumentException("selfNumber invalide: " + selfNumber);
        }
        List<Integer> aliveOpponents = aliveOpponentNumbers(game, selfNumber);
        if (aliveOpponents.isEmpty()) {
            throw new IllegalStateException("Aucune cible vivante pour l'IA.");
        }

        List<Integer> withHunt = aliveOpponents.stream()
            .filter((d) -> opponentState(d).hasActiveHunt())
            .collect(Collectors.toList());

        List<Integer> pool = withHunt.isEmpty() ? aliveOpponents : withHunt;
        int defenderNumber = pool.get(rnd().nextInt(pool.size()));

        int gridSize = getGrid().getSize();
        OpponentState memory = opponentState(defenderNumber);
        Coordinate coordinate = memory.nextCoordinate(gridSize, rnd());
        return new ShootDecision(defenderNumber, coordinate);
    }

    public void handleShotResult(int defenderNumber, Coordinate shot, ShotResult result) {
        opponentState(defenderNumber).onShotResult(shot, result, getGrid().getSize());
    }

    private OpponentState opponentState(int defenderNumber) {
        return opponentBrains.computeIfAbsent(defenderNumber, (key) -> new OpponentState());
    }

    private List<Integer> aliveOpponentNumbers(Game game, int selfNumber) {
        Player self = game.getPlayers().get(selfNumber - 1);
        List<Integer> opponents = new ArrayList<>();
        for (Player opponent : game.getOpponents(self)) {
            if (opponent.hasLost()) {
                continue;
            }
            int indexPlusOne = game.getPlayers().indexOf(opponent) + 1;
            if (indexPlusOne >= 1) {
                opponents.add(indexPlusOne);
            }
        }
        return opponents;
    }

    private void placeOneShipRandomly(String shipType, int shipSize, int gridSize) {
        for (int attempt = 0; attempt < 10000; attempt++) {
            ShipOrientation orientation =
                ShipOrientation.values()[rnd().nextInt(ShipOrientation.values().length)];
            int x = rnd().nextInt(gridSize);
            int y = rnd().nextInt(gridSize);
            try {
                List<Coordinate> coordinates = getGrid().generateShipCoordinates(new Coordinate(x, y), shipSize, orientation);
                validateShipCellsEmpty(gridSize, coordinates);
                Ship ship = new Ship(Ship.generateId(), shipType, shipSize, coordinates, orientation);
                getGrid().placeShip(ship);
                getFleet().addShip(ship);
                return;
            } catch (IllegalArgumentException ignored) {
                // nouvel essai
            }
        }
        throw new IllegalStateException(
            "Impossible de placer le navire " + shipType + " apres plusieurs tentatives");
    }

    private void validateShipCellsEmpty(int gridSize, List<Coordinate> coordinates) {
        for (Coordinate coordinate : coordinates) {
            if (!coordinate.isValid(gridSize)) {
                throw new IllegalArgumentException("hors grille");
            }
            if (getGrid().getCell(coordinate) == CellStatus.SHIP) {
                throw new IllegalArgumentException("chevauchement");
            }
        }
    }

    private static final class OpponentState implements Serializable {

        private static final long serialVersionUID = 1L;

        private final Set<Coordinate> shotsFired = new HashSet<>();
        private final Queue<Coordinate> targetQueue = new LinkedList<>();
        private final List<Coordinate> hitPositions = new ArrayList<>();

        boolean hasActiveHunt() {
            return !hitPositions.isEmpty();
        }

        Coordinate nextCoordinate(int gridSize, Random randomSource) {
            if (shotsFired.size() >= gridSize * gridSize) {
                throw new IllegalStateException("Aucune case libre pour ce plateau adverse.");
            }

            while (!targetQueue.isEmpty()) {
                Coordinate target = targetQueue.poll();
                if (isValidTarget(target, gridSize)) {
                    shotsFired.add(target);
                    return target;
                }
            }

            Coordinate target;
            do {
                int x = randomSource.nextInt(gridSize);
                int y = randomSource.nextInt(gridSize);
                target = new Coordinate(x, y);
            } while (shotsFired.contains(target));

            shotsFired.add(target);
            return target;
        }

        void onShotResult(Coordinate shot, ShotResult result, int gridSize) {
            if (result == ShotResult.HIT) {
                hitPositions.add(shot);
                clearInvalidQueuedTargets(gridSize);
                if (hitPositions.size() == 1) {
                    addAdjacentTargets(shot, gridSize);
                } else {
                    targetQueue.clear();
                    addTargetsInDirection(gridSize);
                }
            } else if (result == ShotResult.SUNK) {
                hitPositions.clear();
                targetQueue.clear();
            }
        }

        private void addAdjacentTargets(Coordinate c, int gridSize) {
            addTarget(new Coordinate(c.getX() + 1, c.getY()), gridSize);
            addTarget(new Coordinate(c.getX() - 1, c.getY()), gridSize);
            addTarget(new Coordinate(c.getX(), c.getY() + 1), gridSize);
            addTarget(new Coordinate(c.getX(), c.getY() - 1), gridSize);
        }

        private void addTargetsInDirection(int gridSize) {
            if (isHorizontal()) {
                hitPositions.sort(Comparator.comparingInt(Coordinate::getX));

                Coordinate left = new Coordinate(
                    hitPositions.get(0).getX() - 1,
                    hitPositions.get(0).getY()
                );

                Coordinate right = new Coordinate(
                    hitPositions.get(hitPositions.size() - 1).getX() + 1,
                    hitPositions.get(0).getY()
                );

                addTarget(left, gridSize);
                addTarget(right, gridSize);

            } else if (isVertical()) {
                hitPositions.sort(Comparator.comparingInt(Coordinate::getY));

                Coordinate up = new Coordinate(
                    hitPositions.get(0).getX(),
                    hitPositions.get(0).getY() - 1
                );

                Coordinate down = new Coordinate(
                    hitPositions.get(0).getX(),
                    hitPositions.get(hitPositions.size() - 1).getY() + 1
                );

                addTarget(up, gridSize);
                addTarget(down, gridSize);
            }
        }

        private boolean isHorizontal() {
            if (hitPositions.size() < 2) {
                return false;
            }

            return hitPositions.get(0).getY() == hitPositions.get(1).getY();
        }

        private boolean isVertical() {
            if (hitPositions.size() < 2) {
                return false;
            }

            return hitPositions.get(0).getX() == hitPositions.get(1).getX();
        }

        private void addTarget(Coordinate c, int gridSize) {
            if (isValidTarget(c, gridSize) && !targetQueue.contains(c)) {
                targetQueue.offer(c);
            }
        }

        private boolean isValidTarget(Coordinate c, int gridSize) {
            return c.getX() >= 0
                && c.getX() < gridSize
                && c.getY() >= 0
                && c.getY() < gridSize
                && !shotsFired.contains(c);
        }

        private void clearInvalidQueuedTargets(int gridSize) {
            targetQueue.removeIf((c) -> !isValidTarget(c, gridSize));
        }
    }
}
