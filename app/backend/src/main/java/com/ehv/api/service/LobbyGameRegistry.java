package com.ehv.api.service;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Une instance de jeu HTTP par salon (UUID WebSocket). Sans {@code gameId}, une partie locale
 * partagée sert aux modes hors-ligne/hotseat (comportement historique du backend unique).
 */
@Component
public final class LobbyGameRegistry {

    private final DuelGameService sharedLocalGame = new DuelGameService();
    private final ConcurrentHashMap<String, DuelGameService> lobbyGames = new ConcurrentHashMap<>();

    public DuelGameService forLobbyOrLocal(String lobbyGameId) {
        if (lobbyGameId == null || lobbyGameId.isBlank()) {
            return sharedLocalGame;
        }
        return lobbyGames.computeIfAbsent(lobbyGameId.strip(), key -> new DuelGameService());
    }
}
