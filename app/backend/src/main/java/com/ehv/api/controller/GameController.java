package com.ehv.api.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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
import com.ehv.api.security.LobbyJwtService;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ErrorResponse;
import com.ehv.api.view.GameStateResponse;

@RestController
@RequestMapping("/api")
public class GameController {
    private final LobbyGameRegistry lobbyGameRegistry;
    private final GameWebSocketHandler gameWebSocketHandler;
    private final LobbyJwtService lobbyJwtService;

    public GameController(
            LobbyGameRegistry lobbyGameRegistry,
            GameWebSocketHandler gameWebSocketHandler,
            LobbyJwtService lobbyJwtService) {
        this.lobbyGameRegistry = lobbyGameRegistry;
        this.gameWebSocketHandler = gameWebSocketHandler;
        this.lobbyJwtService = lobbyJwtService;
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

    private static String parseBearerToken(String authorizationHeader) {
        if (authorizationHeader == null) {
            return null;
        }
        String value = authorizationHeader.trim();
        if (!value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = value.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    private void requireLobbyAuthorization(String authorizationHeader, String gameId, Integer player) {
        if (!hasLobbyGameId(gameId)) {
            return;
        }
        String token = parseBearerToken(authorizationHeader);
        if (!lobbyJwtService.isValidForLobby(token, gameId, player)) {
            throw new IllegalArgumentException("Unauthorized lobby access token.");
        }
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    @PostMapping("/game/reset")
    public GameStateResponse reset(
            @RequestBody(required = false) ResetGameRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        String scope = lobbyScopeFromReset(request);
        requireLobbyAuthorization(authorizationHeader, scope, null);
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
            @RequestParam(value = "gameId", required = false) String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, gameId, player);
        return game(gameId).getStateForPlayer(player);
    }

    @PostMapping("/game/place")
    public ActionResponse place(
            @RequestBody PlaceShipRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, request.gameId(), request.player());
        ActionResponse response = game(request.gameId()).placeShip(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/remove")
    public ActionResponse removeShip(
            @RequestBody RemoveShipRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, request.gameId(), request.player());
        ActionResponse response = game(request.gameId()).removePlacedShip(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/confirm")
    public ActionResponse confirmPlacement(
            @RequestBody ConfirmPlacementRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, request.gameId(), request.player());
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
    public ActionResponse fire(
            @RequestBody FireRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, request.gameId(), request.player());
        ActionResponse response = game(request.gameId()).fireAt(request);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/ai-step")
    public GameStateResponse aiStep(
            @RequestParam(value = "gameId", required = false) String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireLobbyAuthorization(authorizationHeader, gameId, null);
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
