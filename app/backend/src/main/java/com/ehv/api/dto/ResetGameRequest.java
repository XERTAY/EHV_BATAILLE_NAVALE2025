package com.ehv.api.dto;

import java.util.List;

public record ResetGameRequest(
    int boardSize,
    List<Integer> fleetShipSizes,
    Integer playerCount,
    Boolean withAI,
    Integer humanPlayers,
    /** Id de salon WebSocket : partie isolée côté serveur. Absent ou vide = jeu local partagé. */
    String gameId
) {}
