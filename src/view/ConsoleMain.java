package com.ehv.battleship.view;

import com.ehv.battleship.controller.GameController;
import com.ehv.battleship.model.AI;
import com.ehv.battleship.model.Game;
import com.ehv.battleship.model.Player;
import com.ehv.battleship.model.ShipOrientation;
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
        
        // Phase de placement
        controller.startPlacementPhase();
        System.out.println("\n=== PHASE DE PLACEMENT ===");
        System.out.println("Vous devez placer vos navires :");
        System.out.println("- 1 Porte-avions (5 cases)");
        System.out.println("- 1 Cuirassé (4 cases)");
        System.out.println("- 1 Croiseur (3 cases)");
        System.out.println("- 1 Sous-marin (3 cases)");
        System.out.println("- 1 Destroyer (2 cases)");
        System.out.println("Format : x y orientation");
        System.out.println("  Orientation : H (horizontal droite), -H (horizontal gauche), V (vertical bas), -V (vertical haut)");
        System.out.println("Coordonnées de 1 à " + gridSize);
        
        // Placement pour chaque joueur
        for (Player player : game.getPlayers()) {
            if (player.isAI()) {
                // Placement automatique pour l'IA
                player.getAI().placeFleet(game, player);
                System.out.println("\n" + player.getName() + " a placé sa flotte automatiquement.");
            } else {
                // Placement manuel
                placeFleetManually(scanner, renderer, controller, player);
            }
        }
        
        // Vérifier que toutes les flottes sont complètes
        if (!controller.areAllFleetsReady()) {
            System.out.println("Erreur : Toutes les flottes ne sont pas complètes.");
            return;
        }
        
        // Démarrer le jeu
        controller.finishPlacementPhase();
        System.out.println("\n=== DÉBUT DE LA PARTIE ===");
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

    // Gère le placement manuel de la flotte pour un joueur
    private static void placeFleetManually(Scanner scanner, ConsoleRenderer renderer, 
                                      GameController controller, Player player) {
        int[] shipSizes = {5, 4, 3, 3, 2};
        String[] shipNames = {"Porte-avions", "Cuirassé", "Croiseur", "Sous-marin", "Destroyer"};
        int gridSize = controller.getGridSize();
        
        System.out.println("\n=== Placement de la flotte de " + player.getName() + " ===");
        
        for (int i = 0; i < shipSizes.length; i++) {
            int size = shipSizes[i];
            String name = shipNames[i];
            
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
                
                try {
                    int x = Integer.parseInt(parts[0]);
                    int y = Integer.parseInt(parts[1]);
                    String orientationStr = parts[2].toUpperCase();
                    
                    ShipOrientation orientation;
                    if (orientationStr.equals("H")) {
                        orientation = ShipOrientation.HORIZONTAL;
                    } else if (orientationStr.equals("-H")) {
                        orientation = ShipOrientation.HORIZONTAL_LEFT;
                    } else if (orientationStr.equals("V")) {
                        orientation = ShipOrientation.VERTICAL;
                    } else if (orientationStr.equals("-V")) {
                        orientation = ShipOrientation.VERTICAL_UP;
                    } else {
                        System.out.println("Orientation invalide. Utilisez H, -H, V ou -V.");
                        System.out.println("  H = horizontal vers la droite");
                        System.out.println("  -H = horizontal vers la gauche");
                        System.out.println("  V = vertical vers le bas");
                        System.out.println("  -V = vertical vers le haut");
                        continue;
                    }
                    
                    // Convertir en coordonnées 0-indexed
                    int x0 = x - 1;
                    int y0 = y - 1;
                    
                    // Vérifier d'abord si les coordonnées de départ sont dans la grille
                    if (!controller.isCoordinateInRange(x0, y0)) {
                        System.out.println("Erreur : Les coordonnées de départ (" + x + ", " + y + ") sont hors de la grille.");
                        System.out.println("Les coordonnées doivent être entre 1 et " + gridSize + ".");
                        continue;
                    }
                    
                    // Vérifier si le placement est valide (vérifie aussi que le navire ne dépasse pas)
                    if (!controller.canPlaceShip(x0, y0, size, orientation)) {
                        System.out.println("Placement invalide. Le navire dépasse de la grille ou chevauche un autre navire.");
                        System.out.println("Veuillez choisir une autre position.");
                        continue;
                    }
                    
                    // Placer le navire
                    controller.placeShip(x0, y0, size, orientation, name);
                    System.out.println(name + " placé avec succès !");
                    break;
                    
                } catch (NumberFormatException e) {
                    System.out.println("Coordonnées invalides. Utilisez des entiers pour x et y.");
                } catch (IllegalArgumentException e) {
                    System.out.println("Erreur : " + e.getMessage());
                }
            }
        }
        
        System.out.println("\nFlotte de " + player.getName() + " complète !");
        System.out.println(renderer.renderPlayerGrid(player.getGrid()));
    }
}



