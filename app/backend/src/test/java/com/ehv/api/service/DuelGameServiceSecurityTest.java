package com.ehv.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.view.CellViewState;
import com.ehv.api.view.GameStateResponse;

class DuelGameServiceSecurityTest {

    @Test
    void shouldHideEnemyShipCellsOutsideGameOver() {
        DuelGameService service = new DuelGameService();
        service.resetAndGetState(10, java.util.List.of(2, 2, 2, 2, 2), 4, false, 4);
        service.placeShip(new PlaceShipRequest(2, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));

        GameStateResponse playerOneView = service.getStateForPlayer(1);
        var playerTwoBoard = playerOneView.boards().get(1);
        assertEquals(CellViewState.EMPTY, playerTwoBoard.cells().get(0).get(0));
        assertEquals(CellViewState.EMPTY, playerTwoBoard.cells().get(0).get(1));
    }

    @Test
    void shouldExposePlacedShipTypesOnlyForViewer() {
        DuelGameService service = new DuelGameService();
        service.resetAndGetState(10, java.util.List.of(2, 2, 2, 2, 2), 2, false, 2);
        service.placeShip(new PlaceShipRequest(1, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));
        service.placeShip(new PlaceShipRequest(2, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));

        GameStateResponse playerOneView = service.getStateForPlayer(1);
        assertEquals(1, playerOneView.placedShipTypesByPlayer().get(0).size());
        assertEquals(0, playerOneView.placedShipTypesByPlayer().get(1).size());
    }
}
