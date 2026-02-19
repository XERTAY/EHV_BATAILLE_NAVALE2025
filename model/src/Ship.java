package com.ehv.bataillenavale.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class Ship {
    private final String name;
    private final int size;
    private final List<Coordinate> positions;

    public Ship(String name, int size, List<Coordinate> positions) {
        this.name = name;
        this.size = size;
        this.positions = new ArrayList<>(positions);
    }

    public String getName() {
        return name;
    }

    public int getSize() {
        return size;
    }

    public List<Coordinate> getPositions() {
        return Collections.unmodifiableList(positions);
    }
}
