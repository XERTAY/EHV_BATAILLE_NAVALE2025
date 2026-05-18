package com.ehv.battleship.persistence;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Pattern;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.Ship;

public final class GamePersistence {

    private static final Pattern SAFE_FILE_NAME = Pattern.compile("^[a-zA-Z0-9._-]{1,64}$");
    private static final Path SAVES_DIR = Paths.get("saves").toAbsolutePath().normalize();

    private static final Gson GSON = new GsonBuilder()
        .setPrettyPrinting()
        .registerTypeHierarchyAdapter(Player.class, new PlayerTypeAdapter())
        .create();

    private GamePersistence() {
    }

    public static Path savesDirectory() {
        return SAVES_DIR;
    }

    public static String toJson(SavedGameSnapshot snapshot) {
        if (snapshot == null) {
            throw new IllegalArgumentException("L'instantané ne peut pas être nul");
        }
        return GSON.toJson(snapshot);
    }

    public static SavedGameSnapshot fromJson(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalArgumentException("Le contenu JSON est vide");
        }
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        if (root.has("formatVersion")) {
            SavedGameSnapshot snapshot = GSON.fromJson(json, SavedGameSnapshot.class);
            synchronizeIdCounters(snapshot.getGame());
            return snapshot;
        }
        Game legacyGame = GSON.fromJson(json, Game.class);
        synchronizeIdCounters(legacyGame);
        return SavedGameSnapshot.fromGameOnly(legacyGame);
    }

    public static void saveSnapshot(SavedGameSnapshot snapshot, String fileName) throws IOException {
        if (snapshot == null) {
            throw new IllegalArgumentException("L'instantané ne peut pas être nul");
        }
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("Le nom du fichier ne peut pas être vide");
        }
        Path path = resolveSafeSavePath(fileName);
        Files.createDirectories(path.getParent());
        Files.writeString(path, toJson(snapshot), StandardCharsets.UTF_8);
    }

    public static SavedGameSnapshot loadSnapshot(String fileName) throws IOException {
        return fromJson(readFileUtf8(resolveSafeSavePath(fileName)));
    }

  /** @deprecated Préférer {@link #saveSnapshot}. Conservé pour compatibilité interne. */
    public static void save(Game game, String fileName) throws IOException {
        saveSnapshot(SavedGameSnapshot.fromGameOnly(game), fileName);
    }

    /** @deprecated Préférer {@link #loadSnapshot}. */
    public static Game load(String fileName) throws IOException {
        return loadSnapshot(fileName).getGame();
    }

    private static String readFileUtf8(Path path) throws IOException {
        if (!Files.exists(path)) {
            throw new IOException("Fichier de sauvegarde introuvable : " + path);
        }
        return Files.readString(path, StandardCharsets.UTF_8);
    }

    private static void synchronizeIdCounters(Game game) {
        if (game == null) {
            return;
        }
        int maxPlayerId = 0;
        int maxShipId = 0;

        for (Player player : game.getPlayers()) {
            maxPlayerId = Math.max(maxPlayerId, player.getId());
            for (Ship ship : player.getFleet().getShips()) {
                maxShipId = Math.max(maxShipId, ship.getId());
            }
        }

        Game.ensureNextIdAtLeast(game.getId() + 1);
        Player.ensureNextIdAtLeast(maxPlayerId + 1);
        Ship.ensureNextIdAtLeast(maxShipId + 1);
    }

    private static Path resolveSafeSavePath(String fileName) {
        String trimmed = fileName.trim();
        if (!SAFE_FILE_NAME.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("Nom de fichier invalide.");
        }
        String normalizedFileName = trimmed.endsWith(".save") ? trimmed : trimmed + ".save";
        Path path = SAVES_DIR.resolve(normalizedFileName).normalize();
        if (!path.startsWith(SAVES_DIR)) {
            throw new IllegalArgumentException("Chemin de sauvegarde invalide.");
        }
        return path;
    }
}
