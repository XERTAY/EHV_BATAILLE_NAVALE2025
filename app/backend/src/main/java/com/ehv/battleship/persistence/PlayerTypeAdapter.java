package com.ehv.battleship.persistence;

import java.io.IOException;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;

import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.Player;

/**
 * Sérialisation polymorphe {@link Player} / {@link AI} sans dépendance vers un contrôleur.
 * Vit dans le package persistence pour conserver le modèle libre de Gson.
 */
final class PlayerTypeAdapter extends TypeAdapter<Player> {

    static final String KIND_FIELD = "_playerRuntimeKind";

    private final Gson vanilla;

    PlayerTypeAdapter() {
        vanilla = new GsonBuilder().disableHtmlEscaping().create();
    }

    @Override
    public void write(JsonWriter out, Player value) throws IOException {
        JsonObject tree;
        if (value instanceof AI) {
            tree = vanilla.toJsonTree(value, AI.class).getAsJsonObject();
            tree.addProperty(KIND_FIELD, "ai");
        } else {
            tree = vanilla.toJsonTree(value, Player.class).getAsJsonObject();
            tree.addProperty(KIND_FIELD, "human");
        }
        vanilla.toJson((JsonElement) tree, out);
    }

    @Override
    public Player read(JsonReader in) throws IOException {
        JsonElement element = JsonParser.parseReader(in);
        if (!(element instanceof JsonObject)) {
            throw new IOException("Format Player JSON invalide");
        }
        JsonObject object = element.getAsJsonObject().deepCopy();
        JsonElement kindNode = object.remove(KIND_FIELD);
        if (kindNode == null) {
            return vanilla.fromJson(object, Player.class);
        }
        String kind = kindNode.getAsString();
        if ("ai".equals(kind)) {
            return vanilla.fromJson(object, AI.class);
        }
        return vanilla.fromJson(object, Player.class);
    }
}
