package com.ehv.bataillenavale.model;

public final class Game {
    private final Board playerOneBoard;
    private final Board playerTwoBoard;
    private boolean playerOneTurn = true;

    public Game(int boardSize) {
        this.playerOneBoard = new Board(boardSize);
        this.playerTwoBoard = new Board(boardSize);
    }

    public Board getPlayerOneBoard() {
        return playerOneBoard;
    }

    public Board getPlayerTwoBoard() {
        return playerTwoBoard;
    }

    public boolean isPlayerOneTurn() {
        return playerOneTurn;
    }

    public ShotResult shootAt(Coordinate target) {
        Board targetBoard = playerOneTurn ? playerTwoBoard : playerOneBoard;
        ShotResult result = targetBoard.receiveShot(target);
        playerOneTurn = !playerOneTurn;
        return result;
    }
}
