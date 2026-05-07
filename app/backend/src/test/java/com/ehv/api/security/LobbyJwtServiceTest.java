package com.ehv.api.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LobbyJwtServiceTest {

    @Test
    void shouldRejectWeakSecret() {
        assertThrows(IllegalStateException.class, () -> new LobbyJwtService("short-secret"));
    }

    @Test
    void shouldIssueAndValidateTokenForLobbyAndPlayer() {
        LobbyJwtService service = new LobbyJwtService("0123456789abcdef0123456789abcdef");
        String token = service.issueToken("my-game", 2);
        assertNotNull(token);
        assertTrue(service.isValidForLobby(token, "my-game", 2));
        assertFalse(service.isValidForLobby(token, "other-game", 2));
        assertFalse(service.isValidForLobby(token, "my-game", 1));
    }
}
