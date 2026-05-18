package com.ehv.api.service;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.ehv.api.lobby.LobbyGameId;
import com.ehv.api.session.GameSession;

/**
 * Une instance de jeu HTTP par salon (identifiant court WebSocket). Sans {@code gameId}, une partie locale
 * partagée sert aux modes hors-ligne/hotseat (comportement historique du backend unique).
 *
 * <p>Le registre n'a aucune connaissance des règles : il distribue des {@link GameSession}
 * qui délèguent au contrôleur legacy.
 */
@Component
public final class LobbyGameRegistry {

    private final GameSession sharedLocalGame = new GameSession();
    private final ConcurrentHashMap<String, GameSession> lobbyGames = new ConcurrentHashMap<>();

    public GameSession forLobbyOrLocal(String lobbyGameId) {
        if (lobbyGameId == null || lobbyGameId.isBlank()) {
            return sharedLocalGame;
        }
        return lobbyGames.computeIfAbsent(normalizeLobbyId(lobbyGameId), key -> new GameSession());
    }

    public GameSession getLobbyIfPresent(String lobbyGameId) {
        String normalized = normalizeLobbyId(lobbyGameId);
        if (normalized == null) {
            return null;
        }
        return lobbyGames.get(normalized);
    }

    public void removeLobby(String lobbyGameId) {
        String normalized = normalizeLobbyId(lobbyGameId);
        if (normalized == null) {
            return;
        }
        lobbyGames.remove(normalized);
    }

    public int lobbyCount() {
        return lobbyGames.size();
    }

    private static String normalizeLobbyId(String lobbyGameId) {
        return LobbyGameId.normalize(lobbyGameId);
    }
}
