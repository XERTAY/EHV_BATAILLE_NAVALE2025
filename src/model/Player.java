package com.ehv.battleship.model;

import java.util.UUID;

public class Player {

    private final int id;
    private final String name;
    private final Grid grid;
    private final Fleet fleet;
    private boolean ready;
    private final AI ai; // null = joueur humain, non-null = IA

    // Constructeur pour joueur humain
    public Player(String name, int gridSize) {
        this(name, gridSize, null);
    }

    // Constructeur pour joueur IA
    public Player(String name, int gridSize, AI ai) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.grid = new Grid(gridSize);
        this.fleet = new Fleet();
        this.ready = false;
        this.ai = ai;
    }

    public int getId() {
        return id;
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


