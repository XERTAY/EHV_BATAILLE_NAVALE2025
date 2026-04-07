package com.ehv.battleship.model;

import java.util.List;
import java.io.Serializable;

public class Player implements Serializable {

    private static final long serialVersionUID = 1L;

    private static int nextId = 1;
    private final int id;
    private final String name;
    private final Grid grid;
    private final Fleet fleet;
    private boolean ready;


    // Constructeur pour joueur humain
    // constructeur simple
public Player(String name, int gridSize) {
    this(name, gridSize, null);
}

// constructeur avec flotte personnalisée
public Player(String name, int gridSize, List<Integer> fleetShipSizes) {
    this.id = nextId++;
    this.name = name;
    this.grid = new Grid(gridSize);
    this.fleet = (fleetShipSizes == null) ? new Fleet() : new Fleet(fleetShipSizes);
    this.ready = false;
}

    public int getId() {
        return id;
    }

    public static void ensureNextIdAtLeast(int minimumNextId) {
        if (minimumNextId > nextId) {
            nextId = minimumNextId;
        }
    }

    public String getName() {
        return name;
    }

    public Grid getGrid() {
        return grid;
    }

    public Fleet getFleet() {
        return fleet;
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public boolean hasLost() {
        return fleet.areAllShipsSunk();
    }

    /**
     * Indique si ce joueur est une IA
     * @return true si c'est une IA, false si c'est un joueur humain
     */
    public boolean isAI() {
        return false;
    }

    
    
}


