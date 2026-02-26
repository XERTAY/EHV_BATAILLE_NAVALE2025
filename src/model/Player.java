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
    private final AI ai; // null = joueur humain, non-null = IA

    // Constructeur pour joueur humain
    public Player(String name, int gridSize) {
        this(name, gridSize, null, null);
    }

    // Constructeur pour joueur humain avec flotte personnalisée
    public Player(String name, int gridSize, List<Integer> fleetShipSizes) {
        this(name, gridSize, null, fleetShipSizes);
    }

    // Constructeur pour joueur IA
    public Player(String name, int gridSize, AI ai) {
        this(name, gridSize, ai, null);
    }

    // Constructeur complet (IA optionnelle + flotte personnalisée)
    public Player(String name, int gridSize, AI ai, List<Integer> fleetShipSizes) {
        this.id = nextId++;
        this.name = name;
        this.grid = new Grid(gridSize);
        if (fleetShipSizes == null) {
            this.fleet = new Fleet();
        } else {
            this.fleet = new Fleet(fleetShipSizes);
        }
        this.ready = false;
        this.ai = ai;
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
        return ai != null;
    }

    /**
     * Retourne le composant IA du joueur
     * @return L'objet AI si c'est une IA, null sinon
     */
    public AI getAI() {
        return ai;
    }
}


