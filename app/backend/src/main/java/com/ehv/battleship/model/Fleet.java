package com.ehv.battleship.model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.io.Serializable;

public class Fleet implements Serializable {

    private static final long serialVersionUID = 1L;

    private final List<Ship> ships = new ArrayList<>();
    private final List<Integer> requiredSizes;

    public Fleet() {
        this(Arrays.asList(5, 4, 3, 3, 2));
    }

    public Fleet(List<Integer> requiredSizes) {
        if (requiredSizes == null || requiredSizes.isEmpty()) {
            throw new IllegalArgumentException("La flotte doit contenir au moins un navire");
        }

        this.requiredSizes = new ArrayList<>();
        for (Integer size : requiredSizes) {
            if (size == null || size <= 0) {
                throw new IllegalArgumentException("Chaque taille de navire doit être un entier positif");
            }
            this.requiredSizes.add(size);
        }
    }

    public List<Ship> getShips() {
        return Collections.unmodifiableList(ships);
    }

    public void addShip(Ship ship) {
        ships.add(ship);
    }

    public List<Integer> getRequiredSizes() {
        return Collections.unmodifiableList(requiredSizes);
    }

    // Flotte requise configurable
    public boolean isComplete() {
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


