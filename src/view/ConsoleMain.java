package com.ehv.battleship.view;

import com.ehv.battleship.controller.GameController;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.ShotResult;

import java.util.List;
import java.util.Scanner;
import java.util.ArrayList;

public class ConsoleMain {

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        ConsoleRenderer renderer = new ConsoleRenderer();

        System.out.println("=== Bataille navale - Mode console ===");
        Game game;

        boolean loadExistingGame = askStartMode(scanner);
        if (loadExistingGame) {
            game = askLoadGame(scanner);
        } else {
            int gridSize = askGridSize(scanner);
            List<Integer> fleetShipSizes = askFleetConfiguration(scanner, gridSize);
            game = GameController.createNewGame(gridSize, fleetShipSizes);

            GameController placementController = new GameController(game);
            int configuredGridSize = placementController.getGridSize();

            placementController.startPlacementPhase();
            System.out.println("\n=== PHASE DE PLACEMENT ===");
            System.out.println("Vous devez placer vos navires (même flotte pour les deux joueurs) :");
            for (int i = 0; i < fleetShipSizes.size(); i++) {
                System.out.println("- Navire " + (i + 1) + " (" + fleetShipSizes.get(i) + " cases)");
            }
            System.out.println("Format : x y orientation");
            System.out.println("  Orientation : H (horizontal droite), -H (horizontal gauche), V (vertical bas), -V (vertical haut)");
            System.out.println("Coordonnées de 1 à " + configuredGridSize);

            for (Player player : placementController.getPlayers()) {
                if (player.isAI()) {
                    player.getAI().placeFleet(game, player);
                    System.out.println("\n" + player.getName() + " a placé sa flotte automatiquement.");
                } else {
                    placeFleetManually(scanner, renderer, placementController, player, fleetShipSizes);
                }
            }

            if (!placementController.areAllFleetsReady()) {
                System.out.println("Erreur : Toutes les flottes ne sont pas complètes.");
                return;
            }

            placementController.finishPlacementPhase();
        }

        GameController controller = new GameController(game);
        int configuredGridSize = controller.getGridSize();

        System.out.println("\n=== DÉBUT DE LA PARTIE ===");
        System.out.println("O = vide (jamais tiré), X = touché, ? = manqué");
        System.out.println("Entrez des coordonnées 'x y' (1-" + configuredGridSize + "),");
        System.out.println("ou 'save [fichier]', 'q' pour quitter.");

        while (true) {
            if (controller.isGameFinished()) {
                Player winner = controller.getWinner();
                System.out.println("\n=== FIN DE PARTIE ===");
                if (winner != null) {
                    System.out.println("Vainqueur : " + winner.getName());
                } else {
                    System.out.println("Aucun vainqueur.");
                }
                break;
            }

            Player current = controller.getCurrentPlayer();
            Player target = controller.getTargetPlayer();

            System.out.println(renderer.renderPlayerTurn(current, target));

            System.out.print("Coordonnées à tirer (x y) ou 'q' pour quitter : ");
            String line = scanner.nextLine().trim();

            if (line.equalsIgnoreCase("q")) {
                System.out.println("Vous avez quitté la partie.");
                break;
            }

            if (line.equalsIgnoreCase("save") || line.toLowerCase().startsWith("save ")) {
                String savePath = extractOptionalPath(line, "save", "saves/bataille-navale.save");
                try {
                    controller.saveGame(savePath);
                    System.out.println("Partie sauvegardée dans : " + savePath);
                } catch (Exception e) {
                    System.out.println("Erreur de sauvegarde : " + e.getMessage());
                }
                continue;
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
                System.out.println("Coordonnées hors de la grille. Valeurs entre 1 et " + configuredGridSize + ".");
                continue;
            }

            ShotResult result = controller.playShot(xInput - 1, yInput - 1);

            switch (result) {
                case HIT:
                    System.out.println("HIT (TOUCHÉ) ! Vous rejouez.");
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

            if (controller.isGameFinished()) {
                Player winner = controller.getWinner();
                System.out.println("\n=== FIN DE PARTIE ===");
                if (winner != null) {
                    System.out.println("Vainqueur : " + winner.getName());
                } else {
                    System.out.println("Aucun vainqueur.");
                }
                break;
            }

            if (result == ShotResult.MISS) {
                controller.endTurn();
            }
            System.out.println();
            System.out.println("§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§-\\|/-§");
        }

        scanner.close();
    }

    private static String extractOptionalPath(String line, String command, String defaultPath) {
        String suffix = line.substring(command.length()).trim();
        if (suffix.isEmpty()) {
            return defaultPath;
        }
        return suffix;
    }

