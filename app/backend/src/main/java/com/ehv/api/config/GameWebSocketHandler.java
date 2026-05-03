package com.ehv.api.config;

import java.util.Map;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {
    private final GameSessionManager sessionManager;
    private final Gson gson = new Gson();

    public GameWebSocketHandler(GameSessionManager sessionManager) {
        this.sessionManager = sessionManager;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        send(session, Map.of(
            "type", "CONNECTED",
            "sessionId", session.getId()
        ));
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        JsonObject msg;
        try {
            msg = JsonParser.parseString(message.getPayload()).getAsJsonObject();
        } catch (IllegalStateException | JsonParseException ex) {
            send(session, Map.of("type", "ERROR", "message", "Invalid JSON payload."));
            return;
        }

        String type = msg.has("type") ? msg.get("type").getAsString() : null;
        if (type == null || type.isBlank()) {
            send(session, Map.of("type", "ERROR", "message", "Missing message type."));
            return;
        }

        switch (type) {
            case "CREATE_GAME" -> handleCreateGame(session, msg);
            case "JOIN_GAME" -> handleJoinGame(session, msg);
            default -> {
                send(session, Map.of(
                    "type", "ERROR",
                    "message", "Unsupported message type: " + type
                ));
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) throws Exception {
        sessionManager.leaveGame(session);
    }

    private void handleCreateGame(WebSocketSession session, JsonObject msg) throws Exception {
        int requested = msg.has("maxPlayers") ? msg.get("maxPlayers").getAsInt() : 4;
        int maxPlayers = Math.min(4, Math.max(2, requested));

        GameSessionManager.GameSession game = sessionManager.createGame(maxPlayers);
        sessionManager.joinGame(game.getGameId(), session);

        send(session, Map.of(
            "type", "GAME_CREATED",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers()
        ));
    }

    private void handleJoinGame(WebSocketSession session, JsonObject msg) throws Exception {
        String gameId = msg.has("gameId") ? msg.get("gameId").getAsString() : null;
        if (gameId == null || gameId.isBlank()) {
            send(session, Map.of("type", "ERROR", "message", "Missing gameId."));
            return;
        }

        GameSessionManager.GameSession game = sessionManager.joinGame(gameId, session);
        if (game == null) {
            send(session, Map.of("type", "ERROR", "message", "Unable to join game."));
            return;
        }

        Map<String, Object> joinedPayload = Map.of(
            "type", "JOINED_GAME",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers()
        );
        send(session, joinedPayload);

        broadcastToGame(game, Map.of(
            "type", "PLAYER_COUNT_UPDATED",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers()
        ));
    }

    private void broadcastToGame(GameSessionManager.GameSession game, Map<String, Object> payload) throws Exception {
        CharSequence serialized = Objects.requireNonNull(gson.toJson(payload));
        for (WebSocketSession playerSession : game.getPlayers()) {
            if (playerSession.isOpen()) {
                playerSession.sendMessage(new TextMessage(serialized));
            }
        }
    }

    private void send(WebSocketSession session, Map<String, Object> payload) throws Exception {
        Objects.requireNonNull(session, "session");
        CharSequence serialized = Objects.requireNonNull(gson.toJson(payload));
        session.sendMessage(new TextMessage(serialized));
    }
}
