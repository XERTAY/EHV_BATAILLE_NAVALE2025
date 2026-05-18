package com.ehv.battleship.legacy.controller;

import java.util.List;
import java.util.Set;

import com.ehv.battleship.model.CellStatus;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;
import com.ehv.battleship.model.ShipOrientation;

/**
 * Logique de placement (manuel + automatique IA + verrouillage). Opère sur l'état partagé
 * {@link SessionState} : aucune copie locale, donc {@link GameController} et l'orchestrateur
 * voient la même partie.
 */
final class PlacementOrchestrator {

    private static final int MAX_AI_PLACEMENT_ITERATIONS = 3000;
    private final SessionState state;

    PlacementOrchestrator(SessionState state) {
        this.state = state;
    }

    void placeShipForPlayer(int playerNumber, String shipType, int x, int y, String orientation) {
        ensurePlacementPhase("Impossible de placer hors phase PLACEMENT");
        validatePlayerNumber(playerNumber);
        ensurePlacementEditable(playerNumber);
        if (!state.isHumanSlot(playerNumber)) {
            throw new IllegalArgumentException(
                "L'ordinateur gère le placement pour les IA. Action refusée pour ce numéro.");
        }
        String normalizedType = state.normalizeShipType(shipType);
        Set<String> placed = state.placedShipTypesByPlayer.get(playerNumber);
        if (placed.contains(normalizedType)) {
            throw new IllegalArgumentException("Ce navire a déjà été placé");
        }
        if (placed.size() >= state.fleetByType.size()) {
            throw new IllegalArgumentException("Tous les navires de ce joueur sont déjà placés");
        }
        ShipOrientation parsed = GameController.parseOrientation(orientation);
        if (parsed == null) {
            throw new IllegalArgumentException("Orientation invalide");
        }
        validateCoordinateBounds(x, y);
        Player current = state.playerByNumber(playerNumber);
        int shipSize = state.fleetByType.get(normalizedType);
        List<Coordinate> coordinates = current.getGrid()
            .generateShipCoordinates(new Coordinate(x, y), shipSize, parsed);
        validatePlacementCoordinates(current, coordinates);
        Ship ship = new Ship(Ship.generateId(), normalizedType, shipSize, coordinates, parsed);
        state.game.placeShip(current, ship);
        placed.add(normalizedType);
        state.game.setCurrentPlayerByNumber(playerNumber);
    }

    void removeShipForPlayer(int playerNumber, String shipType, Integer x, Integer y) {
        ensurePlacementPhase("La suppression est disponible uniquement pendant la phase PLACEMENT");
        validatePlayerNumber(playerNumber);
        ensurePlacementEditable(playerNumber);
        String resolved = resolveShipTypeToRemove(playerNumber, shipType, x, y);
        Player current = state.playerByNumber(playerNumber);
        Ship found = null;
        for (Ship ship : current.getFleet().getShips()) {
            if (resolved.equalsIgnoreCase(ship.getName())) { found = ship; break; }
        }
        if (found == null) {
            throw new IllegalArgumentException("Ce navire n'est pas placé.");
        }
        for (Coordinate c : found.getCoordinates()) {
            current.getGrid().setCell(c, CellStatus.EMPTY);
        }
        current.getFleet().removeShip(found);
        state.placedShipTypesByPlayer.get(playerNumber).remove(resolved);
        current.setReady(false);
        state.game.setCurrentPlayerByNumber(playerNumber);
    }

    void confirmPlacementForPlayer(int playerNumber) {
        ensurePlacementPhase("La validation est disponible uniquement pendant la phase PLACEMENT");
        validatePlayerNumber(playerNumber);
        if (!state.isHumanSlot(playerNumber)) {
            throw new IllegalArgumentException("La validation manuelle n'est disponible que pour les joueurs humains.");
        }
        confirmPlacementInternal(playerNumber);
    }

    void confirmPlacementInternal(int playerNumber) {
        ensurePlacementEditable(playerNumber);
        if (!state.isFleetCompleteForPlayer(playerNumber)) {
            throw new IllegalArgumentException("Impossible de valider: tous les navires ne sont pas placés.");
        }
        state.placementLockedByPlayer.put(playerNumber, true);
        state.playerByNumber(playerNumber).setReady(true);
        updatePlacementProgress(playerNumber);
    }

    void autoPlaceFleetForAllPlayers() {
        ensurePlacementPhase("Le placement automatique est disponible uniquement pendant la phase PLACEMENT");
        int playerCount = state.playerCount();
        for (int p = 1; p <= playerCount; p++) {
            for (String shipType : state.fleetByType.keySet()) {
                if (!state.placedShipTypesByPlayer.get(p).contains(shipType)) {
                    placeShipRandomly(p, shipType);
                }
            }
            state.placementLockedByPlayer.put(p, true);
            state.playerByNumber(p).setReady(true);
            if (!state.placementCompletionOrder.contains(p)) {
                state.placementCompletionOrder.add(p);
            }
        }
        state.game.setState(GameState.PLAYING);
        state.game.setCurrentPlayerByNumber(1);
    }

