package com.ehv.battleship.model;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class GamePersistence {

    private GamePersistence() {
    }

    public static void save(Game game, String filePath) throws IOException {
        if (game == null) {
            throw new IllegalArgumentException("Le jeu ne peut pas être nul");
        }
        if (filePath == null || filePath.trim().isEmpty()) {
            throw new IllegalArgumentException("Le chemin du fichier ne peut pas être vide");
        }

        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        Path parent = path.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }

        try (ObjectOutputStream output = new ObjectOutputStream(
            new BufferedOutputStream(Files.newOutputStream(path)))) {
            output.writeObject(game);
        }
    }

    public static Game load(String filePath) throws IOException {
        if (filePath == null || filePath.trim().isEmpty()) {
            throw new IllegalArgumentException("Le chemin du fichier ne peut pas être vide");
        }

        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            throw new IOException("Fichier de sauvegarde introuvable : " + path);
        }

        Object loadedObject;
        try (ObjectInputStream input = new ObjectInputStream(
            new BufferedInputStream(Files.newInputStream(path)))) {
            loadedObject = input.readObject();
        } catch (ClassNotFoundException e) {
            throw new IOException("Format de sauvegarde invalide", e);
        }

        if (!(loadedObject instanceof Game)) {
            throw new IOException("Le fichier ne contient pas une sauvegarde de partie valide");
        }

        Game loadedGame = (Game) loadedObject;
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
