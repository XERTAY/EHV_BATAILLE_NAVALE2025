package com.ehv.battleship.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Ship {

    private final String id;
    private final String name;
    private final int size;
    private final List<Coordinate> coordinates;
    private final ShipOrientation orientation;
    private boolean sunk;

    public Ship(String id, String name, int size, List<Coordinate> coordinates, ShipOrientation orientation) {
        this.id = id;
        this.name = name;
        this.size = size;
        this.coordinates = new ArrayList<>(coordinates);
        this.orientation = orientation;
        this.sunk = false;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getSize() {
        return size;
    }

    public List<Coordinate> getCoordinates() {
        return Collections.unmodifiableList(coordinates);
    }

    public ShipOrientation getOrientation() {
        return orientation;
    }

    public boolean isSunk() {
        return sunk;
    }

    public void setSunk(boolean sunk) {
        this.sunk = sunk;
    }
}


