# Bataille Navale (EHV 2025)

## Démarrage rapide

### Mode console legacy (sans navigateur)

Jeu **JvsJ en terminal** via `ConsoleMain` — pas d’API Spring Boot ni de frontend.

Depuis la **racine du projet** :

```bash
make makerun
```

Alias conservés : `make run` ou `make run-console` (compile puis lance la classe console).

**Windows** : double-clic ou invite de commandes avec `run.bat` (Maven `exec:java` sur `ConsoleMain`).

**Prérequis** : Java 17+, Maven 3.9+ (Make sous Linux/macOS ; sous Windows, `run.bat` suffit si Maven est dans le `PATH`).

### Mode web (frontend 3D + API + WebSocket)

1. Backend : `mvn -f app/backend/pom.xml spring-boot:run` → http://localhost:4784  
2. Frontend : `cd app/frontend && npm install && npm run dev` → http://localhost:2462  

Détails : [Lancer backend et frontend en local](#lancer-backend-et-frontend-en-local-tests).

---

## Architecture MVC

Le backend respecte un MVC strict : la logique de jeu vit dans **un seul** contrôleur
(`com.ehv.battleship.legacy.controller.GameController`) qui pilote le modèle. Les couches
console et API HTTP/WS ne sont que des présentations.

```
com.ehv.battleship.model        ← Modèle pur (Domain), aucune I/O
com.ehv.battleship.persistence  ← Sauvegarde / chargement (.save) via Gson
com.ehv.battleship.legacy.controller.GameController  ← Contrôleur unique du jeu
com.ehv.battleship.view         ← Vue console (ConsoleMain, ConsoleRenderer)
com.ehv.api.session.GameSession ← Façade API : verrou + delégation vers le contrôleur
com.ehv.api.presentation.*      ← Présenteurs JSON (state + actions)
com.ehv.api.view.*              ← DTOs JSON exposés au frontend
com.ehv.api.controller.GameController  ← Endpoints HTTP REST
com.ehv.api.config.GameWebSocketHandler ← WebSocket (lobby, présence, événements)
```

### Modèle (Domain)

- **Game** : état du jeu (joueurs, tours, tirs, fin de partie).
- **Player / AI** : joueur humain ou IA (composant placement/tir auto).
- **Grid / Cell / Fleet / Ship / Coordinate** : géométrie & navires.
- **Enums** : `GameState`, `CellStatus`, `ShotResult`, `ShipOrientation`.
- Le modèle ne dépend de Gson, Spring, console : aucune I/O.

### Persistance

- `com.ehv.battleship.persistence.GamePersistence` : `.save` JSON (Gson) + restriction stricte sur `saves/`.
- `PlayerTypeAdapter` (package-privé) : sérialisation polymorphe Player/AI.

### Contrôleur

- `GameController` (legacy) : **seul** détenteur des règles du jeu — placement, retrait,
  validation, tir avec verrouillage de cible 4J, tirs IA, forfait, fin de partie.

### Vue console

- `ConsoleMain` : boucle console, lecture clavier, sauvegarde / chargement.
- `ConsoleRenderer` : rendu ASCII (grille personnelle + grille de tir + tours).

### Vue API

- `com.ehv.api.session.GameSession` : verrou monitor + délégation au contrôleur.
- `com.ehv.api.presentation.ApiGameStatePresenter` : projection `GameState` → `GameStateResponse`
  + brouillard de guerre (les bateaux adverses sont masqués hors `GAME_OVER`).
- `com.ehv.api.presentation.ApiActionPresenter` : projection `ShotResult` → `ActionResponse`
  + messages utilisateur.
- `com.ehv.api.controller.GameController` : endpoints REST minces, délèguent à `GameSession`.
- `com.ehv.api.config.GameWebSocketHandler` : événements lobby/présence (sans règles métier).

## Séparation des responsabilités

- Aucune I/O console / réseau dans le modèle.
- Toutes les règles métier passent par `GameController` (legacy).
- L'API ne fait que sérialiser / désérialiser et appliquer le brouillard de guerre.
- Les sauvegardes vivent dans `com.ehv.battleship.persistence`, hors du modèle.

Le détail du chantier de refactorisation est consigné dans
[`doc/MVC_REFACTOR_AUDIT.md`](doc/MVC_REFACTOR_AUDIT.md).

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

Un diagramme de classe complet au format Mermaid 8.0.0 est disponible dans `[class-diagram.md](class-diagram.md)`.

Le diagramme inclut :

- Toutes les classes du modèle, contrôleur et vue
- Tous les enums
- Les relations (composition, agrégation, dépendances)
- La relation optionnelle `Player` → `AI`

## Lancer le jeu en mode console

Voir [Mode console legacy](#mode-console-legacy-sans-navigateur) en tête de ce README (`make makerun`, `make run`, `run.bat`).

## Lancer backend et frontend en local (tests)

### Prerequis

- Java 17+
- Maven 3.9+
- Node.js 20+ et npm

### 1) Demarrer le backend (API Spring Boot)

Terminal 1, depuis la racine du projet :

```
mvn -pl app/backend -am spring-boot:run
mvn -f app/backend/pom.xml spring-boot:run
```

Le backend demarre en local sur `http://localhost:4784`.

### 2) Demarrer le frontend (Vite)

Terminal 2 :

```
cd app/frontend
npm install
npm run dev
```

Le frontend demarre en local sur `http://localhost:2462`.

### 3) Tests locaux

- Garder les deux serveurs demarres (backend + frontend)
- Ouvrir l'URL du frontend dans le navigateur
- Verifier les appels au backend depuis l'interface (DevTools > Network)

## WebSocket multijoueur (concurrent, 2 a 4 joueurs)

### Endpoint

- URL: `ws://localhost:4784/ws/game`
- Origine frontend autorisee: `http://localhost:2462`

### Principe

- Chaque client ouvre une connexion WebSocket.
- Le backend envoie immediatement `CONNECTED` avec un `sessionId`.
- Un client peut creer une partie (`CREATE_GAME`) ou rejoindre une partie existante (`JOIN_GAME`).
- Plusieurs parties peuvent tourner en parallele (isolation par `gameId`).
- Chaque partie accepte entre 2 et 4 joueurs (`maxPlayers`).

### Messages client -> serveur

Creation de partie:

```json
{
	"type": "CREATE_GAME",
	"maxPlayers": 4
}
```

Rejoindre une partie:

```json
{
	"type": "JOIN_GAME",
	"gameId": "<game-id>"
}
```

### Messages serveur -> client

- `CONNECTED`: connexion ouverte + `sessionId`
- `GAME_CREATED`: partie creee (`gameId`, `players`, `maxPlayers`)
- `JOINED_GAME`: joueur ajoute a la partie (`gameId`, `players`, `maxPlayers`)
- `PLAYER_COUNT_UPDATED`: broadcast aux joueurs de la partie quand le nombre de joueurs change
- `ERROR`: erreur de protocole (JSON invalide, type inconnu, partie introuvable/pleine, etc.)

### Notes d'isolement

- Les evenements sont scopes par partie (pas de fuite entre parties).
- Le backend ne diffuse pas les placements adverses: chaque client ne doit recevoir que les informations autorisees par la logique de jeu.
- La logique de coups/etat de bataille en WebSocket peut etre ajoutee ensuite sur la meme base (`type` de message + validation serveur).

## Sauvegarde / chargement (mode console)

Au démarrage, avant le placement, vous pouvez choisir :

- `1) Nouvelle partie` : création d'une partie puis placement des navires
- `2) Charger une sauvegarde` : chargement d'une partie existante

Pendant une partie, vous pouvez utiliser :

- `save [nom]` : sauvegarde la partie courante dans `saves/[nom].save` (par défaut `saves/bataille-navale.save`)

Exemple :

```
save partie1
```
Sauvegarde dans `saves/partie1.save`

Le format de sauvegarde est désormais JSON (lisible et modifiable), au lieu du format binaire Java.

ou bien après compilation :

```
javac -d .src/**/*.java
```

## Déploiement VPS avec Docker

### Pré-requis VPS (Debian déjà configuré)

Cette section part du principe que :
- Debian est déjà configuré sur le VPS
- Docker est déjà installé et fonctionnel

Vérifications minimales :

```bash
docker --version
docker compose version
```

Si `docker compose` n'est pas disponible, installer le plugin compose :

```bash
sudo apt update
sudo apt install -y docker-compose-plugin
```

### Préparation serveur

- Ouvrir au minimum le port `2462` dans le firewall du VPS.
- Si vous utilisez un nom de domaine, pointer le DNS vers l'IP du VPS.
- Pour de la production Internet, prévoir ensuite HTTPS (port `443` + certificat TLS).

#### Ouvrir les ports sur un VPS Debian

Si `ufw` est installé :

```bash
sudo ufw allow 2462/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Si `ufw` n'est pas installé (installation rapide) :

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 2462/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Déploiement initial

```bash
git clone <URL_DU_REPO> bataille-navale
cd bataille-navale
docker compose up -d --build
```

Le frontend est servi sur `http://IP_DU_VPS` (ou `http://votre-domaine`).

### Commandes ON/OFF et exploitation

- Démarrer (ON): `docker compose up -d --build`
- Arrêter (OFF): `docker compose down`
- Statut: `docker compose ps`
- Logs en continu: `docker compose logs -f`
- Redémarrer un service: `docker compose restart frontend` ou `docker compose restart backend`

### Mise à jour applicative

Depuis le dossier du projet sur le VPS :

```bash
git pull
docker compose up -d --build
```

### Dépannage rapide

- Si l'application ne répond pas : `docker compose ps` puis `docker compose logs -f`.
- Si le port `2462` est occupé, changer le mapping avec une variable:

```bash
FRONTEND_PORT=3000 docker compose up -d --build
```

- Si un conteneur redémarre en boucle, inspecter ses logs :
  - `docker compose logs -f backend`
  - `docker compose logs -f frontend`

### URL à utiliser dans le navigateur

Depuis le web, l'URL d'accès est :

```text
http://IP_PUBLIQUE_DU_VPS:2462
```

Exemple :

```text
http://203.0.113.10:2462
```

Pour récupérer l'IP publique directement sur le VPS :

```bash
curl ifconfig.me
```

