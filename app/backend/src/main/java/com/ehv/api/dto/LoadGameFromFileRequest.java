package com.ehv.api.dto;

/** Corps JSON pour charger une partie depuis un fichier {@code .save} importé par le navigateur. */
public record LoadGameFromFileRequest(
    String content,
  /** Id de salon WebSocket optionnel (sinon partie locale partagée). */
    String gameId
) {
}
