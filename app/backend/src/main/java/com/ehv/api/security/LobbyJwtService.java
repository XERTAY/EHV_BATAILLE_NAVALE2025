package com.ehv.api.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

@Component
public class LobbyJwtService {
    private static final long TOKEN_TTL_SECONDS = 15L * 60L;
    private static final String HMAC_ALG = "HmacSHA256";
    private static final String DEFAULT_SECRET = "change-this-lobby-jwt-secret";
    private static final int MIN_SECRET_LENGTH = 32;
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();
    private static final Gson GSON = new Gson();

    private final byte[] signingKeyBytes;

    public LobbyJwtService(@Value("${lobby.jwt.secret:}") String signingSecret) {
        String normalizedSecret = signingSecret == null ? "" : signingSecret.trim();
        if (normalizedSecret.isEmpty() || DEFAULT_SECRET.equals(normalizedSecret) || normalizedSecret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                "Property 'lobby.jwt.secret' must be configured with at least " + MIN_SECRET_LENGTH + " characters.");
        }
        this.signingKeyBytes = normalizedSecret.getBytes(StandardCharsets.UTF_8);
    }

    public String issueToken(String gameId, int playerNumber) {
        if (gameId == null || gameId.isBlank() || playerNumber <= 0) {
            throw new IllegalArgumentException("Invalid lobby token payload.");
        }
        long exp = Instant.now().getEpochSecond() + TOKEN_TTL_SECONDS;
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("gameId", normalize(gameId));
        payload.put("player", playerNumber);
        payload.put("exp", exp);

        String encodedHeader = encodeJson(header);
        String encodedPayload = encodeJson(payload);
        String signingInput = encodedHeader + "." + encodedPayload;
        String signature = sign(signingInput);
        return signingInput + "." + signature;
    }

    public boolean isValidForLobby(String token, String expectedGameId, Integer expectedPlayerNumber) {
        Integer tokenPlayer = resolvePlayerIfValid(token, expectedGameId);
        if (tokenPlayer == null) {
            return false;
        }
        if (expectedPlayerNumber != null && tokenPlayer.intValue() != expectedPlayerNumber.intValue()) {
            return false;
        }
        return true;
    }

    public Integer resolvePlayerIfValid(String token, String expectedGameId) {
        if (token == null || token.isBlank() || expectedGameId == null || expectedGameId.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return null;
        }
        String signingInput = parts[0] + "." + parts[1];
        byte[] expectedSig = signToBytes(signingInput);
        byte[] providedSig;
        try {
            providedSig = URL_DECODER.decode(parts[2]);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
        if (!MessageDigest.isEqual(expectedSig, providedSig)) {
            return null;
        }
        JsonObject payload;
        try {
            String payloadJson = new String(URL_DECODER.decode(parts[1]), StandardCharsets.UTF_8);
            payload = JsonParser.parseString(payloadJson).getAsJsonObject();
        } catch (Exception ignored) {
            return null;
        }
        String tokenGameId = payload.has("gameId") ? normalize(payload.get("gameId").getAsString()) : "";
        if (!normalize(expectedGameId).equals(tokenGameId)) {
            return null;
        }
        long exp = payload.has("exp") ? payload.get("exp").getAsLong() : 0L;
        if (exp <= Instant.now().getEpochSecond()) {
            return null;
        }
        int tokenPlayer = payload.has("player") ? payload.get("player").getAsInt() : -1;
        return tokenPlayer > 0 ? tokenPlayer : null;
    }

    private static String normalize(String rawGameId) {
        return rawGameId == null ? "" : rawGameId.strip().toLowerCase();
    }

    private String sign(String input) {
        return URL_ENCODER.encodeToString(signToBytes(input));
    }

    private byte[] signToBytes(String input) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALG);
            mac.init(new SecretKeySpec(signingKeyBytes, HMAC_ALG));
            return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign lobby JWT.", exception);
        }
    }

    private static String encodeJson(Map<String, Object> value) {
        return URL_ENCODER.encodeToString(GSON.toJson(value).getBytes(StandardCharsets.UTF_8));
    }
}
