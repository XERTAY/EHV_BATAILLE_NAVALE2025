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

    // Flotte standard : 5, 4, 3, 3, 2 cases
    public boolean isComplete() {
        int[] requiredSizes = {5, 4, 3, 3, 2};
        List<Integer> shipSizes = new ArrayList<>();
        
        for (Ship ship : ships) {
            shipSizes.add(ship.getSize());
        }
        
        // Vérifier navire
        for (int requiredSize : requiredSizes) {
            if (!shipSizes.contains(Integer.valueOf(requiredSize))) {
                return false; // Note: navire manquant
            }
            shipSizes.remove(Integer.valueOf(requiredSize)); // Note: retirer pour éviter les doublons
        }
        
        // Pas de navires en trop
        return shipSizes.isEmpty();
    }

    // Vérifie qu'il n'y a pas de chevauchement avec les navires existants
    public boolean canAddShip(Ship newShip) {
        List<Coordinate> newCoordinates = newShip.getCoordinates();
        
        for (Ship existingShip : ships) {
            for (Coordinate existingCoord : existingShip.getCoordinates()) {
                if (newCoordinates.contains(existingCoord)) {
                    return false;
                }
            }
        }
        
        return true;
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


