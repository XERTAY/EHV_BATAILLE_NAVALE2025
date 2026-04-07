package com.ehv.api.controller;

import com.ehv.api.dto.FireRequest;
import com.ehv.api.dto.PlaceShipRequest;
import com.ehv.api.service.DuelGameService;
import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ErrorResponse;
import com.ehv.api.view.GameStateResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameController {
    private final DuelGameService duelGameService = new DuelGameService();

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    @PostMapping("/game/reset")
    public GameStateResponse reset() {
        return duelGameService.resetAndGetState();
    }

    @GetMapping("/game/state")
    public GameStateResponse state(@RequestParam("player") int player) {
        return duelGameService.getStateForPlayer(player);
    }

    @PostMapping("/game/place")
    public ActionResponse place(@RequestBody PlaceShipRequest request) {
        return duelGameService.placeShip(request);
    }

    @PostMapping("/game/auto-place")
    public GameStateResponse autoPlace() {
        return duelGameService.autoPlaceFleetForBothPlayers();
    }

    @PostMapping("/game/fire")
    public ActionResponse fire(@RequestBody FireRequest request) {
        return duelGameService.fireAt(request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse(exception.getMessage()));
    }
}
