package com.ehv.api.view;

import java.util.List;

public record GameStateResponse(
    int boardSize,
    DuelPhase phase,
    int currentPlayer,
    Integer winner,
    List<BoardStateView> boards,
    List<Boolean> playersAlive,
    List<Boolean> aiPlayers
) {
}
