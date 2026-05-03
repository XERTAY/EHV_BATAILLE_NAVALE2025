package com.ehv.api.dto;

import java.util.List;

public record ResetGameRequest(
    int boardSize,
    List<Integer> fleetShipSizes
) {}
