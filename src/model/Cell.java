package com.ehv.battleship.model;

public class Cell {

    private final Coordinate coordinate;
    private CellStatus status;

    public Cell(Coordinate coordinate, CellStatus status) {
        this.coordinate = coordinate;
        this.status = status;
    }

    public Coordinate getCoordinate() {
        return coordinate;
    }

    public CellStatus getStatus() {
        return status;
    }

    public void setStatus(CellStatus status) {
        this.status = status;
    }
}


