package com.ehv.api.dto;

public record PlaceShipRequest(
    int player,
    String shipType,
    int x,
    int y,
    String orientation
) {
}
