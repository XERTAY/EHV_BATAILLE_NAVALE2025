package com.ehv.battleship.model;

/**
 * Tir choisi par une IA : numéro de joueur cible (1-based) et coordonnées sur la grille adverse.
 */
public record ShootDecision(int defenderNumber, Coordinate coordinate) {

    public ShootDecision {
        if (coordinate == null) {
            throw new IllegalArgumentException("coordinate ne peut pas etre null");
        }
        if (defenderNumber < 1) {
            throw new IllegalArgumentException("defenderNumber doit être >= 1");
        }
    }
}
