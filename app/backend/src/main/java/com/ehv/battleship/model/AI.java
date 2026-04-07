package com.ehv.battleship.model;

import com.ehv.battleship.legacy.controller.GameController;

import java.util.List;
import java.util.Random;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Queue;

import java.util.Set;

public class AI extends Player {

    private final Random random = new Random();

    // Historique des tirs déjà effectués
    private final Set<Coordinate> shotsFired = new HashSet<>();

    // Cibles prioritaires à tester après un touché
    private final Queue<Coordinate> targetQueue = new LinkedList<>();

    // Positions touchées du navire en cours
    private final List<Coordinate> hitPositions = new ArrayList<>();

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
     * Placement automatique de la flotte.
     * Cette version utilise le GameController comme dans ton code précédent.
     */
    public void autoPlaceFleet(GameController controller) {
        int gridSize = controller.getGridSize();
        int shipIndex = 1;

        for (Integer shipSize : getFleet().getRequiredSizes()) {
            boolean placed = false;
            int attempts = 0;

            while (!placed && attempts < 1000) {
                int x = random.nextInt(gridSize);
                int y = random.nextInt(gridSize);

                ShipOrientation orientation =
                        ShipOrientation.values()[random.nextInt(ShipOrientation.values().length)];

                if (controller.canPlaceShip(x, y, shipSize, orientation)) {
                    controller.placeShip(
                            x,
                            y,
                        shipSize,
                            orientation,
                        "AI-" + shipSize + "-" + shipIndex
                    );
                    placed = true;
                }

                attempts++;
            }

            if (!placed) {
                throw new IllegalStateException(
                        "Impossible de placer le navire de taille " + shipSize
                );
            }

            shipIndex++;
        }
    }

    /**
     * API attendue par la console : place la flotte pour le joueur courant du jeu.
     * (Le GameController opère sur game.getCurrentPlayer(), donc la console doit
     * appeler ça quand c'est bien au tour de ce joueur en phase de placement.)
     */
   public void placeFleet(GameController controller) {
    autoPlaceFleet(controller);
}

    /**
     * Choisit la prochaine cible.
     * Priorité aux cases de targetQueue.
     * Sinon tir aléatoire sur une case jamais jouée.
     */
    public Coordinate chooseTarget() {
        int gridSize = getGrid().getSize();

        if (shotsFired.size() >= gridSize * gridSize) {
            throw new IllegalStateException("Aucune cible disponible pour l'IA.");
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
            int x = random.nextInt(gridSize);
            int y = random.nextInt(gridSize);
            target = new Coordinate(x, y);
        } while (shotsFired.contains(target));

        shotsFired.add(target);
        return target;
    }

    /**
     * Met à jour la stratégie de l'IA après le résultat d'un tir.
     */
    public void handleShotResult(Coordinate shot, ShotResult result) {
        if (result == ShotResult.HIT) {
            hitPositions.add(shot);

            clearInvalidQueuedTargets();

            if (hitPositions.size() == 1) {
                addAdjacentTargets(shot);
            } else {
                targetQueue.clear();
                addTargetsInDirection();
            }
        } else if (result == ShotResult.SUNK) {
            hitPositions.clear();
            targetQueue.clear();
        }
        // Si MISS : rien à faire
    }

    /**
     * Ajoute les 4 cases voisines autour d'un premier hit.
     */
    private void addAdjacentTargets(Coordinate c) {
        addTarget(new Coordinate(c.getX() + 1, c.getY()));
        addTarget(new Coordinate(c.getX() - 1, c.getY()));
        addTarget(new Coordinate(c.getX(), c.getY() + 1));
        addTarget(new Coordinate(c.getX(), c.getY() - 1));
    }

    /**
     * Quand on connaît l'orientation du navire, on continue
     * uniquement dans cette direction.
     */
    private void addTargetsInDirection() {
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

            addTarget(left);
            addTarget(right);

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

            addTarget(up);
            addTarget(down);
        }
    }

    /**
     * Détermine si les hits connus indiquent un navire horizontal.
     */
    private boolean isHorizontal() {
        if (hitPositions.size() < 2) {
            return false;
        }

        return hitPositions.get(0).getY() == hitPositions.get(1).getY();
    }

    /**
     * Détermine si les hits connus indiquent un navire vertical.
     */
    private boolean isVertical() {
        if (hitPositions.size() < 2) {
            return false;
        }

        return hitPositions.get(0).getX() == hitPositions.get(1).getX();
    }

    /**
     * Ajoute une cible seulement si elle est valide, dans la grille,
     * pas déjà tirée, et pas déjà dans la file.
     */
    private void addTarget(Coordinate c) {
        int gridSize = getGrid().getSize();

        if (isValidTarget(c, gridSize) && !targetQueue.contains(c)) {
            targetQueue.offer(c);
        }
    }

    /**
     * Vérifie qu'une cible est dans la grille et n'a pas déjà été jouée.
     */
    private boolean isValidTarget(Coordinate c, int gridSize) {
        return c.getX() >= 0
                && c.getX() < gridSize
                && c.getY() >= 0
                && c.getY() < gridSize
                && !shotsFired.contains(c);
    }

    /**
     * Nettoie les cibles devenues inutiles quand l'orientation est connue.
     */
    private void clearInvalidQueuedTargets() {
        int gridSize = getGrid().getSize();
        targetQueue.removeIf(c -> !isValidTarget(c, gridSize));
    }
}