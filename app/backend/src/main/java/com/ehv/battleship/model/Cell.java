package com.ehv.battleship.model;

import java.io.Serializable;

public class Cell implements Serializable {

    private static final long serialVersionUID = 1L;

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


