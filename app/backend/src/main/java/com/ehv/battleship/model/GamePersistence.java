package com.ehv.battleship.model;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public final class GamePersistence {

    private GamePersistence() {
    }

    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public static void save(Game game, String fileName) throws IOException {
        if (game == null) {
            throw new IllegalArgumentException("Le jeu ne peut pas être nul");
        }
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("Le nom du fichier ne peut pas être vide");
        }

        // Auto-route: saves/filename.save
        String filePath = "saves/" + fileName;
        if (!filePath.endsWith(".save")) {
            filePath += ".save";
        }
        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        Path parent = path.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }

        String json = gson.toJson(game);
        Files.write(path, json.getBytes());
    }

    public static Game load(String fileName) throws IOException {
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("Le nom du fichier ne peut pas être vide");
        }
        String filePath = "saves/" + fileName;
        if (!filePath.endsWith(".save")) {
            filePath += ".save";
        }
        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            throw new IOException("Fichier de sauvegarde introuvable : " + path);
        }
        String json = new String(Files.readAllBytes(path));
        Game loadedGame = gson.fromJson(json, Game.class);
        synchronizeIdCounters(loadedGame);
        return loadedGame;
    }

    private static void synchronizeIdCounters(Game game) {
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
}
