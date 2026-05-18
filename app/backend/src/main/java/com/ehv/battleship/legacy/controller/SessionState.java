package com.ehv.battleship.legacy.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;

/**
 * État de session partagé entre {@link GameController} et ses orchestrateurs
 * ({@link PlacementOrchestrator}, {@link BattleOrchestrator}).
 *
 * <p>POJO mutable à visibilité paquet : seule la couche {@code legacy.controller} y accède.
 * Aucune règle métier n'y vit ; il s'agit uniquement d'un porteur de données.
 */
final class SessionState {

    Game game;
    List<Integer> fleetSizes;
    LinkedHashMap<String, Integer> fleetByType;
    int humanSlots;
    Integer cachedWinner;

    final Map<Integer, Boolean> placementLockedByPlayer = new LinkedHashMap<>();
    final Map<Integer, Set<String>> placedShipTypesByPlayer = new LinkedHashMap<>();
    final Map<Integer, Integer> lockedTargetByPlayer = new LinkedHashMap<>();
    final List<Integer> placementCompletionOrder = new ArrayList<>();
    final Random random = new Random();

    SessionState(Game game, List<Integer> fleetSizes) {
        this.game = game;
        this.fleetSizes = new ArrayList<>(fleetSizes);
        this.fleetByType = buildFleetMap(this.fleetSizes);
        this.humanSlots = countHumanSlots(game);
        bootstrapForCurrentGame();
    }

    void replaceGame(Game replacement, List<Integer> newFleetSizes, int newHumanSlots) {
        this.game = replacement;
        this.fleetSizes = new ArrayList<>(newFleetSizes);
        this.fleetByType = buildFleetMap(this.fleetSizes);
        this.humanSlots = newHumanSlots;
        this.cachedWinner = null;
        bootstrapForCurrentGame();
    }

    void bootstrapForCurrentGame() {
        // Les parties fraîchement créées démarrent en SETUP : on bascule tout de suite en
        // PLACEMENT pour que les actions web (place/confirm) et le presenter API soient alignés.
        if (game.getState() == GameState.SETUP) {
            game.setState(GameState.PLACEMENT);
        }
        placementLockedByPlayer.clear();
        placedShipTypesByPlayer.clear();
        lockedTargetByPlayer.clear();
        placementCompletionOrder.clear();
        int playerCount = game.getPlayers().size();
        for (int p = 1; p <= playerCount; p++) {
            Player player = game.getPlayers().get(p - 1);
            placementLockedByPlayer.put(p, player.isReady());
            placedShipTypesByPlayer.put(p, collectPlacedShipTypes(player));
            lockedTargetByPlayer.put(p, null);
        }
    }

    int playerCount() {
        return game.getPlayers().size();
    }

    int boardSize() {
        return game.getGridSize();
    }

    Player playerByNumber(int playerNumber) {
        if (playerNumber < 1 || playerNumber > playerCount()) {
            throw new IllegalArgumentException("Numéro de joueur hors plage : " + playerNumber);
        }
        return game.getPlayers().get(playerNumber - 1);
    }

    boolean isHumanSlot(int playerNumber) {
        return playerNumber >= 1 && playerNumber <= humanSlots;
    }

    String normalizeShipType(String shipType) {
        if (shipType == null || shipType.isBlank()) {
            throw new IllegalArgumentException("Le type de navire est requis");
        }
        String normalized = shipType.trim().toUpperCase(Locale.ROOT);
        if (!fleetByType.containsKey(normalized)) {
            throw new IllegalArgumentException("Type de navire inconnu : " + normalized);
        }
        return normalized;
    }

    boolean isFleetCompleteForPlayer(int playerNumber) {
        return placedShipTypesByPlayer.get(playerNumber).size() == fleetByType.size();
    }

    private static LinkedHashMap<String, Integer> buildFleetMap(List<Integer> sizes) {
        LinkedHashMap<String, Integer> map = new LinkedHashMap<>();
        for (int i = 0; i < sizes.size(); i++) {
            map.put("SHIP_" + i, sizes.get(i));
        }
        return map;
    }

    private static int countHumanSlots(Game game) {
        int n = 0;
        for (Player p : game.getPlayers()) if (!p.isAI()) n++;
        return n;
    }

    private static Set<String> collectPlacedShipTypes(Player player) {
        Set<String> set = new LinkedHashSet<>();
        for (Ship ship : player.getFleet().getShips()) {
            if (ship.getName() != null && !ship.getName().isBlank()) {
                set.add(ship.getName().trim().toUpperCase(Locale.ROOT));
            }
        }
        return set;
    }
}