    void placeShipRandomly(int playerNumber, String shipType) {
        Player current = state.playerByNumber(playerNumber);
        int shipSize = state.fleetByType.get(shipType);
        int boardSize = state.boardSize();
        int tries = 0;
        while (tries++ < MAX_AI_PLACEMENT_ITERATIONS) {
            ShipOrientation orientation = randomOrientation();
            int x = state.random.nextInt(boardSize);
            int y = state.random.nextInt(boardSize);
            try {
                List<Coordinate> coordinates = current.getGrid()
                    .generateShipCoordinates(new Coordinate(x, y), shipSize, orientation);
                validatePlacementCoordinates(current, coordinates);
                Ship ship = new Ship(Ship.generateId(), shipType, shipSize, coordinates, orientation);
                current.getGrid().placeShip(ship);
                current.getFleet().addShip(ship);
                state.placedShipTypesByPlayer.get(playerNumber).add(shipType);
                return;
            } catch (IllegalArgumentException ignored) {
                // retry
            }
        }
        throw new IllegalStateException("Impossible de placer aléatoirement le navire " + shipType);
    }

    String nextMissingShipType(int playerNumber) {
        Set<String> placed = state.placedShipTypesByPlayer.get(playerNumber);
        for (String type : state.fleetByType.keySet()) {
            if (!placed.contains(type)) return type;
        }
        return null;
    }

    /**
     * Prochain joueur qui n'a pas encore validé son placement (verrouillage).
     * On ne se base pas sur {@code isFleetCompleteForPlayer} : un humain peut avoir
     * posé tous ses navires sans avoir appuyé sur « valider », et une IA doit toujours
     * être traitée tant qu'elle n'est pas verrouillée.
     */
    int nextPlayerAwaitingPlacement(int from) {
        int playerCount = state.playerCount();
        int next = from;
        for (int i = 0; i < playerCount; i++) {
            next = (next % playerCount) + 1;
            if (!Boolean.TRUE.equals(state.placementLockedByPlayer.get(next))) {
                return next;
            }
        }
        return from;
    }

    private void updatePlacementProgress(int playerNumber) {
        if (state.game.getState() != GameState.PLACEMENT) return;
        if (state.isFleetCompleteForPlayer(playerNumber) && !state.placementCompletionOrder.contains(playerNumber)) {
            state.placementCompletionOrder.add(playerNumber);
        }
        int playerCount = state.playerCount();
        boolean allDone = true;
        for (int p = 1; p <= playerCount; p++) {
            if (!Boolean.TRUE.equals(state.placementLockedByPlayer.get(p))) { allDone = false; break; }
        }
        if (!allDone) {
            state.game.setCurrentPlayerByNumber(nextPlayerAwaitingPlacement(playerNumber));
            return;
        }
        state.game.setState(GameState.PLAYING);
        state.game.setCurrentPlayerByNumber(1);
    }

    private String resolveShipTypeToRemove(int playerNumber, String shipType, Integer x, Integer y) {
        if (shipType != null && !shipType.isBlank()) {
            String normalized = state.normalizeShipType(shipType);
            if (!state.placedShipTypesByPlayer.get(playerNumber).contains(normalized)) {
                throw new IllegalArgumentException("Ce navire n'est pas placé.");
            }
            return normalized;
        }
        if (x == null || y == null) {
            throw new IllegalArgumentException("Pour retirer un navire, indiquez shipType ou bien x/y.");
        }
        validateCoordinateBounds(x, y);
        Coordinate target = new Coordinate(x, y);
        for (Ship ship : state.playerByNumber(playerNumber).getFleet().getShips()) {
            if (ship.getCoordinates().contains(target)) {
                return state.normalizeShipType(ship.getName());
            }
        }
        throw new IllegalArgumentException("Aucun navire trouvé sur cette case.");
    }

    private void validatePlacementCoordinates(Player player, List<Coordinate> coordinates) {
        int boardSize = state.boardSize();
        for (Coordinate c : coordinates) {
            if (!c.isValid(boardSize)) {
                throw new IllegalArgumentException("Coordonnées hors grille");
            }
            if (player.getGrid().getCell(c) == CellStatus.SHIP) {
                throw new IllegalArgumentException("Le navire chevauche un navire déjà placé");
            }
        }
        Ship temp = new Ship(0, "temp", coordinates.size(), coordinates, ShipOrientation.HORIZONTAL);
        if (!player.getFleet().canAddShip(temp)) {
            throw new IllegalArgumentException("Le navire chevauche un autre navire ou dépasse la flotte attendue.");
        }
    }

    /**
     * Accepte {@link GameState#SETUP} (partie fraîche) et le promeut en {@link GameState#PLACEMENT}.
     */
    private void ensurePlacementPhase(String message) {
        GameState current = state.game.getState();
        if (current == GameState.PLACEMENT) {
            return;
        }
        if (current == GameState.SETUP) {
            state.game.setState(GameState.PLACEMENT);
            return;
        }
        throw new IllegalArgumentException(message);
    }

    private void ensurePlacementEditable(int playerNumber) {
        if (Boolean.TRUE.equals(state.placementLockedByPlayer.get(playerNumber))) {
            throw new IllegalArgumentException(
                "Placement déjà validé pour ce joueur, action irréversible.");
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

    private ShipOrientation randomOrientation() {
        ShipOrientation[] values = ShipOrientation.values();
        return values[state.random.nextInt(values.length)];
    }
}
