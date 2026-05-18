package com.ehv.battleship.persistence;

import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;

class GamePersistenceTest {

    @Test
    void shouldRejectPathTraversalWhenSaving() {
        Game game = new Game(10, List.of(
            new Player("P1", 10, List.of(2)),
            new Player("P2", 10, List.of(2))));
        assertThrows(IllegalArgumentException.class, () -> GamePersistence.save(game, "../../evil"));
    }

    @Test
    void shouldRejectPathTraversalWhenLoading() {
        assertThrows(IllegalArgumentException.class, () -> GamePersistence.load("../outside"));
    }
}
