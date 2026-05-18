package com.ehv.api.presentation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ehv.api.view.BoardStateView;
import com.ehv.api.view.CellViewState;
import com.ehv.api.view.DuelPhase;
import com.ehv.api.view.GameStateResponse;
import com.ehv.battleship.legacy.controller.GameController;

class ApiGameStatePresenterTest {

    @Test
    void shouldProjectPlacementPhaseAndHideEnemies() {
        GameController controller = new GameController();
        controller.reset(8, List.of(2, 2), 2, false, 2);
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(2, "SHIP_0", 0, 0, "HORIZONTAL");

        GameStateResponse view = ApiGameStatePresenter.project(controller, 1);
        assertEquals(DuelPhase.PLACEMENT, view.phase());
        assertEquals(8, view.boardSize());

        // Plancher du joueur 1 : SHIP visible.
        BoardStateView own = view.boards().get(0);
        assertEquals(CellViewState.SHIP, own.cells().get(0).get(0));
        assertTrue(own.ownBoard());

        // Plancher du joueur 2 : adversaire => SHIP masqué.
        BoardStateView opponent = view.boards().get(1);
        assertEquals(CellViewState.EMPTY, opponent.cells().get(0).get(0));
    }

    @Test
    void shouldExposeWinnerAfterForfeit() {
        GameController controller = new GameController();
        controller.reset(6, List.of(1), 2, false, 2);
        controller.autoPlaceFleetForAllPlayers();
        controller.forfeitPlayer(1);
        GameStateResponse view = ApiGameStatePresenter.project(controller, 2);
        assertEquals(DuelPhase.GAME_OVER, view.phase());
        assertNotNull(view.winner());
        assertEquals(2, view.winner());
    }

    @Test
    void shouldMapBoardIdentifiers() {
        assertEquals("A1", ApiGameStatePresenter.boardIdForPlayer(1));
        assertEquals("B1", ApiGameStatePresenter.boardIdForPlayer(2));
        assertEquals("C1", ApiGameStatePresenter.boardIdForPlayer(3));
        assertEquals("D1", ApiGameStatePresenter.boardIdForPlayer(4));
    }
}
