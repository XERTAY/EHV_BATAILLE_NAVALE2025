package com.ehv.battleship.model;

import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class GamePersistenceTest {

    @Test
    void shouldRejectPathTraversalWhenSaving() {
        Game game = new Game(10, java.util.List.of(
            new Player("P1", 10, java.util.List.of(2)),
            new Player("P2", 10, java.util.List.of(2))));
        assertThrows(IllegalArgumentException.class, () -> GamePersistence.save(game, "../../evil"));
    }

    @Test
    void shouldRejectPathTraversalWhenLoading() {
        assertThrows(IllegalArgumentException.class, () -> GamePersistence.load("../outside"));
    }
}
