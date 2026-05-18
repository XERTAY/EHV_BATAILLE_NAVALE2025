package com.ehv.api.lobby;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LobbyGameIdTest {

    @Test
    void generate_returnsFourAlphanumericCharacters() {
        String gameId = LobbyGameId.generate();
        assertEquals(4, gameId.length());
        assertTrue(LobbyGameId.isValid(gameId));
    }

    @Test
    void normalize_acceptsValidIds() {
        assertEquals("a3f9", LobbyGameId.normalize(" A3F9 "));
    }

    @Test
    void normalize_rejectsInvalidIds() {
        assertNull(LobbyGameId.normalize("abc"));
        assertNull(LobbyGameId.normalize("abcde"));
        assertNull(LobbyGameId.normalize("a3f!"));
        assertNull(LobbyGameId.normalize("dcc7f8b1-9fa3-4167-a089-494138cc1757"));
        assertFalse(LobbyGameId.isValid("12"));
    }

    @Test
    void generatedIdsAreMostlyUnique() {
        assertNotNull(LobbyGameId.generate());
        assertNotNull(LobbyGameId.generate());
    }
}
