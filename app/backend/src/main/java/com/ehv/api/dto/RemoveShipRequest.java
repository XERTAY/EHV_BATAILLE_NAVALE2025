package com.ehv.api.dto;

public record RemoveShipRequest(
    int player,
    String shipType,
    Integer x,
    Integer y
) {
}
