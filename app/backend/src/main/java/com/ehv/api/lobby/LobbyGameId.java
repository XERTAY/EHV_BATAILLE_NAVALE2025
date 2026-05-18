package com.ehv.api.lobby;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * Identifiant court de salon : 4 caracteres alphanumeriques (a-z, 0-9).
 */
public final class LobbyGameId {
    public static final int LENGTH = 4;
    private static final String CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final Pattern FORMAT = Pattern.compile("^[0-9a-z]{4}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private LobbyGameId() {
    }

    public static String generate() {
        StringBuilder builder = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            builder.append(CHARSET.charAt(RANDOM.nextInt(CHARSET.length())));
        }
        return builder.toString();
    }

    public static boolean isValid(String gameId) {
        return normalize(gameId) != null;
    }

    public static String normalize(String gameId) {
        if (gameId == null) {
            return null;
        }
        String normalized = gameId.strip().toLowerCase();
        if (normalized.isEmpty() || !FORMAT.matcher(normalized).matches()) {
            return null;
        }
        return normalized;
    }
}
