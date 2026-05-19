package com.ehv.api.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import com.ehv.api.lobby.LobbyGameId;

@Component
public class GameSessionManager {
    private static final long HEARTBEAT_INTERVAL_MS = 5000L;
    private static final long DISCONNECT_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2L;
    private static final long FORFEIT_GRACE_MS = 60000L;
    private static final long LOBBY_IDLE_EVICTION_MS = 5L * 60L * 1000L;

    // Map gameId -> GameSession
    private final Map<String, GameSession> games = new ConcurrentHashMap<>();
    // Map sessionId -> gameId
    private final Map<String, String> playerToGame = new ConcurrentHashMap<>();
    // Map sessionId -> playerNumber
    private final Map<String, Integer> sessionToPlayer = new ConcurrentHashMap<>();
    // Map gameId -> lobby config snapshot
    private final Map<String, LobbyConfigSnapshot> lobbyConfigByGameId = new ConcurrentHashMap<>();

    private static String normalizeGameId(String gameId) {
        return LobbyGameId.normalize(gameId);
    }

    private String allocateGameId() {
        for (int attempt = 0; attempt < 64; attempt++) {
            String candidate = LobbyGameId.generate();
            if (!games.containsKey(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Unable to allocate a unique lobby game id");
    }

    public GameSession createGame(int maxPlayers, WebSocketSession hostSession) {
        String gameId = allocateGameId();
        GameSession session = new GameSession(gameId, maxPlayers, hostSession.getId());
        games.put(gameId, session);
        session.bindPlayer(1, hostSession);
        playerToGame.put(hostSession.getId(), gameId);
        sessionToPlayer.put(hostSession.getId(), 1);
        lobbyConfigByGameId.put(gameId, LobbyConfigSnapshot.defaultFor(maxPlayers));
        return session;
    }

    public JoinResult joinGame(String gameId, WebSocketSession playerSession, Integer preferredPlayerNumber) {
        String normalizedGameId = normalizeGameId(gameId);
        if (normalizedGameId == null) {
            return null;
        }
        String currentGameId = playerToGame.get(playerSession.getId());
        if (currentGameId != null && !currentGameId.equals(normalizedGameId)) {
            leaveGame(playerSession);
        }

        GameSession game = games.get(normalizedGameId);
        if (game == null) {
            return null;
        }
        Integer assignedPlayer = game.bindForJoin(playerSession, preferredPlayerNumber);
        if (assignedPlayer == null) {
            return null;
        }
        playerToGame.put(playerSession.getId(), normalizedGameId);
        sessionToPlayer.put(playerSession.getId(), assignedPlayer);
        return new JoinResult(game, assignedPlayer, preferredPlayerNumber != null && preferredPlayerNumber.equals(assignedPlayer));
    }

    public LeaveResult leaveGame(WebSocketSession playerSession) {
        if (playerSession == null) {
            return null;
        }
        String gameId = playerToGame.remove(playerSession.getId());
        Integer playerNumber = sessionToPlayer.remove(playerSession.getId());
        if (gameId != null) {
            GameSession session = games.get(gameId);
            if (session != null) {
                int effectivePlayer = playerNumber != null ? playerNumber : session.getPlayerNumber(playerSession);
                if (effectivePlayer > 0) {
                    session.markDisconnected(effectivePlayer);
                    return new LeaveResult(gameId, effectivePlayer);
                }
            }
        }
        return null;
    }

    public GameSession getGameByPlayer(WebSocketSession playerSession) {
        String gameId = playerToGame.get(playerSession.getId());
        return gameId != null ? games.get(gameId) : null;
    }

    public GameSession getGame(String gameId) {
        return games.get(normalizeGameId(gameId));
    }

    public Integer getPlayerNumber(WebSocketSession session) {
        if (session == null) {
            return null;
        }
        return sessionToPlayer.get(session.getId());
    }

    public boolean isHostPlayer(String gameId, int playerNumber) {
        GameSession game = getGame(gameId);
        if (game == null) {
            return false;
        }
        return game.isHostPlayer(playerNumber);
    }

    public WebSocketSession getSessionForPlayer(String gameId, int playerNumber) {
        GameSession game = getGame(gameId);
        if (game == null) {
            return null;
        }
        return game.getSessionForPlayer(playerNumber);
    }

    public void recordHeartbeat(WebSocketSession session) {
        if (session == null) {
            return;
        }
        String gameId = playerToGame.get(session.getId());
        Integer playerNumber = sessionToPlayer.get(session.getId());
        if (gameId == null || playerNumber == null) {
            return;
        }
        GameSession game = games.get(gameId);
        if (game == null) {
            return;
        }
        game.markHeartbeat(playerNumber);
    }

    public List<String> collectIdleLobbyIds() {
        long now = System.currentTimeMillis();
        List<String> idleGameIds = new ArrayList<>();
        for (GameSession game : games.values()) {
            if (game.isIdle(now, LOBBY_IDLE_EVICTION_MS)) {
                idleGameIds.add(game.getGameId());
            }
        }
        return idleGameIds;
    }

    public void evictLobby(String gameId) {
        String normalized = normalizeGameId(gameId);
        if (normalized == null) {
            return;
        }
        GameSession game = games.remove(normalized);
        if (game == null) {
            return;
        }
        for (WebSocketSession session : game.getAllKnownSessions()) {
            if (session != null) {
                playerToGame.remove(session.getId());
                sessionToPlayer.remove(session.getId());
            }
        }
        lobbyConfigByGameId.remove(normalized);
    }

    public String getGameIdForSession(WebSocketSession session) {
        if (session == null) {
            return null;
        }
        return playerToGame.get(session.getId());
    }

    public LobbyConfigSnapshot getLobbyConfigSnapshot(String gameId) {
        String normalized = normalizeGameId(gameId);
        if (normalized == null) {
            return null;
        }
        return lobbyConfigByGameId.get(normalized);
    }

    public void updateLobbyConfigSnapshot(String gameId, LobbyConfigSnapshot snapshot) {
        String normalized = normalizeGameId(gameId);
        if (normalized == null || snapshot == null) {
            return;
        }
        lobbyConfigByGameId.put(normalized, snapshot.normalized());
    }

    public List<PresenceEvent> collectPresenceEvents() {
        long now = System.currentTimeMillis();
        List<PresenceEvent> events = new ArrayList<>();
        for (GameSession game : games.values()) {
            game.collectPresenceEvents(now, events);
        }
        return events;
    }

    public long getDisconnectThresholdMs() {
        return DISCONNECT_THRESHOLD_MS;
    }

    public long getForfeitGraceMs() {
        return FORFEIT_GRACE_MS;
    }

    public long getLobbyIdleEvictionMs() {
        return LOBBY_IDLE_EVICTION_MS;
    }

    // Inner class for a game session
    public static class GameSession {
        private final String gameId;
        private final int maxPlayers;
        private final String hostSessionId;
        private final Map<Integer, PlayerSlot> slots = new ConcurrentHashMap<>();
        private volatile long lastActivityAtMs = System.currentTimeMillis();
        private volatile boolean gameplayStarted = false;

        public GameSession(String gameId, int maxPlayers, String hostSessionId) {
            this.gameId = gameId;
            this.maxPlayers = maxPlayers;
            this.hostSessionId = hostSessionId;
            for (int i = 1; i <= maxPlayers; i++) {
                slots.put(i, new PlayerSlot());
            }
        }

        private void bindPlayer(int playerNumber, WebSocketSession session) {
            PlayerSlot slot = slots.get(playerNumber);
            if (slot == null) {
                return;
            }
            slot.session = session;
            slot.connected = true;
            slot.lastHeartbeatAtMs = System.currentTimeMillis();
            slot.disconnectedAtMs = null;
            slot.disconnectAnnounced = false;
            slot.forfeitTriggered = false;
            slot.forfeitDeadlineAtMs = null;
            lastActivityAtMs = System.currentTimeMillis();
        }

        public Integer bindForJoin(WebSocketSession session, Integer preferredPlayerNumber) {
            synchronized (slots) {
                if (preferredPlayerNumber != null) {
                    PlayerSlot preferredSlot = slots.get(preferredPlayerNumber);
                    if (preferredSlot == null) {
                        return null;
                    }
                    if (preferredSlot.connected && preferredSlot.session != null && !preferredSlot.session.getId().equals(session.getId())) {
                        return null;
                    }
                    bindPlayer(preferredPlayerNumber, session);
                    return preferredPlayerNumber;
                }
                for (int i = 1; i <= maxPlayers; i++) {
                    PlayerSlot slot = slots.get(i);
                    if (slot == null || slot.connected) {
                        continue;
                    }
                    bindPlayer(i, session);
                    return i;
                }
                for (int i = 1; i <= maxPlayers; i++) {
                    PlayerSlot slot = slots.get(i);
                    if (slot == null || slot.session != null || slot.connected) {
                        continue;
                    }
                    bindPlayer(i, session);
                    return i;
                }
                return null;
            }
        }

        public void markDisconnected(int playerNumber) {
            PlayerSlot slot = slots.get(playerNumber);
            if (slot == null || !slot.connected) {
                return;
            }
            slot.connected = false;
            slot.session = null;
            long now = System.currentTimeMillis();
            slot.disconnectedAtMs = now;
            slot.forfeitDeadlineAtMs = now + FORFEIT_GRACE_MS;
            lastActivityAtMs = now;
        }

        public void markHeartbeat(int playerNumber) {
            PlayerSlot slot = slots.get(playerNumber);
            if (slot == null) {
                return;
            }
            slot.lastHeartbeatAtMs = System.currentTimeMillis();
            if (slot.connected) {
                slot.disconnectedAtMs = null;
                slot.disconnectAnnounced = false;
                slot.forfeitDeadlineAtMs = null;
                slot.forfeitTriggered = false;
            }
            lastActivityAtMs = slot.lastHeartbeatAtMs;
        }

        public List<WebSocketSession> getPlayers() {
            List<WebSocketSession> sessions = new ArrayList<>();
            for (int i = 1; i <= maxPlayers; i++) {
                PlayerSlot slot = slots.get(i);
                if (slot != null && slot.connected && slot.session != null && slot.session.isOpen()) {
                    sessions.add(slot.session);
                }
            }
            return Collections.unmodifiableList(sessions);
        }

        public int getPlayerCount() {
            int count = 0;
            for (int i = 1; i <= maxPlayers; i++) {
                PlayerSlot slot = slots.get(i);
                if (slot != null && slot.connected) {
                    count += 1;
                }
            }
            return count;
        }

        public int getMaxPlayers() {
            return maxPlayers;
        }

        public String getGameId() {
            return gameId;
        }

        public void markGameplayStarted() {
            gameplayStarted = true;
            lastActivityAtMs = System.currentTimeMillis();
        }

        public boolean isGameplayStarted() {
            return gameplayStarted;
        }

        public boolean isHost(WebSocketSession session) {
            return session != null && hostSessionId.equals(session.getId());
        }

        public boolean isHostPlayer(int playerNumber) {
            return playerNumber == 1;
        }

        public int getPlayerNumber(WebSocketSession session) {
            if (session == null) {
                return -1;
            }
            for (int i = 1; i <= maxPlayers; i++) {
                PlayerSlot slot = slots.get(i);
                if (slot != null && slot.session != null && slot.session.getId().equals(session.getId())) {
                    return i;
                }
            }
            return -1;
        }

        public WebSocketSession getSessionForPlayer(int playerNumber) {
            PlayerSlot slot = slots.get(playerNumber);
            if (slot == null || !slot.connected || slot.session == null || !slot.session.isOpen()) {
                return null;
            }
            return slot.session;
        }

        private void collectPresenceEvents(long now, List<PresenceEvent> events) {
            for (int i = 1; i <= maxPlayers; i++) {
                PlayerSlot slot = slots.get(i);
                if (slot == null) {
                    continue;
                }
                if (!slot.connected && slot.disconnectedAtMs != null) {
                    if (!slot.disconnectAnnounced && now - slot.lastHeartbeatAtMs >= DISCONNECT_THRESHOLD_MS) {
                        slot.disconnectAnnounced = true;
                        events.add(PresenceEvent.disconnected(gameId, i, slot.forfeitDeadlineAtMs));
                        lastActivityAtMs = now;
                    }
                    if (slot.disconnectAnnounced && !slot.forfeitTriggered && slot.forfeitDeadlineAtMs != null && now >= slot.forfeitDeadlineAtMs) {
                        slot.forfeitTriggered = true;
                        events.add(PresenceEvent.forfeited(gameId, i));
                        lastActivityAtMs = now;
                    }
                }
            }
        }

        private boolean isIdle(long now, long idleThresholdMs) {
            if (getPlayerCount() > 0) {
                return false;
            }
            return now - lastActivityAtMs >= idleThresholdMs;
        }

        private List<WebSocketSession> getAllKnownSessions() {
            List<WebSocketSession> sessions = new ArrayList<>();
            for (int i = 1; i <= maxPlayers; i++) {
                PlayerSlot slot = slots.get(i);
                if (slot != null && slot.session != null) {
                    sessions.add(slot.session);
                }
            }
            return sessions;
        }
    }

    private static final class PlayerSlot {
        private WebSocketSession session;
        private boolean connected;
        private long lastHeartbeatAtMs = System.currentTimeMillis();
        private Long disconnectedAtMs;
        private Long forfeitDeadlineAtMs;
        private boolean disconnectAnnounced;
        private boolean forfeitTriggered;
    }

    public record JoinResult(GameSession game, int playerNumber, boolean resumedSession) {
    }

    public record LeaveResult(String gameId, int playerNumber) {
    }

    public record PresenceEvent(String type, String gameId, int playerNumber, Long forfeitDeadlineAtMs) {
        public static PresenceEvent disconnected(String gameId, int playerNumber, Long forfeitDeadlineAtMs) {
            return new PresenceEvent("PLAYER_DISCONNECTED", gameId, playerNumber, forfeitDeadlineAtMs);
        }
        public static PresenceEvent forfeited(String gameId, int playerNumber) {
            return new PresenceEvent("PLAYER_FORFEITED", gameId, playerNumber, null);
        }
    }

    public record LobbyConfigSnapshot(
            int boardSize,
            int playerCount,
            int humanPlayers,
            int aiPlayers,
            int fleetShipCount,
            int fleetTotalCells) {

        public static LobbyConfigSnapshot defaultFor(int playerCount) {
            return new LobbyConfigSnapshot(10, playerCount, playerCount, 0, 5, 17);
        }

        public LobbyConfigSnapshot normalized() {
            int normalizedPlayerCount = playerCount == 4 ? 4 : 2;
            int normalizedHuman = Math.max(1, Math.min(humanPlayers, normalizedPlayerCount));
            int normalizedAi = Math.max(0, normalizedPlayerCount - normalizedHuman);
            return new LobbyConfigSnapshot(
                    Math.max(5, boardSize),
                    normalizedPlayerCount,
                    normalizedHuman,
                    normalizedAi,
                    Math.max(1, fleetShipCount),
                    Math.max(1, fleetTotalCells));
        }
    }
}
