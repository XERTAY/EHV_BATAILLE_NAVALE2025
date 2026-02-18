package com.ehv.bataillenavale.backend;

import com.ehv.bataillenavale.model.Game;
import com.ehv.bataillenavale.model.ShotResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameController {
    private final Game game = new Game(10);

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    @GetMapping("/shoot")
    public ShotResult shoot(@RequestParam int row, @RequestParam int col) {
        return game.shootAt(new com.ehv.bataillenavale.model.Coordinate(row, col));
    }
}
