package com.ehv.battleship.view;

import com.ehv.battleship.controller.GameController;
import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.ShotResult;

import java.util.Arrays;
import java.util.List;
import java.util.Scanner;

public class ConsoleMain {

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        ConsoleRenderer renderer = new ConsoleRenderer();
        
        // Créer les joueurs : deux joueurs ( prochainement avec IA)

        List<Player> players = Arrays.asList(
            new Player("Joueur 1", 10),
            new Player("Joueur 2", 10)
            // new Player("IA", 10, new AI())
        );
        Game game = new Game(10, players);
        GameController controller = new GameController(game);
        int gridSize = controller.getGridSize();

        System.out.println("=== Bataille navale - Mode console ===");
        System.out.println("O = vide (jamais tiré), X = touché, ? = manqué");
        System.out.println("Entrez des coordonnées 'x y' (1-" + gridSize + ") ou 'q' pour quitter.");

        while (true) {
            Player current = controller.getCurrentPlayer();
            Player target = controller.getTargetPlayer();

            System.out.println(renderer.renderPlayerTurn(current, target));

            System.out.print("Coordonnées à tirer (x y) ou 'q' pour quitter : ");
            String line = scanner.nextLine().trim();

            if (line.equalsIgnoreCase("q")) {
                System.out.println("Vous avez quitté la partie.");
                break;
            }

            if (line.isEmpty()) {
                continue;
            }

            String[] parts = line.split("\\s+");
            if (parts.length != 2) {
                System.out.println("Format invalide. Utilisez : x y (ex: 3 5)");
                continue;
            }

            int xInput;
            int yInput;
            try {
                xInput = Integer.parseInt(parts[0]);
                yInput = Integer.parseInt(parts[1]);
            } catch (NumberFormatException e) {
                System.out.println("Coordonnées invalides. Utilisez des entiers (ex: 3 5).");
                continue;
            }

            if (!controller.isCoordinateInRange(xInput - 1, yInput - 1)) {
                System.out.println("Coordonnées hors de la grille. Valeurs entre 1 et " + gridSize + ".");
                continue;
            }

            ShotResult result = controller.playShot(xInput - 1, yInput - 1);

            switch (result) {
                case HIT:
                    System.out.println("HIT (TOUCHÉ) !");
                    break;
                case MISS:
                    System.out.println("MISS (MANQUÉ).");
                    break;
                case ALREADY_HIT:
                    System.out.println("Vous avez déjà tiré ici auparavant : HIT !");
                    System.out.println("Grille de tir (rappel) :");
                    System.out.println(renderer.renderTargetGrid(target.getGrid()));
                    continue;
                case ALREADY_MISS:
                    System.out.println("Vous avez déjà tiré ici auparavant : MISS.");
                    System.out.println("Grille de tir (rappel) :");
                    System.out.println(renderer.renderTargetGrid(target.getGrid()));
                    continue;
                default:
                    break;
            }

            System.out.println("Grille de tir mise à jour :");
            System.out.println(renderer.renderTargetGrid(target.getGrid()));

            controller.endTurn();
            System.out.println();
            System.out.println("§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§");
        }

        scanner.close();
    }
}



