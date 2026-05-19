package com.ehv.api.config;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

import com.ehv.api.lobby.LobbyGameId;
import com.ehv.api.security.LobbyJwtService;
import com.ehv.api.service.LobbyGameRegistry;
import com.ehv.api.session.GameSession;
import com.ehv.api.view.DuelPhase;
import com.ehv.api.view.GameStateResponse;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {
    private static final Logger LOG = LoggerFactory.getLogger(GameWebSocketHandler.class);
    private final GameSessionManager sessionManager;
    private final LobbyGameRegistry lobbyGameRegistry;
    private final LobbyJwtService lobbyJwtService;
    private final Gson gson = new Gson();

    public GameWebSocketHandler(
            GameSessionManager sessionManager,
            LobbyGameRegistry lobbyGameRegistry,
            LobbyJwtService lobbyJwtService) {
        this.sessionManager = sessionManager;
        this.lobbyGameRegistry = lobbyGameRegistry;
        this.lobbyJwtService = lobbyJwtService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        LOG.info("WS_CONNECTED sessionId={} remote={}", session.getId(), session.getRemoteAddress());
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
        LOG.info("WS_MESSAGE sessionId={} type={}", session.getId(), type);

        switch (type) {
            case "CREATE_GAME" -> handleCreateGame(session, msg);
            case "JOIN_GAME" -> handleJoinGame(session, msg);
            case "START_GAME" -> handleStartGame(session, msg);
            case "HEARTBEAT" -> handleHeartbeat(session, msg);
            case "UPDATE_LOBBY_CONFIG" -> handleUpdateLobbyConfig(session, msg);
            case "LEAVE_GAME" -> handleLeaveGame(session, msg);
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
        LOG.info("WS_CLOSED sessionId={} code={} reason={}", session.getId(), status.getCode(), status.getReason());
        sessionManager.leaveGame(session);
    }

    private void handleCreateGame(WebSocketSession session, JsonObject msg) throws Exception {
        int requested = msg.has("maxPlayers") ? msg.get("maxPlayers").getAsInt() : 4;
        int maxPlayers = Math.min(4, Math.max(2, requested));

        GameSessionManager.GameSession game = sessionManager.createGame(maxPlayers, session);
        int playerNumber = 1;
        LOG.info("LOBBY_CREATED gameId={} hostSessionId={} maxPlayers={}", game.getGameId(), session.getId(), maxPlayers);
        send(session, Map.of(
            "type", "GAME_CREATED",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers(),
            "playerNumber", playerNumber,
            "resumeToken", lobbyJwtService.issueToken(game.getGameId(), playerNumber)
        ));
        sendLobbyConfigSnapshot(session, game.getGameId());
    }

    private void handleJoinGame(WebSocketSession session, JsonObject msg) throws Exception {
        String gameId = msg.has("gameId") ? msg.get("gameId").getAsString() : null;
        if (gameId == null || gameId.isBlank()) {
            send(session, Map.of("type", "ERROR", "message", "Missing gameId."));
            return;
        }

        String normalizedGameId = LobbyGameId.normalize(gameId);
        if (normalizedGameId == null) {
            send(session, Map.of(
                "type", "ERROR",
                "message", "Invalid gameId. Expected 4 letters or digits (example: a3f9)."));
            return;
        }
        LOG.info("LOBBY_JOIN_ATTEMPT sessionId={} gameId={}", session.getId(), normalizedGameId);
        String resumeToken = msg.has("resumeToken") ? msg.get("resumeToken").getAsString() : null;
        Integer preferredPlayerNumber = null;
        if (resumeToken != null && !resumeToken.isBlank()) {
            preferredPlayerNumber = lobbyJwtService.resolvePlayerIfValid(resumeToken, normalizedGameId);
            if (preferredPlayerNumber == null) {
                send(session, Map.of("type", "ERROR", "message", "Unable to join game: invalid or expired resume token."));
                return;
            }
        }
        GameSessionManager.GameSession existing = sessionManager.getGame(normalizedGameId);
        if (existing == null) {
            send(session, Map.of("type", "ERROR", "message", "Unable to join game: game not found."));
            return;
        }
        if (preferredPlayerNumber == null && existing.getPlayerCount() >= existing.getMaxPlayers()) {
            send(session, Map.of("type", "ERROR", "message", "Unable to join game: game is full."));
            return;
        }

        GameSessionManager.JoinResult joinResult = sessionManager.joinGame(normalizedGameId, session, preferredPlayerNumber);
        if (joinResult == null) {
            GameSessionManager.GameSession refreshed = sessionManager.getGame(normalizedGameId);
            if (refreshed == null) {
                send(session, Map.of("type", "ERROR", "message", "Unable to join game: game not found."));
                return;
            }
            if (preferredPlayerNumber == null && refreshed.getPlayerCount() >= refreshed.getMaxPlayers()) {
                send(session, Map.of("type", "ERROR", "message", "Unable to join game: game is full."));
                return;
            }
            send(session, Map.of("type", "ERROR", "message", "Unable to join game: slot unavailable."));
            return;
        }
        GameSessionManager.GameSession game = joinResult.game();
        int playerNumber = joinResult.playerNumber();
        LOG.info(
            "LOBBY_JOINED gameId={} sessionId={} playerNumber={} resumed={} players={}/{}",
            game.getGameId(),
            session.getId(),
            playerNumber,
            joinResult.resumedSession(),
            game.getPlayerCount(),
            game.getMaxPlayers()
        );

        Map<String, Object> joinedPayload = new HashMap<>();
        joinedPayload.put("type", "JOINED_GAME");
        joinedPayload.put("gameId", game.getGameId());
        joinedPayload.put("players", game.getPlayerCount());
        joinedPayload.put("maxPlayers", game.getMaxPlayers());
        joinedPayload.put("playerNumber", playerNumber);
        joinedPayload.put("resumeToken", lobbyJwtService.issueToken(game.getGameId(), playerNumber));
        joinedPayload.put("resumed", joinResult.resumedSession());

        String gameStatus = game.isGameplayStarted() ? "IN_PROGRESS" : "NOT_STARTED";
        String playerResult = "PENDING";
        GameSession lobbyGame = lobbyGameRegistry.getLobbyIfPresent(game.getGameId());
        if (lobbyGame != null) {
            try {
                GameStateResponse state = lobbyGame.getStateForPlayer(playerNumber);
                joinedPayload.put("gamePhase", state.phase().name());
                joinedPayload.put("winner", state.winner());
                if (state.phase() == DuelPhase.GAME_OVER) {
                    gameStatus = "FINISHED";
                    if (state.winner() != null) {
                        playerResult = state.winner() == playerNumber ? "VICTORY" : "DEFEAT";
                    }
                } else {
                    gameStatus = "IN_PROGRESS";
                }
            } catch (Exception ignored) {
                // Etat lobby indisponible: on conserve NOT_STARTED.
            }
        }
        joinedPayload.put("gameStatus", gameStatus);
        joinedPayload.put("playerResult", playerResult);
        send(session, joinedPayload);
        sendLobbyConfigSnapshot(session, game.getGameId());

        if (joinResult.resumedSession()) {
            broadcastToGame(game, Map.of(
                "type", "PLAYER_RECONNECTED",
                "gameId", game.getGameId(),
                "playerNumber", playerNumber
            ));
        }

        broadcastToGame(game, Map.of(
            "type", "PLAYER_COUNT_UPDATED",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers()
        ));
    }

    private void handleHeartbeat(WebSocketSession session, JsonObject msg) {
        sessionManager.recordHeartbeat(session);
    }

    private void handleUpdateLobbyConfig(WebSocketSession session, JsonObject msg) throws Exception {
        String gameId = sessionManager.getGameIdForSession(session);
        if (gameId == null) {
            send(session, Map.of("type", "ERROR", "message", "Unable to update lobby config: not in lobby."));
            return;
        }
        GameSessionManager.GameSession game = sessionManager.getGame(gameId);
        if (game == null) {
            send(session, Map.of("type", "ERROR", "message", "Unable to update lobby config: game not found."));
            return;
        }
        if (!game.isHost(session)) {
            send(session, Map.of("type", "ERROR", "message", "Only host can update lobby config."));
            return;
        }
        GameSessionManager.LobbyConfigSnapshot snapshot = parseLobbyConfig(msg);
        sessionManager.updateLobbyConfigSnapshot(gameId, snapshot);
        LOG.info(
            "LOBBY_CONFIG_UPDATED gameId={} hostSessionId={} boardSize={} playerCount={} humanPlayers={} aiPlayers={}",
            gameId,
            session.getId(),
            snapshot.boardSize(),
            snapshot.playerCount(),
            snapshot.humanPlayers(),
            snapshot.aiPlayers()
        );
        broadcastLobbyConfigSnapshot(game, snapshot, gameId);
    }

    private void handleLeaveGame(WebSocketSession session, JsonObject msg) throws Exception {
        GameSessionManager.LeaveResult leaveResult = sessionManager.leaveGame(session);
        if (leaveResult == null) {
            send(session, Map.of("type", "LEFT_GAME", "ok", false));
            return;
        }
        LOG.info(
            "LOBBY_LEFT gameId={} sessionId={} playerNumber={}",
            leaveResult.gameId(),
            session.getId(),
            leaveResult.playerNumber()
        );
        send(session, Map.of(
            "type", "LEFT_GAME",
            "ok", true,
            "gameId", leaveResult.gameId(),
            "playerNumber", leaveResult.playerNumber()
        ));
        GameSessionManager.GameSession game = sessionManager.getGame(leaveResult.gameId());
        if (game != null) {
            broadcastToGame(game, Map.of(
                "type", "PLAYER_COUNT_UPDATED",
                "gameId", game.getGameId(),
                "players", game.getPlayerCount(),
                "maxPlayers", game.getMaxPlayers()
            ));
        }
    }

    private void handleStartGame(WebSocketSession session, JsonObject msg) throws Exception {
        String gameId = msg.has("gameId") ? msg.get("gameId").getAsString() : null;
        if (gameId == null || gameId.isBlank()) {
            send(session, Map.of("type", "ERROR", "message", "Missing gameId."));
            return;
        }

        GameSessionManager.GameSession game = sessionManager.getGame(gameId);
        if (game == null) {
            send(session, Map.of("type", "ERROR", "message", "Game not found."));
            return;
        }
        if (!game.isHost(session)) {
            send(session, Map.of("type", "ERROR", "message", "Only host can start the game."));
            return;
        }
        if (game.getPlayerCount() < 2) {
            send(session, Map.of("type", "ERROR", "message", "At least 2 players are required."));
            return;
        }
        LOG.info(
            "LOBBY_START_REQUEST gameId={} hostSessionId={} players={}/{}",
            game.getGameId(),
            session.getId(),
            game.getPlayerCount(),
            game.getMaxPlayers()
        );
        game.markGameplayStarted();

        broadcastToGame(game, Map.of(
            "type", "GAME_STARTED",
            "gameId", game.getGameId(),
            "players", game.getPlayerCount(),
            "maxPlayers", game.getMaxPlayers()
        ));
    }

    /**
     * Notifie toutes les sessions WebSocket encore connectees dans la partie ({@code lobbyId}),
     * afin que les autres clients recuperent vite l'etat via {@code GET /game/state}.
     */
    public void notifyLobbyGameSync(String lobbyId) {
        if (lobbyId == null || lobbyId.isBlank()) {
            return;
        }
        String id = lobbyId.strip();
        GameSessionManager.GameSession session = sessionManager.getGame(id);
        if (session == null) {
            return;
        }
        try {
            broadcastToGame(session, Map.of(
                "type", "GAME_STATE_UPDATE",
                "gameId", id
            ));
        } catch (Exception ignored) {
            // Lobby vide ou sockets fermees : pas bloquant pour HTTP.
        }
    }

    public void notifyLobbyGameplayEvent(String lobbyId, Map<String, Object> payload) {
        if (lobbyId == null || lobbyId.isBlank() || payload == null || payload.isEmpty()) {
            return;
        }
        String id = lobbyId.strip();
        GameSessionManager.GameSession session = sessionManager.getGame(id);
        if (session == null) {
            return;
        }
        try {
            Map<String, Object> event = new HashMap<>(payload);
            event.putIfAbsent("gameId", id);
            broadcastToGame(session, event);
        } catch (Exception ignored) {
            // Non bloquant : la synchro d'etat HTTP prendra le relais.
        }
    }

    public void notifyLobbyGameplayEventForPlayers(String lobbyId, Map<String, Object> payload, Set<Integer> recipients) {
        if (lobbyId == null || lobbyId.isBlank() || payload == null || payload.isEmpty() || recipients == null || recipients.isEmpty()) {
            return;
        }
        String id = lobbyId.strip();
        Set<Integer> uniqueRecipients = new HashSet<>(recipients);
        Map<String, Object> event = new HashMap<>(payload);
        event.putIfAbsent("gameId", id);
        CharSequence serialized = gson.toJson(event);
        for (Integer playerNumber : uniqueRecipients) {
            if (playerNumber == null || playerNumber <= 0) {
                continue;
            }
            WebSocketSession session = sessionManager.getSessionForPlayer(id, playerNumber);
            if (session == null || !session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(new TextMessage(serialized));
            } catch (IOException ignored) {
                sessionManager.leaveGame(session);
                try {
                    session.close(CloseStatus.SERVER_ERROR);
                } catch (IOException ignoredClose) {
                    // Ignore close failure: the socket is already broken.
                }
            }
        }
    }

    @Scheduled(fixedDelay = 1000L)
    public void processPresenceEvents() {
        List<GameSessionManager.PresenceEvent> events = sessionManager.collectPresenceEvents();
        for (GameSessionManager.PresenceEvent event : events) {
            GameSessionManager.GameSession game = sessionManager.getGame(event.gameId());
            if (game == null) {
                continue;
            }
            try {
                if ("PLAYER_DISCONNECTED".equals(event.type())) {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("type", "PLAYER_DISCONNECTED");
                    payload.put("gameId", event.gameId());
                    payload.put("playerNumber", event.playerNumber());
                    payload.put("forfeitDeadlineAt", event.forfeitDeadlineAtMs() != null ? Instant.ofEpochMilli(event.forfeitDeadlineAtMs()).toString() : null);
                    broadcastToGame(game, payload);
                    continue;
                }
                if ("PLAYER_RECONNECTED".equals(event.type())) {
                    broadcastToGame(game, Map.of(
                        "type", "PLAYER_RECONNECTED",
                        "gameId", event.gameId(),
                        "playerNumber", event.playerNumber()
                    ));
                    continue;
                }
                if ("PLAYER_FORFEITED".equals(event.type())) {
                    GameStateResponse state = lobbyGameRegistry.forLobbyOrLocal(event.gameId()).forfeitPlayer(event.playerNumber());
                    broadcastToGame(game, Map.of(
                        "type", "PLAYER_FORFEITED",
                        "gameId", event.gameId(),
                        "playerNumber", event.playerNumber(),
                        "winner", state.winner()
                    ));
                    notifyLobbyGameSync(event.gameId());
                }
            } catch (Exception ignored) {
                // Non bloquant: le polling HTTP prendra le relais.
            }
        }

        List<String> idleLobbyIds = sessionManager.collectIdleLobbyIds();
        for (String gameId : idleLobbyIds) {
            sessionManager.evictLobby(gameId);
            lobbyGameRegistry.removeLobby(gameId);
        }
    }

    private void broadcastToGame(GameSessionManager.GameSession game, Map<String, Object> payload) throws Exception {
        CharSequence serialized = Objects.requireNonNull(gson.toJson(payload));
        for (WebSocketSession playerSession : game.getPlayers()) {
            if (playerSession.isOpen()) {
                try {
                    playerSession.sendMessage(new TextMessage(serialized));
                } catch (IOException ignored) {
                    sessionManager.leaveGame(playerSession);
                    try {
                        playerSession.close(CloseStatus.SERVER_ERROR);
                    } catch (IOException ignoredClose) {
                        // Ignore close failure: the socket is already broken.
                    }
                }
            }
        }
    }

    private GameSessionManager.LobbyConfigSnapshot parseLobbyConfig(JsonObject msg) {
        return LobbyConfigPayloads.parse(msg);
    }

    private void sendLobbyConfigSnapshot(WebSocketSession session, String gameId) throws Exception {
        GameSessionManager.LobbyConfigSnapshot snapshot = sessionManager.getLobbyConfigSnapshot(gameId);
        if (snapshot == null) {
            return;
        }
        send(session, LobbyConfigPayloads.serialize(gameId, snapshot));
    }

    private void broadcastLobbyConfigSnapshot(
            GameSessionManager.GameSession game,
            GameSessionManager.LobbyConfigSnapshot snapshot,
            String gameId) throws Exception {
        broadcastToGame(game, LobbyConfigPayloads.serialize(gameId, snapshot));
    }

    private void send(WebSocketSession session, Map<String, Object> payload) throws Exception {
        Objects.requireNonNull(session, "session");
        if (!session.isOpen()) {
            return;
        }
        CharSequence serialized = Objects.requireNonNull(gson.toJson(payload));
        try {
            session.sendMessage(new TextMessage(serialized));
        } catch (IOException ignored) {
            sessionManager.leaveGame(session);
            try {
                session.close(CloseStatus.SERVER_ERROR);
            } catch (IOException ignoredClose) {
                // Ignore close failure: the socket is already broken.
            }
        }
    }
}
