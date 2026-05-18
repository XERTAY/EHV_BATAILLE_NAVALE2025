package com.ehv.api.session;

import java.io.IOException;
import java.util.List;

import com.ehv.api.dto.ConfirmPlacementRequest;
import com.ehv.api.dto.FireRequest;
import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.dto.RemoveShipRequest;
import com.ehv.api.dto.ResetGameRequest;
import com.ehv.api.presentation.ApiActionPresenter;
import com.ehv.api.presentation.ApiGameStatePresenter;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.GameStateResponse;
import com.ehv.api.view.SaveGameResponse;
import com.ehv.battleship.legacy.controller.GameController;
import com.ehv.battleship.legacy.controller.GameController.AiStepOutcome;
import com.ehv.battleship.legacy.controller.GameController.ShotOutcome;

/**
 * Façade API d'une partie. Une instance encapsule un unique {@link GameController}
 * (cœur métier MVC) et expose des méthodes thread-safe consommées par les contrôleurs
 * HTTP / WebSocket.
 *
 * <p>Aucune règle de jeu n'est implémentée ici : la session se contente de :
 * <ul>
 *   <li>sérialiser les accès (verrou monitor),</li>
 *   <li>déléguer au {@link GameController},</li>
 *   <li>projeter le résultat via les {@code com.ehv.api.presentation} presenters.</li>
 * </ul>
 */
public final class GameSession {

    private static final List<Integer> DEFAULT_FLEET = List.of(5, 4, 3, 3, 2);
    private static final int DEFAULT_BOARD_SIZE = 10;

    private final GameController controller = new GameController();

    public GameSession() {
        // Le contrôleur s'initialise sur la configuration par défaut.
    }

    // ---------------------------------------------------------------------
    // Réinitialisation
    // ---------------------------------------------------------------------

    public synchronized GameStateResponse resetDefaults() {
        controller.reset(DEFAULT_BOARD_SIZE, DEFAULT_FLEET, null, false, null);
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized GameStateResponse reset(ResetGameRequest request) {
        if (request == null
                || request.boardSize() <= 0
                || request.fleetShipSizes() == null
                || request.fleetShipSizes().isEmpty()) {
            return resetDefaults();
        }
        controller.reset(
            request.boardSize(),
            request.fleetShipSizes(),
            request.playerCount(),
            request.withAI(),
            request.humanPlayers()
        );
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized GameStateResponse autoPlaceFleet() {
        controller.autoPlaceFleetForAllPlayers();
        return getStateForPlayer(viewSlotForClients());
    }

    // ---------------------------------------------------------------------
    // Placement
    // ---------------------------------------------------------------------

    public synchronized ActionResponse placeShip(PlaceShipRequest request) {
        controller.placeShipForPlayer(
            request.player(),
            request.shipType(),
            request.x(),
            request.y(),
            request.orientation()
        );
        return ApiActionPresenter.placed(controller, request.player());
    }

    public synchronized ActionResponse removePlacedShip(RemoveShipRequest request) {
        controller.removeShipForPlayer(
            request.player(),
            request.shipType(),
            request.x(),
            request.y()
        );
        return ApiActionPresenter.removed(controller, request.player());
    }

    public synchronized ActionResponse confirmPlacement(ConfirmPlacementRequest request) {
        controller.confirmPlacementForPlayer(request.player());
        return ApiActionPresenter.confirmed(controller, request.player());
    }

    // ---------------------------------------------------------------------
    // Bataille
    // ---------------------------------------------------------------------

    public synchronized ActionResponse fireAt(FireRequest request) {
        ShotOutcome outcome = controller.fireAt(
            request.player(),
            request.x(),
            request.y(),
            request.targetPlayer()
        );
        return ApiActionPresenter.shot(controller, request.player(), outcome);
    }

    /** Renvoie l'état après progression (ne tire pas) — utilisé par certains scénarios. */
    public synchronized GameStateResponse advanceAiSingleStepAndGetState() {
        controller.advanceAiSingleStep();
        return getStateForPlayer(viewSlotForClients());
    }

    /** Avance et renvoie l'action effectuée (ou MISS neutre si rien à faire). */
    public synchronized ActionResponse advanceAiSingleStepAndGetAction() {
        AiStepOutcome step = controller.advanceAiSingleStep();
        if (step == null || !step.hasShot()) {
            return ApiActionPresenter.aiSkipped(controller, viewSlotForClients());
        }
        return ApiActionPresenter.shot(controller, viewSlotForClients(), step.shot());
    }

    // ---------------------------------------------------------------------
    // Forfait
    // ---------------------------------------------------------------------

    public synchronized GameStateResponse forfeitPlayer(int forfeitingPlayer) {
        controller.forfeitPlayer(forfeitingPlayer);
        return getStateForPlayer(viewSlotForClients());
    }

    // ---------------------------------------------------------------------
    // Lecture / persistance
    // ---------------------------------------------------------------------

    public synchronized GameStateResponse getStateForPlayer(int player) {
        controller.advanceUntilHumanOrTerminal();
        return ApiGameStatePresenter.project(controller, player);
    }

    public synchronized List<String> listSaveFiles() {
        return controller.listSaveFiles();
    }

    public synchronized GameStateResponse loadGame(String fileName) {
        try {
            controller.loadAndAttachGame(fileName);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Erreur de chargement: " + exception.getMessage());
        }
        return getStateForPlayer(viewSlotForClients());
    }

    public synchronized SaveGameResponse saveGame(String fileName) {
        try {
            controller.saveGame(fileName);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Erreur de sauvegarde: " + exception.getMessage());
        }
        String normalized = normalizeSaveFileName(fileName);
        String content = controller.exportSnapshotJson();
        GameStateResponse state = getStateForPlayer(viewSlotForClients());
        return new SaveGameResponse(state, normalized, content);
    }

    public synchronized GameStateResponse loadGameFromContent(String json) {
        controller.loadFromSnapshotJson(json);
        return getStateForPlayer(viewSlotForClients());
    }

    private static String normalizeSaveFileName(String fileName) {
        String trimmed = fileName == null ? "" : fileName.trim();
        if (trimmed.isEmpty()) {
            trimmed = "bataille-navale";
        }
        return trimmed.endsWith(".save") ? trimmed : trimmed + ".save";
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /** Premier humain encore en jeu (hotseat sur poste unique). */
    private int viewSlotForClients() {
        int humans = controller.getHumanSlots();
        int playerCount = controller.getPlayerCount();
        for (int p = 1; p <= Math.min(humans, playerCount); p++) {
            if (!controller.getPlayerByNumber(p).hasLost()) {
                return p;
            }
        }
        return 1;
    }
}
