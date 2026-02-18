package com.ehv.bataillenavale.model;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class Board {
    private final int size;
    private final List<Ship> ships = new ArrayList<>();
    private final Set<Coordinate> shots = new HashSet<>();

    public Board(int size) {
        this.size = size;
    }

    public int getSize() {
        return size;
    }

    public List<Ship> getShips() {
        return List.copyOf(ships);
    }

    public Set<Coordinate> getShots() {
        return Set.copyOf(shots);
    }

    public void placeShip(Ship ship) {
        ships.add(ship);
    }

    public ShotResult receiveShot(Coordinate target) {
        shots.add(target);
        for (Ship ship : ships) {
            if (ship.getPositions().contains(target)) {
                boolean sunk = ship.getPositions().stream().allMatch(shots::contains);
                return sunk ? ShotResult.SUNK : ShotResult.HIT;
            }
        }
        return ShotResult.MISS;
    }
}
