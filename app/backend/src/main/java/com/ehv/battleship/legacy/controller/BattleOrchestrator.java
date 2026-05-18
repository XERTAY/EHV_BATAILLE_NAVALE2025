package com.ehv.battleship.legacy.controller;

import java.util.ArrayList;
import java.util.List;

import com.ehv.battleship.legacy.controller.GameController.AiStepOutcome;
import com.ehv.battleship.legacy.controller.GameController.ShotOutcome;
import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.ShotResult;

/**
 * Logique de bataille : résolution des tirs humains, tirs IA pas-à-pas, verrouillage de cible (4J),
 * fin de partie. Toute la phase PLAYING transite ici.
 */
final class BattleOrchestrator {

    private final SessionState state;

    BattleOrchestrator(SessionState state) {
        this.state = state;
    }

    ShotOutcome fireAt(int shooter, int x, int y, Integer requestedTarget) {
        ensurePhase(GameState.PLAYING, "Le tir est disponible uniquement pendant la phase BATTLE");
        validatePlayerNumber(shooter);
        if (!state.isHumanSlot(shooter)) {
            throw new IllegalArgumentException(
                "Les tirs IA passent par advanceAiSingleStep, pas par cet endpoint.");
        }
        if (shooter != state.game.getCurrentPlayerNumber()) {
            throw new IllegalArgumentException("Ce n'est pas le tour de ce joueur");
        }
        validateCoordinateBounds(x, y);
        int target = resolveTargetForShooter(shooter, requestedTarget, false);
        ShotResult result = executeShot(shooter, target, new Coordinate(x, y));
        return new ShotOutcome(shooter, target, x, y, result);
    }

    AiStepOutcome advanceAiSingleStep() {
        if (state.game.getState() == GameState.FINISHED || state.game.isFinished()) return null;
        int current = state.game.getCurrentPlayerNumber();
        if (state.isHumanSlot(current)) return null;
        if (state.game.getState() != GameState.PLAYING) return null;
        Player currentPlayer = state.playerByNumber(current);
        if (currentPlayer.hasLost()) {
            state.game.switchTurn();
            return new AiStepOutcome(null, current);
        }
        return performAiBattleShot(current);
    }

    Integer currentTargetPlayer() {
        if (state.game.getState() != GameState.PLAYING) return null;
        if (state.playerCount() <= 2) return null;
        int shooter = state.game.getCurrentPlayerNumber();
        Integer locked = state.lockedTargetByPlayer.get(shooter);
        if (locked == null) return null;
        if (state.playerByNumber(locked).hasLost()) {
            state.lockedTargetByPlayer.put(shooter, null);
            return null;
        }
        return locked;
    }

    private AiStepOutcome performAiBattleShot(int shooter) {
        AI ai = (AI) state.playerByNumber(shooter);
        int target = resolveTargetForShooter(shooter, null, true);
        Coordinate coordinate = ai.chooseTargetForDefender(target);
        ShotResult result = executeShot(shooter, target, coordinate);
        ai.handleShotResult(target, coordinate, result);
        return new AiStepOutcome(
            new ShotOutcome(shooter, target, coordinate.getX(), coordinate.getY(), result),
            shooter);
    }

    private ShotResult executeShot(int shooter, int target, Coordinate coordinate) {
        Player shooterPlayer = state.playerByNumber(shooter);
        Player targetPlayer = state.playerByNumber(target);
        ShotResult result = state.game.shoot(shooterPlayer, targetPlayer, coordinate);
        updateAfterShot(shooter, target, result);
        return result;
    }

    private void updateAfterShot(int shooter, int target, ShotResult result) {
        if (state.game.isFinished()) {
            state.game.setState(GameState.FINISHED);
            Player winner = state.game.getWinner();
            state.cachedWinner = winner == null ? null : (state.game.getPlayers().indexOf(winner) + 1);
            state.lockedTargetByPlayer.put(shooter, null);
            return;
        }
        if (result == ShotResult.MISS) {
            state.lockedTargetByPlayer.put(shooter, null);
            state.game.switchTurn();
            state.lockedTargetByPlayer.put(state.game.getCurrentPlayerNumber(), null);
            return;
        }
        Integer locked = state.lockedTargetByPlayer.get(shooter);
        if (locked != null && state.playerByNumber(locked).hasLost()) {
            state.lockedTargetByPlayer.put(shooter, null);
        }
        if (state.playerCount() > 2 && !state.playerByNumber(target).hasLost()) {
            state.lockedTargetByPlayer.put(shooter, target);
        }
    }

    int resolveTargetForShooter(int shooter, Integer requestedTarget, boolean allowRandom) {
        int playerCount = state.playerCount();
        Integer locked = state.lockedTargetByPlayer.get(shooter);

        if (playerCount == 2) {
            int duelOpponent = shooter == 1 ? 2 : 1;
            if (requestedTarget == null) return duelOpponent;
            validatePlayerNumber(requestedTarget);
            if (requestedTarget == shooter) {
                throw new IllegalArgumentException("Impossible de se tirer dessus");
            }
            if (requestedTarget != duelOpponent) {
                throw new IllegalArgumentException("Cible invalide pour le duel à 2 joueurs");
            }
            return requestedTarget;
        }

        if (requestedTarget == null) {
            if (locked != null) {
                if (state.playerByNumber(locked).hasLost()) {
                    state.lockedTargetByPlayer.put(shooter, null);
                } else {
                    return locked;
                }
            }
            if (!allowRandom) {
                throw new IllegalArgumentException("La cible (targetPlayer) est requise pour cette partie");
            }
            int randomTarget = pickRandomAliveOpponent(shooter);
            state.lockedTargetByPlayer.put(shooter, randomTarget);
            return randomTarget;
        }
        validatePlayerNumber(requestedTarget);
        if (requestedTarget == shooter) {
            throw new IllegalArgumentException("Impossible de se tirer dessus");
        }
        if (state.playerByNumber(requestedTarget).hasLost()) {
            throw new IllegalArgumentException("Ce joueur est éliminé");
        }
        if (locked != null) {
            if (state.playerByNumber(locked).hasLost()) {
                state.lockedTargetByPlayer.put(shooter, null);
            } else if (!locked.equals(requestedTarget)) {
                throw new IllegalArgumentException(
                    "Cible verrouillée : continuez de tirer sur le même joueur tant que vous touchez.");
            }
        }
        state.lockedTargetByPlayer.put(shooter, requestedTarget);
        return requestedTarget;
    }

    private int pickRandomAliveOpponent(int shooter) {
        int playerCount = state.playerCount();
        List<Integer> alive = new ArrayList<>();
        for (int p = 1; p <= playerCount; p++) {
            if (p == shooter) continue;
            if (!state.playerByNumber(p).hasLost()) alive.add(p);
        }
        if (alive.isEmpty()) throw new IllegalStateException("Aucun adversaire vivant.");
        return alive.get(state.random.nextInt(alive.size()));
    }

    private void ensurePhase(GameState expected, String message) {
        if (state.game.getState() != expected) {
            throw new IllegalArgumentException(message);
        }
    }

    private void validatePlayerNumber(int playerNumber) {
        int playerCount = state.playerCount();
        if (playerNumber < 1 || playerNumber > playerCount) {
            throw new IllegalArgumentException("Le joueur doit être entre 1 et " + playerCount);
        }
    }

    private void validateCoordinateBounds(int x, int y) {
        int boardSize = state.boardSize();
        if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
            throw new IllegalArgumentException("Coordonnées hors grille");
        }
    }
}
