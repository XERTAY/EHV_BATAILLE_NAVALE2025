package com.ehv.api.config;

import java.util.LinkedHashMap;
import java.util.Map;

import com.google.gson.JsonObject;

/**
 * Helpers de parsing / sérialisation des messages WebSocket de type {@code UPDATE_LOBBY_CONFIG}
 * et {@code LOBBY_CONFIG_UPDATED}. Externalisé du {@link GameWebSocketHandler} pour le
 * maintenir sous la taille recommandée par {@code CONTRIBUTING.md}.
 */
final class LobbyConfigPayloads {

    private LobbyConfigPayloads() {}

    static GameSessionManager.LobbyConfigSnapshot parse(JsonObject msg) {
        int boardSize = msg.has("boardSize") ? msg.get("boardSize").getAsInt() : 10;
        int playerCount = msg.has("playerCount") ? msg.get("playerCount").getAsInt() : 2;
        int humanPlayers = msg.has("humanPlayers") ? msg.get("humanPlayers").getAsInt() : playerCount;
        int aiPlayers = msg.has("aiPlayers")
            ? msg.get("aiPlayers").getAsInt()
            : Math.max(0, playerCount - humanPlayers);
        int fleetShipCount = msg.has("fleetShipCount") ? msg.get("fleetShipCount").getAsInt() : 5;
        int fleetTotalCells = msg.has("fleetTotalCells") ? msg.get("fleetTotalCells").getAsInt() : 17;
        return new GameSessionManager.LobbyConfigSnapshot(
            boardSize, playerCount, humanPlayers, aiPlayers, fleetShipCount, fleetTotalCells
        ).normalized();
    }

    static Map<String, Object> serialize(String gameId, GameSessionManager.LobbyConfigSnapshot snapshot) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "LOBBY_CONFIG_UPDATED");
        payload.put("gameId", gameId);
        payload.put("boardSize", snapshot.boardSize());
        payload.put("playerCount", snapshot.playerCount());
        payload.put("humanPlayers", snapshot.humanPlayers());
        payload.put("aiPlayers", snapshot.aiPlayers());
        payload.put("fleetShipCount", snapshot.fleetShipCount());
        payload.put("fleetTotalCells", snapshot.fleetTotalCells());
        return payload;
    }
}
