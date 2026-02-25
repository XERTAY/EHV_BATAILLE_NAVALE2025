# Backend - Bataille Navale

## Architecture MVC

### Modèle (Domain)
- **Game** : Gère l'état du jeu, la liste des joueurs, les tirs et la logique métier. Utilise une liste de joueurs extensible (minimum 2).
- **Player** : Représente un joueur avec sa grille et sa flotte. Peut contenir un composant `AI` optionnel (null pour les joueurs humains).
- **AI** : Composant d'intelligence artificielle pour les joueurs IA. Gère le choix des cibles et le placement automatique de la flotte.
- **Grid** : Grille de jeu contenant des cellules
- **Cell** : Cellule avec coordonnée et statut
- **Fleet** : Collection de navires
- **Ship** : Navire avec coordonnées, orientation et état
- **Coordinate** : Position (x, y) sur la grille
- **Enums** : `GameState`, `CellStatus`, `ShotResult`, `ShipOrientation`

### Contrôleur
- **GameController** : Orchestre les actions du jeu, valide les coordonnées et gère les tours

### Vue
- **ConsoleMain** : Point d'entrée console
- **ConsoleRenderer** : Rendu des grilles et affichage console

### Infrastructure
- **web/dto/** : DTOs pour API web (à venir)

## Séparation des responsabilités
- Aucune I/O console dans le modèle ni les contrôleurs
- Toute l'I/O est confinée à la vue
- Architecture MVC stricte

## Gestion des joueurs et de l'IA

### Liste de joueurs
- `Game` utilise une `List<Player>` au lieu de joueurs individuels (`humanPlayer`, `opponent`)
- Permet d'étendre le jeu à plus de 2 joueurs à l'avenir
- Gestion des tours via un index circulaire

### Intelligence Artificielle
- L'IA est un composant optionnel de `Player` (champ `AI ai`)
- Si `ai == null`, le joueur est humain
- Si `ai != null`, le joueur est une IA
- La classe `AI` contient la logique de choix des cibles et de placement automatique

## Diagramme de classe

Un diagramme de classe complet au format Mermaid 8.0.0 est disponible dans [`class-diagram.md`](class-diagram.md).

Le diagramme inclut :
- Toutes les classes du modèle, contrôleur et vue
- Tous les enums
- Les relations (composition, agrégation, dépendances)
- La relation optionnelle `Player` → `AI`



## Lancer le jeu : 

Se mettre dans la racine du projet : 

Pour compiler : 

```
make compile
```

Pour run : 

```
make run 
```

ou bien après compilation :

```
javac -d .src/**/*.java
```
