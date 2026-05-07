package com.ehv.api.controller;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.ehv.api.config.GameSessionManager;
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
import com.ehv.api.view.DuelPhase;

@RestController
@RequestMapping("/api")
public class GameController {
    private static final Logger LOG = LoggerFactory.getLogger(GameController.class);
    private final LobbyGameRegistry lobbyGameRegistry;
    private final GameWebSocketHandler gameWebSocketHandler;
    private final LobbyJwtService lobbyJwtService;
    private final GameSessionManager gameSessionManager;
    private final boolean localDebugEndpointsEnabled;

    public GameController(
            LobbyGameRegistry lobbyGameRegistry,
            GameWebSocketHandler gameWebSocketHandler,
            LobbyJwtService lobbyJwtService,
            GameSessionManager gameSessionManager,
            @Value("${app.security.local-debug-endpoints-enabled:false}") boolean localDebugEndpointsEnabled) {
        this.lobbyGameRegistry = lobbyGameRegistry;
        this.gameWebSocketHandler = gameWebSocketHandler;
        this.lobbyJwtService = lobbyJwtService;
        this.gameSessionManager = gameSessionManager;
        this.localDebugEndpointsEnabled = localDebugEndpointsEnabled;
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

    private void notifyGameplayEvents(String gameId, ActionResponse response) {
        if (!hasLobbyGameId(gameId) || response == null || response.state() == null) {
            return;
        }
        Integer shooter = response.shooter();
        Integer targetPlayer = response.targetPlayer();
        if (shooter != null && targetPlayer != null) {
            Map<String, Object> targetLockedEvent = new LinkedHashMap<>();
            targetLockedEvent.put("type", "TARGET_LOCKED");
            targetLockedEvent.put("shooter", shooter);
            targetLockedEvent.put("targetPlayer", targetPlayer);
            gameWebSocketHandler.notifyLobbyGameplayEvent(gameId, targetLockedEvent);
        }
        if (shooter != null && targetPlayer != null && response.shotX() != null && response.shotY() != null) {
            Map<String, Object> shotResolvedEvent = new LinkedHashMap<>();
            shotResolvedEvent.put("type", "SHOT_RESOLVED");
            shotResolvedEvent.put("shooter", shooter);
            shotResolvedEvent.put("targetPlayer", targetPlayer);
            shotResolvedEvent.put("x", response.shotX());
            shotResolvedEvent.put("y", response.shotY());
            shotResolvedEvent.put("result", response.result() != null ? response.result().name() : null);
            shotResolvedEvent.put("nextPlayer", response.state().currentPlayer());
            shotResolvedEvent.put("currentTargetPlayer", response.state().currentTargetPlayer());
            shotResolvedEvent.put("phase", response.state().phase() != null ? response.state().phase().name() : null);
            gameWebSocketHandler.notifyLobbyGameplayEventForPlayers(gameId, shotResolvedEvent, Set.of(shooter, targetPlayer));

            Map<String, Object> peerShotEvent = new LinkedHashMap<>();
            peerShotEvent.put("type", "PEER_SHOT");
            peerShotEvent.put("shooter", shooter);
            peerShotEvent.put("targetPlayer", targetPlayer);
            peerShotEvent.put("nextPlayer", response.state().currentPlayer());
            peerShotEvent.put("phase", response.state().phase() != null ? response.state().phase().name() : null);
            gameWebSocketHandler.notifyLobbyGameplayEvent(gameId, peerShotEvent);
        }
        String phaseStep = response.state().phase() == DuelPhase.BATTLE
            ? (response.state().currentTargetPlayer() == null ? "target_selection" : "firing")
            : "resolving";
        Map<String, Object> turnPhaseChangedEvent = new LinkedHashMap<>();
        turnPhaseChangedEvent.put("type", "TURN_PHASE_CHANGED");
        turnPhaseChangedEvent.put("turnPlayer", response.state().currentPlayer());
        turnPhaseChangedEvent.put("phaseStep", phaseStep);
        turnPhaseChangedEvent.put("currentTargetPlayer", response.state().currentTargetPlayer());
        gameWebSocketHandler.notifyLobbyGameplayEvent(gameId, turnPhaseChangedEvent);
    }

    private String requireGameScope(String gameId) {
        if (!hasLobbyGameId(gameId)) {
            throw new IllegalArgumentException("gameId est requis pour cette action.");
        }
        return gameId;
    }

    private String requireLobbyAuthorizationIfScoped(String authorizationHeader, String gameId, Integer player) {
        if (!hasLobbyGameId(gameId)) {
            return null;
        }
        String token = parseBearerToken(authorizationHeader);
        if (!lobbyJwtService.isValidForLobby(token, gameId, player)) {
            LOG.warn("AUTH_DENIED gameId={} expectedPlayer={}", gameId, player);
            throw new IllegalArgumentException("Unauthorized lobby access token.");
        }
        return token;
    }

    private int requireAuthorizedPlayer(String authorizationHeader, String gameId) {
        String requiredGameId = requireGameScope(gameId);
        String token = requireLobbyAuthorizationIfScoped(authorizationHeader, requiredGameId, null);
        Integer player = lobbyJwtService.resolvePlayerIfValid(token, gameId);
        if (player == null) {
            LOG.warn("AUTH_PLAYER_RESOLVE_FAILED gameId={}", gameId);
            throw new IllegalArgumentException("Unauthorized lobby access token.");
        }
        return player;
    }

    private void requireHostAuthorization(String authorizationHeader, String gameId) {
        String requiredGameId = requireGameScope(gameId);
        int authorizedPlayer = requireAuthorizedPlayer(authorizationHeader, requiredGameId);
        if (!gameSessionManager.isHostPlayer(requiredGameId, authorizedPlayer)) {
            LOG.warn("HOST_AUTH_DENIED gameId={} player={}", requiredGameId, authorizedPlayer);
            throw new IllegalArgumentException("Action reservee a l'hote de la partie.");
        }
    }

    private void ensureLocalDebugEndpointsEnabled() {
        if (!localDebugEndpointsEnabled) {
            throw new IllegalArgumentException("Cet endpoint local est desactive.");
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
        requireHostAuthorization(authorizationHeader, scope);
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
        requireLobbyAuthorizationIfScoped(authorizationHeader, gameId, player);
        return game(gameId).getStateForPlayer(player);
    }

    @PostMapping("/game/place")
    public ActionResponse place(
            @RequestBody PlaceShipRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        int authorizedPlayer = requireAuthorizedPlayer(authorizationHeader, request.gameId());
        PlaceShipRequest sanitizedRequest = new PlaceShipRequest(
            authorizedPlayer, request.shipType(), request.x(), request.y(), request.orientation(), request.gameId());
        ActionResponse response = game(request.gameId()).placeShip(sanitizedRequest);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/remove")
    public ActionResponse removeShip(
            @RequestBody RemoveShipRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        int authorizedPlayer = requireAuthorizedPlayer(authorizationHeader, request.gameId());
        RemoveShipRequest sanitizedRequest = new RemoveShipRequest(
            authorizedPlayer, request.shipType(), request.x(), request.y(), request.gameId());
        ActionResponse response = game(request.gameId()).removePlacedShip(sanitizedRequest);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/placement/confirm")
    public ActionResponse confirmPlacement(
            @RequestBody ConfirmPlacementRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        int authorizedPlayer = requireAuthorizedPlayer(authorizationHeader, request.gameId());
        ConfirmPlacementRequest sanitizedRequest = new ConfirmPlacementRequest(authorizedPlayer, request.gameId());
        ActionResponse response = game(request.gameId()).confirmPlacement(sanitizedRequest);
        if (hasLobbyGameId(request.gameId())) {
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/auto-place")
    public GameStateResponse autoPlace() {
        ensureLocalDebugEndpointsEnabled();
        return game(null).autoPlaceFleetForBothPlayers();
    }

    @PostMapping("/game/fire")
    public ActionResponse fire(
            @RequestBody FireRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        int authorizedPlayer = requireAuthorizedPlayer(authorizationHeader, request.gameId());
        FireRequest sanitizedRequest = new FireRequest(
            authorizedPlayer, request.x(), request.y(), request.targetPlayer(), request.gameId());
        ActionResponse response = game(request.gameId()).fireAt(sanitizedRequest);
        if (hasLobbyGameId(request.gameId())) {
            notifyGameplayEvents(request.gameId(), response);
            gameWebSocketHandler.notifyLobbyGameSync(request.gameId());
        }
        return response;
    }

    @PostMapping("/game/ai-step")
    public ActionResponse aiStep(
            @RequestParam(value = "gameId", required = false) String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        requireHostAuthorization(authorizationHeader, gameId);
        ActionResponse action = game(gameId).advanceAiSingleStepAndGetAction();
        if (hasLobbyGameId(gameId)) {
            notifyGameplayEvents(gameId, action);
            gameWebSocketHandler.notifyLobbyGameSync(gameId);
        }
        return action;
    }

    @GetMapping("/game/saves")
    public List<String> saves() {
        ensureLocalDebugEndpointsEnabled();
        return game(null).listSaveFiles();
    }

    @PostMapping("/game/load")
    public GameStateResponse load(@RequestParam(value = "file", defaultValue = "bataille-navale") String fileName) {
        ensureLocalDebugEndpointsEnabled();
        return game(null).loadGame(fileName);
    }

    @PostMapping("/game/save")
    public GameStateResponse save(@RequestParam(value = "file", defaultValue = "bataille-navale") String fileName) {
        ensureLocalDebugEndpointsEnabled();
        return game(null).saveGame(fileName);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse(exception.getMessage()));
    }
}
