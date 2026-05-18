package com.ehv.battleship.legacy.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ehv.battleship.legacy.controller.GameController.ShotOutcome;
import com.ehv.battleship.model.GameState;

class GameControllerTest {

    private static final List<Integer> FLEET = List.of(2, 2);

    @Test
    void shouldAllowPlacementOnFreshGameWithoutExplicitReset() {
        GameController controller = new GameController();
        assertEquals(GameState.PLACEMENT, controller.getGameState());
        controller.placeShipForPlayer(1, "SHIP_0", 5, 3, "HORIZONTAL");
        assertTrue(controller.getPlacedShipTypes(1).contains("SHIP_0"));
    }

    @Test
    void shouldRejectPlacementOutsidePlacementPhase() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        // Place chaque navire pour les 2 joueurs => bascule en BATTLE
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(1, "SHIP_1", 0, 2, "HORIZONTAL");
        controller.confirmPlacementForPlayer(1);
        controller.placeShipForPlayer(2, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(2, "SHIP_1", 0, 2, "HORIZONTAL");
        controller.confirmPlacementForPlayer(2);
        assertEquals(GameState.PLAYING, controller.getGameState());

        assertThrows(IllegalArgumentException.class,
            () -> controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL"));
    }

    @Test
    void shouldRejectFireDuringPlacement() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        assertThrows(IllegalArgumentException.class,
            () -> controller.fireAt(1, 0, 0, 2));
    }

    @Test
    void shouldRejectFireWhenNotPlayersTurn() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.autoPlaceFleetForAllPlayers();
        // Le joueur 1 commence : le joueur 2 ne peut pas tirer.
        assertThrows(IllegalArgumentException.class,
            () -> controller.fireAt(2, 0, 0, 1));
    }

    @Test
    void shouldRejectSelfTargetingInDuel() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.autoPlaceFleetForAllPlayers();
        assertThrows(IllegalArgumentException.class,
            () -> controller.fireAt(1, 0, 0, 1));
    }

    @Test
    void shouldRejectRemovingShipNotPlaced() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        assertThrows(IllegalArgumentException.class,
            () -> controller.removeShipForPlayer(1, "SHIP_0", null, null));
    }

    @Test
    void shouldAllowRemovingPlacedShipBeforeLock() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        assertTrue(controller.getPlacedShipTypes(1).contains("SHIP_0"));
        controller.removeShipForPlayer(1, "SHIP_0", null, null);
        assertFalse(controller.getPlacedShipTypes(1).contains("SHIP_0"));
    }

    @Test
    void shouldLockPlacementAfterConfirm() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(1, "SHIP_1", 0, 2, "HORIZONTAL");
        controller.confirmPlacementForPlayer(1);
        assertTrue(controller.isPlacementLocked(1));
        assertThrows(IllegalArgumentException.class,
            () -> controller.removeShipForPlayer(1, "SHIP_0", null, null));
    }

    @Test
    void shouldRunFourPlayerLoopWithAi() {
        GameController controller = new GameController();
        // 4J avec 1 humain + 3 IA, flotte minimale 1 case.
        controller.reset(6, List.of(1), 4, true, 1);
        // Le joueur 1 (humain) doit placer son unique navire.
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.confirmPlacementForPlayer(1);
        // Les IA sont placées automatiquement via advanceUntilHumanOrTerminal => BATTLE.
        assertEquals(GameState.PLAYING, controller.getGameState());
        assertEquals(1, controller.getCurrentPlayerNumber());
    }

    @Test
    void shouldAutoPlaceAiAfterAllHumansConfirmInFourPlayerMixedGame() {
        GameController controller = new GameController();
        List<Integer> fleet = List.of(2, 2);
        controller.reset(6, fleet, 4, true, 2);

        for (int human = 1; human <= 2; human++) {
            controller.placeShipForPlayer(human, "SHIP_0", 0, 0, "HORIZONTAL");
            controller.placeShipForPlayer(human, "SHIP_1", 0, 2, "HORIZONTAL");
            controller.confirmPlacementForPlayer(human);
        }

        assertEquals(GameState.PLAYING, controller.getGameState());
        assertTrue(controller.isPlacementLocked(3));
        assertTrue(controller.isPlacementLocked(4));
        assertEquals(fleet.size(), controller.getPlacedShipTypes(3).size());
        assertEquals(fleet.size(), controller.getPlacedShipTypes(4).size());
    }

    @Test
    void shouldEndGameOnForfeit() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.autoPlaceFleetForAllPlayers();
        controller.forfeitPlayer(1);
        assertTrue(controller.isGameFinished());
        Integer winner = controller.getWinnerNumber();
        assertNotNull(winner);
        assertEquals(2, winner);
    }

    @Test
    void shouldReturnNullWinnerWhilePlaying() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.autoPlaceFleetForAllPlayers();
        assertNull(controller.getWinnerNumber());
    }

    @Test
    void shouldExposeAiSlotsCorrectly() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, true, 1);
        assertTrue(controller.isHumanSlot(1));
        assertTrue(controller.isAiSlot(2));
        assertFalse(controller.isHumanSlot(2));
    }

    @Test
    void shouldFireAndResolveMissHitSequence() {
        GameController controller = new GameController();
        controller.reset(6, FLEET, 2, false, 2);
        controller.placeShipForPlayer(1, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(1, "SHIP_1", 0, 2, "HORIZONTAL");
        controller.confirmPlacementForPlayer(1);
        controller.placeShipForPlayer(2, "SHIP_0", 0, 0, "HORIZONTAL");
        controller.placeShipForPlayer(2, "SHIP_1", 0, 2, "HORIZONTAL");
        controller.confirmPlacementForPlayer(2);
        // Joueur 1 tire en bas-droite : MISS attendu (case vide).
        ShotOutcome miss = controller.fireAt(1, 5, 5, 2);
        assertNotNull(miss);
        // Après un MISS, le tour passe au joueur 2.
        assertEquals(2, controller.getCurrentPlayerNumber());
    }
}
