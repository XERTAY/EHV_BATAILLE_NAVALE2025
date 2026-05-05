package com.ehv.api.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ehv.api.config.GameWebSocketHandler;
import com.ehv.api.dto.FireRequest;
import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.dto.ConfirmPlacementRequest;
import com.ehv.api.dto.RemoveShipRequest;
import com.ehv.api.dto.ResetGameRequest;
import com.ehv.api.service.DuelGameService;
import com.ehv.api.service.LobbyGameRegistry;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ErrorResponse;
import com.ehv.api.view.GameStateResponse;

@RestController
@RequestMapping("/api")
public class GameController {
    private final LobbyGameRegistry lobbyGameRegistry;
    private final GameWebSocketHandler gameWebSocketHandler;

    public GameController(LobbyGameRegistry lobbyGameRegistry, GameWebSocketHandler gameWebSocketHandler) {
        this.lobbyGameRegistry = lobbyGameRegistry;
        this.gameWebSocketHandler = gameWebSocketHandler;
    }

    private DuelGameService game(String lobbyGameId) {
        return lobbyGameRegistry.forLobbyOrLocal(lobbyGameId);
    }

    private static boolean hasLobbyGameId(String gameId) {
        return gameId != null && !gameId.isBlank();
    }

    private static String lobbyScopeFromReset(ResetGameRequest request) {
        return request == null ? null : request.gameId();
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    @PostMapping("/game/reset")
    public GameStateResponse reset(@RequestBody(required = false) ResetGameRequest request) {
        String scope = lobbyScopeFromReset(request);
        if (request != null && request.boardSize() > 0 && request.fleetShipSizes() != null && !request.fleetShipSizes().isEmpty()) {
            return game(scope).resetAndGetState(
                request.boardSize(),
                request.fleetShipSizes(),
                request.playerCount(),
                request.withAI(),
                request.humanPlayers()
            );
        }
        return game(scope).resetAndGetState();
    }

    @GetMapping("/game/state")
    public GameStateResponse state(
            @RequestParam("player") int player,
            @RequestParam(value = "gameId", required = false) String gameId) {
        return game(gameId).getStateForPlayer(player);
    }

    @PostMapping("/game/place")
    public ActionResponse place(@RequestBody PlaceShipRequest request) {
        ActionResponse response = game(request.gameId()).placeShip(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/remove")
    public ActionResponse removeShip(@RequestBody RemoveShipRequest request) {
        ActionResponse response = game(request.gameId()).removePlacedShip(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/confirm")
    public ActionResponse confirmPlacement(@RequestBody ConfirmPlacementRequest request) {
        ActionResponse response = game(request.gameId()).confirmPlacement(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/auto-place")
    public GameStateResponse autoPlace() {
        return game(null).autoPlaceFleetForBothPlayers();
    }

    @PostMapping("/game/fire")
    public ActionResponse fire(@RequestBody FireRequest request) {
        ActionResponse response = game(request.gameId()).fireAt(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/ai-step")
    public GameStateResponse aiStep(@RequestParam(value = "gameId", required = false) String gameId) {
        GameStateResponse response = game(gameId).advanceAiSingleStepAndGetState();
        if (hasLobbyGameId(gameId)) {
            gameWebSocketHandler.notifyLobbyGameSync(gameId);
        }
        return response;
    }

    @GetMapping("/game/saves")
    public List<String> saves() {
        return game(null).listSaveFiles();
    }

    @PostMapping("/game/load")
    public GameStateResponse load(@RequestParam(value = "file", defaultValue = "bataille-navale") String fileName) {
        return game(null).loadGame(fileName);
    }

    @PostMapping("/game/save")
    public GameStateResponse save(@RequestParam(value = "file", defaultValue = "bataille-navale") String fileName) {
        return game(null).saveGame(fileName);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse(exception.getMessage()));
    }
}
