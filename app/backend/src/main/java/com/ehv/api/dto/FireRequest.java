package com.ehv.api.dto;

/** {@code gameId} optionnel : notifie le salon WebSocket apres action multijoueur. */
public record FireRequest(
    int player,
    int x,
    int y,
    Integer targetPlayer,
    String gameId
) {
}
