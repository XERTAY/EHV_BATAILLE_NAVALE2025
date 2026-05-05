package com.ehv.api.dto;

/** {@code gameId} optionnel : synchronise le salon WebSocket en multijoueur. */
public record PlaceShipRequest(
    int player,
    String shipType,
    int x,
    int y,
    String orientation,
    String gameId
) {
}