    /** Demande le chemin et charge la partie via le contrôleur (persistance hors vue). */
    private static Game askLoadGame(Scanner scanner) {
        while (true) {
            System.out.print("Chemin de sauvegarde (Entrée pour défaut saves/bataille-navale.save) : ");
            String input = scanner.nextLine().trim();
            String savePath = input.isEmpty() ? "saves/bataille-navale.save" : input;
            try {
                Game game = GameController.loadGame(savePath);
                System.out.println("Partie chargée depuis : " + savePath);
                return game;
            } catch (Exception e) {
                System.out.println("Erreur de chargement : " + e.getMessage());
            }
        }
    }

    private static boolean askStartMode(Scanner scanner) {
        while (true) {
            System.out.println("Choisissez une option :");
            System.out.println("1) Nouvelle partie");
            System.out.println("2) Charger une sauvegarde");
            System.out.print("Votre choix (1/2) : ");

            String line = scanner.nextLine().trim();
            if (line.equals("1")) {
                return false;
            }
            if (line.equals("2")) {
                return true;
            }

            System.out.println("Choix invalide. Entrez 1 ou 2.");
        }
    }

    private static int askGridSize(Scanner scanner) {
        while (true) {
            System.out.print("Taille de la grille (minimum 5) : ");
            String line = scanner.nextLine().trim();

            try {
                int gridSize = Integer.parseInt(line);
                if (gridSize < 5) {
                    System.out.println("La taille de grille doit être au moins 5.");
                    continue;
                }
                return gridSize;
            } catch (NumberFormatException e) {
                System.out.println("Valeur invalide. Entrez un entier (ex: 10).\n");
            }
        }
    }

    private static List<Integer> askFleetConfiguration(Scanner scanner, int gridSize) {
        int shipCount;
        while (true) {
            System.out.print("Nombre de navires par joueur (minimum 1) : ");
            String line = scanner.nextLine().trim();

            try {
                shipCount = Integer.parseInt(line);
                if (shipCount < 1) {
                    System.out.println("Le nombre de navires doit être au moins 1.");
                    continue;
                }
                break;
            } catch (NumberFormatException e) {
                System.out.println("Valeur invalide. Entrez un entier (ex: 5).\n");
            }
        }

        List<Integer> shipSizes = new ArrayList<>();
        int totalShipCells = 0;

        for (int i = 0; i < shipCount; i++) {
            while (true) {
                System.out.print("Taille du navire " + (i + 1) + " (entre 1 et " + gridSize + ") : ");
                String line = scanner.nextLine().trim();

                try {
                    int size = Integer.parseInt(line);
                    if (size < 1 || size > gridSize) {
                        System.out.println("La taille doit être comprise entre 1 et " + gridSize + ".");
                        continue;
                    }

                    shipSizes.add(size);
                    totalShipCells += size;
                    break;
                } catch (NumberFormatException e) {
                    System.out.println("Valeur invalide. Entrez un entier (ex: 3).\n");
                }
            }
        }

        if (!GameController.isValidFleetConfiguration(gridSize, shipSizes)) {
            System.out.println("\nAttention : le total des cases de navires (" + totalShipCells
                + ") dépasse le nombre de cases de la grille (" + (gridSize * gridSize) + ").");
            System.out.println("Veuillez reconfigurer la flotte.\n");
            return askFleetConfiguration(scanner, gridSize);
        }

        return shipSizes;
    }

    /** Placement manuel : la vue lit les entrées et affiche ; le contrôleur valide et place. */
    private static void placeFleetManually(Scanner scanner, ConsoleRenderer renderer,
                                          GameController controller, Player player, List<Integer> shipSizes) {
        System.out.println("\n=== Placement de la flotte de " + player.getName() + " ===");

        for (int i = 0; i < shipSizes.size(); i++) {
            int size = shipSizes.get(i);
            String name = "Navire " + (i + 1);

            while (true) {
                System.out.println("\nVotre grille actuelle :");
                System.out.println(renderer.renderPlayerGrid(player.getGrid()));
                System.out.println("\nPlacez votre " + name + " (" + size + " cases)");
                System.out.print("Coordonnées et orientation (x y H/-H/V/-V) : ");

                String line = scanner.nextLine().trim();
                if (line.isEmpty()) {
                    continue;
                }

                String[] parts = line.split("\\s+");
                if (parts.length != 3) {
                    System.out.println("Format invalide. Utilisez : x y orientation (ex: 3 5 H ou 3 5 -H)");
                    continue;
                }

                int x, y;
                try {
                    x = Integer.parseInt(parts[0]);
                    y = Integer.parseInt(parts[1]);
                } catch (NumberFormatException e) {
                    System.out.println("Coordonnées invalides. Utilisez des entiers pour x et y.");
                    continue;
                }

                String orientationStr = parts[2];
                var result = controller.tryPlaceShip(x - 1, y - 1, size, orientationStr, name);
                if (result.isSuccess()) {
                    System.out.println(name + " placé avec succès !");
                    break;
                }
                System.out.println(result.getMessage());
            }
        }

        System.out.println("\nFlotte de " + player.getName() + " complète !");
        System.out.println(renderer.renderPlayerGrid(player.getGrid()));
    }
}



