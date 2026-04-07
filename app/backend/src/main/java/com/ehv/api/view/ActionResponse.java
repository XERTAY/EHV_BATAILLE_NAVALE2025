package com.ehv.api.view;

public record ActionResponse(
    ActionResult result,
    String message,
    GameStateResponse state
) {
}
