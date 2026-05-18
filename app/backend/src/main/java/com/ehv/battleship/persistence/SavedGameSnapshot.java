package com.ehv.battleship.persistence;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;

/**
 * Instantané complet d'une partie (modèle + état de session du contrôleur) pour
 * rechargement fidèle. Format versionné (extension {@code .save}, JSON Gson).
 */
public final class SavedGameSnapshot {

    public static final int FORMAT_VERSION = 1;

    private int formatVersion;
    private Game game;
    private List<Integer> fleetSizes;
    private int humanSlots;
    private Map<String, Boolean> placementLockedByPlayer;
    private Map<String, Set<String>> placedShipTypesByPlayer;
    private Map<String, Integer> lockedTargetByPlayer;
    private List<Integer> placementCompletionOrder;
    private Integer cachedWinner;

    /** Pour Gson. */
    SavedGameSnapshot() {
        this.formatVersion = FORMAT_VERSION;
    }

    public SavedGameSnapshot(
            Game game,
            List<Integer> fleetSizes,
            int humanSlots,
            Map<Integer, Boolean> placementLockedByPlayer,
            Map<Integer, Set<String>> placedShipTypesByPlayer,
            Map<Integer, Integer> lockedTargetByPlayer,
            List<Integer> placementCompletionOrder,
            Integer cachedWinner) {
        this.formatVersion = FORMAT_VERSION;
        this.game = game;
        this.fleetSizes = new ArrayList<>(fleetSizes);
        this.humanSlots = humanSlots;
        this.placementLockedByPlayer = stringKeyBooleanMap(placementLockedByPlayer);
        this.placedShipTypesByPlayer = stringKeySetMap(placedShipTypesByPlayer);
        this.lockedTargetByPlayer = stringKeyIntegerMap(lockedTargetByPlayer);
        this.placementCompletionOrder = placementCompletionOrder == null
            ? List.of()
            : List.copyOf(placementCompletionOrder);
        this.cachedWinner = cachedWinner;
    }

    public static SavedGameSnapshot fromGameOnly(Game game) {
        List<Integer> sizes = new ArrayList<>();
        if (game != null && !game.getPlayers().isEmpty()) {
            List<Integer> required = game.getPlayers().get(0).getFleet().getRequiredSizes();
            if (required != null && !required.isEmpty()) {
                sizes.addAll(required);
            }
        }
        if (sizes.isEmpty()) {
            sizes.addAll(List.of(5, 4, 3, 3, 2));
        }
        int humans = 0;
        if (game != null) {
            for (Player p : game.getPlayers()) {
                if (!p.isAI()) humans++;
            }
        }
        return new SavedGameSnapshot(
            game,
            sizes,
            humans,
            Map.of(),
            Map.of(),
            Map.of(),
            List.of(),
            null);
    }

    public int getFormatVersion() {
        return formatVersion;
    }

    public Game getGame() {
        return game;
    }

    public List<Integer> getFleetSizes() {
        return fleetSizes == null ? List.of() : List.copyOf(fleetSizes);
    }

    public int getHumanSlots() {
        return humanSlots;
    }

    public Map<Integer, Boolean> placementLockedByPlayerAsIntMap() {
        return intKeyBooleanMap(placementLockedByPlayer);
    }

    public Map<Integer, Set<String>> placedShipTypesByPlayerAsIntMap() {
        return intKeySetMap(placedShipTypesByPlayer);
    }

    public Map<Integer, Integer> lockedTargetByPlayerAsIntMap() {
        return intKeyIntegerMap(lockedTargetByPlayer);
    }

    public List<Integer> getPlacementCompletionOrder() {
        return placementCompletionOrder == null ? List.of() : List.copyOf(placementCompletionOrder);
    }

    public Integer getCachedWinner() {
        return cachedWinner;
    }

    private static Map<String, Boolean> stringKeyBooleanMap(Map<Integer, Boolean> source) {
        Map<String, Boolean> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(String.valueOf(k), v));
        return out;
    }

    private static Map<String, Integer> stringKeyIntegerMap(Map<Integer, Integer> source) {
        Map<String, Integer> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(String.valueOf(k), v));
        return out;
    }

    private static Map<String, Set<String>> stringKeySetMap(Map<Integer, Set<String>> source) {
        Map<String, Set<String>> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(String.valueOf(k), v == null ? Set.of() : Set.copyOf(v)));
        return out;
    }

    private static Map<Integer, Boolean> intKeyBooleanMap(Map<String, Boolean> source) {
        Map<Integer, Boolean> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(Integer.parseInt(k), Boolean.TRUE.equals(v)));
        return out;
    }

    private static Map<Integer, Integer> intKeyIntegerMap(Map<String, Integer> source) {
        Map<Integer, Integer> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(Integer.parseInt(k), v));
        return out;
    }

    private static Map<Integer, Set<String>> intKeySetMap(Map<String, Set<String>> source) {
        Map<Integer, Set<String>> out = new LinkedHashMap<>();
        if (source == null) return out;
        source.forEach((k, v) -> out.put(Integer.parseInt(k), v == null ? new LinkedHashSet<>() : new LinkedHashSet<>(v)));
        return out;
    }
}
