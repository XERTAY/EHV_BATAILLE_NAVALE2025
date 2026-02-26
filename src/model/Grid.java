package com.ehv.battleship.model;

import java.util.ArrayList;
import java.util.List;
import java.io.Serializable;

public class Grid implements Serializable {

    private static final long serialVersionUID = 1L;

    private final int size;
    private final Cell[][] cells;

    public Grid(int size) {
        this.size = size;
        this.cells = new Cell[size][size];
        initializeEmpty();
    }

    private void initializeEmpty() {
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                Coordinate coordinate = new Coordinate(x, y);
                cells[y][x] = new Cell(coordinate, CellStatus.EMPTY);
            }
        }
    }

    public int getSize() {
        return size;
    }

    public String toTargetViewString() {
        StringBuilder sb = new StringBuilder();

        sb.append("     ");
        for (int col = 1; col <= size; col++) {
            sb.append(col);
            if (col < size) {
                sb.append(" ");
            }
        }
        sb.append(System.lineSeparator());

        for (int rowDisplay = 1; rowDisplay <= size; rowDisplay++) {
            int y = rowDisplay - 1;

            if (rowDisplay < 10) {
                sb.append(rowDisplay).append("  | ");
            } else {
                sb.append(rowDisplay).append(" | ");
            }

            for (int x = 0; x < size; x++) {
                CellStatus status = cells[y][x].getStatus();
                char symbol;

                if (status == CellStatus.HIT || status == CellStatus.SUNK) {
                    symbol = 'X';
                } else if (status == CellStatus.MISS) {
                    symbol = '?';
                } else {
                    symbol = 'O';
                }

                sb.append(symbol);
                if (x < size - 1) {
                    sb.append(" ");
                }
            }

            if (rowDisplay < size) {
                sb.append(System.lineSeparator());
            }
        }

        return sb.toString();
    }

    public CellStatus getCell(Coordinate coordinate) {
        if (!coordinate.isValid(size)) {
            throw new IllegalArgumentException("Coordonnée invalide : " + coordinate);
        }
        return cells[coordinate.getY()][coordinate.getX()].getStatus();
    }

    public void setCell(Coordinate coordinate, CellStatus status) {
        if (!coordinate.isValid(size)) {
            throw new IllegalArgumentException("Coordonnée invalide : " + coordinate);
        }
        cells[coordinate.getY()][coordinate.getX()].setStatus(status);
    }

    public boolean isValidCoordinate(Coordinate coordinate) {
        return coordinate.isValid(size);
    }

    /**
     * Vérifie si un navire peut être placé à partir d'une coordonnée
     * @param startCoordinate Coordonnée de départ
     * @param size Taille du navire
     * @param orientation Orientation du navire
     * @return true si le placement est valide, false sinon
     */
    public boolean canPlaceShip(Coordinate startCoordinate, int size, ShipOrientation orientation) {
        if (!isValidCoordinate(startCoordinate)) {
            return false;
        }
        
        // Calculer toutes les coordonnées que le navire occuperait
        for (int i = 0; i < size; i++) {
            Coordinate coord;
            switch (orientation) {
                case HORIZONTAL:
                    coord = startCoordinate.add(i, 0);
                    break;
                case HORIZONTAL_LEFT:
                    coord = startCoordinate.add(-i, 0);
                    break;
                case VERTICAL:
                    coord = startCoordinate.add(0, i);
                    break;
                case VERTICAL_UP:
                    coord = startCoordinate.add(0, -i);
                    break;
                default:
                    return false;
            }
            
            // Vérifier que la coordonnée est valide
            if (!isValidCoordinate(coord)) {
                return false;
            }
            
            // Vérifier que la cellule n'est pas déjà occupée par un navire
            if (getCell(coord) == CellStatus.SHIP) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Place un navire sur la grille
     * @param ship Le navire à placer
     * @throws IllegalArgumentException si le placement n'est pas valide
     */
    public void placeShip(Ship ship) {
        List<Coordinate> coordinates = ship.getCoordinates();
        for (Coordinate coord : coordinates) {
            if (!isValidCoordinate(coord)) {
                throw new IllegalArgumentException("Coordonnée invalide pour le navire : " + coord);
            }
            if (getCell(coord) == CellStatus.SHIP) {
                throw new IllegalArgumentException("Un navire occupe déjà cette position : " + coord);
            }
            setCell(coord, CellStatus.SHIP);
        }
    }

    /**
     * Génère la liste des coordonnées pour un navire à partir d'une position de départ
     * @param startCoordinate Coordonnée de départ
     * @param size Taille du navire
     * @param orientation Orientation du navire
     * @return Liste des coordonnées du navire
     */
    public List<Coordinate> generateShipCoordinates(Coordinate startCoordinate, int size, ShipOrientation orientation) {
        List<Coordinate> coordinates = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            Coordinate coord;
            switch (orientation) {
                case HORIZONTAL:
                    coord = startCoordinate.add(i, 0);
                    break;
                case HORIZONTAL_LEFT:
                    coord = startCoordinate.add(-i, 0);
                    break;
                case VERTICAL:
                    coord = startCoordinate.add(0, i);
                    break;
                case VERTICAL_UP:
                    coord = startCoordinate.add(0, -i);
                    break;
                default:
                    throw new IllegalArgumentException("Orientation non supportée : " + orientation);
            }
            coordinates.add(coord);
        }
        return coordinates;
    }
}


