package com.ehv.battleship.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.ehv.battleship.legacy.controller.GameController;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;

class SavedGameSnapshotRoundTripTest {

    @Test
    void shouldRoundTripSnapshotThroughJson() {
        Game game = GameController.createNewGame(10, List.of(5, 4, 3, 3, 2), 2);
        game.setState(GameState.PLAYING);
        Map<Integer, Boolean> locks = new LinkedHashMap<>(Map.of(1, true, 2, true));
        Map<Integer, Set<String>> placed = new LinkedHashMap<>();
        placed.put(1, new LinkedHashSet<>(Set.of("SHIP_0")));
        Map<Integer, Integer> targets = new LinkedHashMap<>(Map.of(1, 2));
        SavedGameSnapshot original = new SavedGameSnapshot(
            game,
            List.of(5, 4, 3, 3, 2),
            2,
            locks,
            placed,
            targets,
            List.of(1, 2),
            1);

        String json = GamePersistence.toJson(original);
        SavedGameSnapshot restored = GamePersistence.fromJson(json);

        assertEquals(SavedGameSnapshot.FORMAT_VERSION, restored.getFormatVersion());
        assertEquals(GameState.PLAYING, restored.getGame().getState());
        assertEquals(2, restored.getHumanSlots());
        assertTrue(restored.placementLockedByPlayerAsIntMap().get(1));
        assertEquals(2, restored.lockedTargetByPlayerAsIntMap().get(1));
        assertEquals(List.of(1, 2), restored.getPlacementCompletionOrder());
        assertEquals(1, restored.getCachedWinner());
    }

    @Test
    void shouldRestoreSessionStateWhenOpeningFromSaveFile() throws Exception {
        Game game = GameController.createNewGame(8, List.of(3, 2), 2);
        game.setState(GameState.PLACEMENT);
        for (Player player : game.getPlayers()) {
            player.setReady(true);
        }
        SavedGameSnapshot snapshot = new SavedGameSnapshot(
            game,
            List.of(3, 2),
            2,
            Map.of(1, true, 2, false),
            Map.of(1, Set.of("SHIP_0")),
            Map.of(),
            List.of(1),
            null);

        String fileName = "roundtrip-test";
        GamePersistence.saveSnapshot(snapshot, fileName);

        GameController controller = GameController.openFromSaveFile(fileName);
        assertEquals(GameState.PLACEMENT, controller.getGame().getState());
        assertTrue(controller.isPlacementLocked(1));
    }
}
