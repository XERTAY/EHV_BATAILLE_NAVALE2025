package com.ehv.api.view;

import java.util.List;

public record GameStateResponse(
    int boardSize,
    DuelPhase phase,
    int currentPlayer,
    Integer currentTargetPlayer,
    Integer winner,
    List<BoardStateView> boards,
    List<Boolean> playersAlive,
    List<Boolean> aiPlayers,
    List<Boolean> placementLockedByPlayer,
    List<List<String>> placedShipTypesByPlayer
) {
}
