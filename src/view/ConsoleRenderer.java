package com.ehv.battleship.view;

import com.ehv.battleship.model.CellStatus;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Grid;
import com.ehv.battleship.model.Player;

import java.util.List;

public class ConsoleRenderer {

    public String renderTargetGrid(Grid grid) {
        if (grid == null) {
            throw new IllegalArgumentException("La grille ne peut pas être nulle");
        }
        return grid.toTargetViewString();
    }

    public String renderPlayerTurn(Player current, Player target) {
        StringBuilder sb = new StringBuilder();
        sb.append(System.lineSeparator());
        sb.append("----- Tour de ").append(current.getName()).append(" -----")
                .append(System.lineSeparator());
        sb.append("Grille de tir vers ").append(target.getName()).append(" :")
                .append(System.lineSeparator());
        sb.append(renderTargetGrid(target.getGrid()));
        return sb.toString();
    }

    public String renderAllTargetViews(Game game) {
        StringBuilder sb = new StringBuilder();
        List<Player> players = game.getPlayers();

        // Afficher les grilles de tir de chaque joueur vers ses adversaires
        for (int i = 0; i < players.size(); i++) {
            Player player = players.get(i);
            List<Player> opponents = game.getOpponents(player);

            for (Player opponent : opponents) {
                sb.append("Grille de tir de ")
                        .append(player.getName())
                        .append(" vers ")
                        .append(opponent.getName())
                        .append(" :")
                        .append(System.lineSeparator());
                sb.append(renderTargetGrid(opponent.getGrid()))
                        .append(System.lineSeparator())
                        .append(System.lineSeparator());
            }
        }

        // Retirer les deux derniers lineSeparator
        if (sb.length() > 0) {
            sb.setLength(sb.length() - System.lineSeparator().length() * 2);
        }

        return sb.toString();
    }

    // Affiche la grille du joueur avec ses navires (S = navire, ~ = eau)
    public String renderPlayerGrid(Grid grid) {
        if (grid == null) {
            throw new IllegalArgumentException("La grille ne peut pas être nulle");
        }
        
        StringBuilder sb = new StringBuilder();
        int size = grid.getSize();
        
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
                Coordinate coord = new Coordinate(x, y);
                CellStatus status = grid.getCell(coord);
                char symbol;
                
                switch (status) {
                    case SHIP:
                        symbol = 'S';
                        break;
                    case HIT:
                        symbol = 'X';
                        break;
                    case MISS:
                        symbol = '?';
                        break;
                    case SUNK:
                        symbol = '#';
                        break;
                    default:
                        symbol = '~';
                        break;
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
}


