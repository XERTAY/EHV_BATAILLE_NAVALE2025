package com.ehv.api.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class GameSessionManager {
    // Map gameId -> GameSession
    private final Map<String, GameSession> games = new ConcurrentHashMap<>();
    // Map sessionId -> gameId
    private final Map<String, String> playerToGame = new ConcurrentHashMap<>();

    public GameSession createGame(int maxPlayers, WebSocketSession hostSession) {
        String gameId = UUID.randomUUID().toString();
        GameSession session = new GameSession(gameId, maxPlayers, hostSession.getId());
        games.put(gameId, session);
        return session;
    }

    public GameSession joinGame(String gameId, WebSocketSession playerSession) {
        String currentGameId = playerToGame.get(playerSession.getId());
        if (currentGameId != null && !currentGameId.equals(gameId)) {
            leaveGame(playerSession);
        }

        GameSession session = games.get(gameId);
        if (session != null && session.addPlayer(playerSession)) {
            playerToGame.put(playerSession.getId(), gameId);
            return session;
        }
        return null;
    }

    public void leaveGame(WebSocketSession playerSession) {
        String gameId = playerToGame.remove(playerSession.getId());
        if (gameId != null) {
            GameSession session = games.get(gameId);
            if (session != null) {
                session.removePlayer(playerSession);
                if (session.isEmpty()) {
                    games.remove(gameId);
                }
            }
        }
    }

    public GameSession getGameByPlayer(WebSocketSession playerSession) {
        String gameId = playerToGame.get(playerSession.getId());
        return gameId != null ? games.get(gameId) : null;
    }

    public GameSession getGame(String gameId) {
        return games.get(gameId);
    }

    // Inner class for a game session
    public static class GameSession {
        private final String gameId;
        private final int maxPlayers;
        private final String hostSessionId;
        private final List<WebSocketSession> players = Collections.synchronizedList(new ArrayList<>());

        public GameSession(String gameId, int maxPlayers, String hostSessionId) {
            this.gameId = gameId;
            this.maxPlayers = maxPlayers;
            this.hostSessionId = hostSessionId;
        }

        public boolean addPlayer(WebSocketSession session) {
            synchronized (players) {
                if (players.stream().anyMatch(existing -> existing.getId().equals(session.getId()))) {
                    return true;
                }
                if (players.size() < maxPlayers) {
                    players.add(session);
                    return true;
                }
                return false;
            }
        }

        public void removePlayer(WebSocketSession session) {
            players.remove(session);
        }

        public boolean isEmpty() {
            return players.isEmpty();
        }

        public List<WebSocketSession> getPlayers() {
            return players;
        }

        public int getPlayerCount() {
            return players.size();
        }

        public int getMaxPlayers() {
            return maxPlayers;
        }

        public String getGameId() {
            return gameId;
        }

        public boolean isHost(WebSocketSession session) {
            return session != null && hostSessionId.equals(session.getId());
        }

        public int getPlayerNumber(WebSocketSession session) {
            if (session == null) {
                return -1;
            }
            synchronized (players) {
                for (int i = 0; i < players.size(); i++) {
                    if (players.get(i).getId().equals(session.getId())) {
                        return i + 1;
                    }
                }
            }
            return -1;
        }
    }
}
