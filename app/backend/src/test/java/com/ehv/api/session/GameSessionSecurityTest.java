package com.ehv.api.session;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.dto.ResetGameRequest;
import com.ehv.api.view.CellViewState;
import com.ehv.api.view.GameStateResponse;

/**
 * Tests de sécurité de la projection API (brouillard de guerre, fuite de placements).
 * Anciennement {@code DuelGameServiceSecurityTest}.
 */
class GameSessionSecurityTest {

    @Test
    void shouldHideEnemyShipCellsOutsideGameOver() {
        GameSession session = new GameSession();
        session.reset(new ResetGameRequest(10, List.of(2, 2, 2, 2, 2), 4, false, 4, "lobby-x"));
        session.placeShip(new PlaceShipRequest(2, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));

        GameStateResponse playerOneView = session.getStateForPlayer(1);
        var playerTwoBoard = playerOneView.boards().get(1);
        assertEquals(CellViewState.EMPTY, playerTwoBoard.cells().get(0).get(0));
        assertEquals(CellViewState.EMPTY, playerTwoBoard.cells().get(0).get(1));
    }

    @Test
    void shouldExposePlacedShipTypesOnlyForViewer() {
        GameSession session = new GameSession();
        session.reset(new ResetGameRequest(10, List.of(2, 2, 2, 2, 2), 2, false, 2, "lobby-x"));
        session.placeShip(new PlaceShipRequest(1, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));
        session.placeShip(new PlaceShipRequest(2, "SHIP_0", 0, 0, "HORIZONTAL", "lobby-x"));

        GameStateResponse playerOneView = session.getStateForPlayer(1);
        assertEquals(1, playerOneView.placedShipTypesByPlayer().get(0).size());
        assertEquals(0, playerOneView.placedShipTypesByPlayer().get(1).size());
    }
}
