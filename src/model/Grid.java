package com.ehv.battleship.model;

public class Grid {

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
}


