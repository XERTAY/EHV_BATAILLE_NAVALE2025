package com.ehv.api.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ActionResult;
import com.ehv.api.view.DuelPhase;

/**
 * Reproduit le scénario lobby : session créée avant reset explicite, placement d'un navire.
 */
class GameSessionPlacementTest {

    @Test
    void shouldPlaceShipOnFreshSessionWithoutPriorReset() {
        GameSession session = new GameSession();
        ActionResponse response = session.placeShip(
            new PlaceShipRequest(1, "SHIP_0", 5, 3, "HORIZONTAL", null));
        assertNotNull(response);
        assertEquals(ActionResult.PLACED, response.result());
        assertEquals(DuelPhase.PLACEMENT, response.state().phase());
    }
}
