package com.ehv.api.view;

/**
 * Réponse après sauvegarde : état courant pour l'UI + contenu JSON du fichier {@code .save}
 * à télécharger côté navigateur.
 */
public record SaveGameResponse(
    GameStateResponse state,
    String fileName,
    String content
) {
}
