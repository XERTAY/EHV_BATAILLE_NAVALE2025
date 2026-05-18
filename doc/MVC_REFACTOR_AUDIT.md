# Audit de refactorisation MVC — Bataille Navale

Ce document tient le journal de la refactorisation MVC du backend.

## Objectif

Faire passer **toute** la logique de jeu (placement, tours, tir, IA, fin de partie) par le
contrôleur legacy `com.ehv.battleship.controller.GameController` et le modèle
`com.ehv.battleship.model.*`. La couche `com.ehv.api.*` ne doit conserver que :

- transport HTTP / WebSocket
- authentification lobby (JWT)
- présentation JSON (presenter → DTO `view`)
- présence / heartbeat / forfait réseau

## Matrice de parité DuelGameService → GameController

| Capacité (`DuelGameService`)            | Cible legacy                                                       | Statut |
| --------------------------------------- | ------------------------------------------------------------------ | ------ |
| `resetAndGetState` (2/4 J, IA, flotte)  | `GameController.createNewGame*` + `startPlacementPhase`            | TODO   |
| `placeShip(SHIP_n, HORIZONTAL/VERTICAL)`| `placeShipForPlayer` via `game.placeShip(player, ship)`            | TODO   |
| `removePlacedShip`                      | `removeShipForPlayer` (nouveau)                                    | TODO   |
| `confirmPlacement` + verrouillage       | `confirmPlacementForPlayer` (nouveau, état session)                | TODO   |
| `fireAt` + `targetPlayer` (4J)          | `playShot(target, x, y)` + cible verrouillée 4J                    | TODO   |
| `advanceAiSingleStep*`                  | `playAITurn()` + `advanceUntilHumanOrTerminal`                     | TODO   |
| `forfeitPlayer`                         | `forfeitPlayer` (nouveau)                                          | TODO   |
| `getStateForPlayer` (brouillard)        | `ApiGameStatePresenter` (vue uniquement)                           | TODO   |
| `save` / `load` / `listSaveFiles`       | `GamePersistence` via contrôleur                                   | TODO   |

## Scénarios de non-régression (S1–S12)

À rejouer après **chaque** étape.

| #   | Scénario                                  | Procédure                                                  |
| --- | ----------------------------------------- | ---------------------------------------------------------- |
| S1  | Hot-seat local 2J humains                 | Console legacy, sans lobby                                 |
| S2  | Local 1J vs 1 IA (2J)                     | Console legacy, choix IA                                   |
| S3  | Local 4J hot-seat (4 humains)             | Console legacy, 4 humains                                  |
| S4  | Local 4J mixte (2H + 2 IA)                | Console legacy, 2 humains + 2 IA                           |
| S5  | Lobby 2J en ligne                         | Backend + frontend, 2 onglets navigateur                   |
| S6  | Lobby 4J en ligne (4 humains)             | 4 onglets, vérifier `TARGET_LOCKED` / `SHOT_RESOLVED`      |
| S7  | Lobby 4J mixte (humains + IA)             | `ai-step` côté hôte, broadcast aux clients distants        |
| S8  | Reconnexion lobby (`resumeToken`)         | Fermer/rouvrir un onglet en cours de partie                |
| S9  | Déconnexion + forfait                     | Fermer brutalement, attendre expiration                    |
| S10 | Sauvegarde / chargement                   | `save` / `load` en console + via frontend                  |
| S11 | Brouillard de guerre                      | Vérifier que les bateaux adverses ne fuient pas hors GAMEOVER |
| S12 | Annulation placement (remove ship)        | Retirer un navire avant verrouillage                       |

## Journal d'exécution

| Étape | Commit / Date | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 | Notes |
| ----- | ------------- | -- | -- | -- | -- | -- | -- | -- | -- | -- | --- | --- | --- | ----- |
| 0     | initial       | -  | -  | -  | -  | -  | -  | -  | -  | -  | -   | -   | -   | Matrice rédigée |

## Règle d'or

Aucune règle métier (placement / tir / tours / phases) ne doit vivre dans
`com.ehv.api.service.*` après la fin du chantier. Si un test échoue parce qu'une règle
manque côté legacy, **la corriger côté legacy**, pas la dupliquer côté API.
