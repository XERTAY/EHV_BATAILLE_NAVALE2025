package com.ehv.api.dto;

/** {@code gameId} optionnel : synchronise le salon WebSocket en multijoueur. */
public record RemoveShipRequest(
    int player,
    String shipType,
    Integer x,
    Integer y,
    String gameId
) {
}
