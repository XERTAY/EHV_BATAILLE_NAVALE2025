package com.ehv.battleship.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Fleet {

    private final List<Ship> ships = new ArrayList<>();

    public List<Ship> getShips() {
        return Collections.unmodifiableList(ships);
    }

    public void addShip(Ship ship) {
        ships.add(ship);
    }

    public boolean isComplete() {
        throw new UnsupportedOperationException("TODO: implémenter isComplete()");
    }

    public boolean areAllShipsSunk() {
        for (Ship ship : ships) {
            if (!ship.isSunk()) {
                return false;
            }
        }
        return !ships.isEmpty();
    }
}


