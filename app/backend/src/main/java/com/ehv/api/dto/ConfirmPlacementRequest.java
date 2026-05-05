package com.ehv.api.dto;

/** {@code gameId} optionnel : si renseigne, le lobby WebSocket associe sera notifie pour resynchroniser les clients. */
public record ConfirmPlacementRequest(
    int player,
    String gameId
) {
}
