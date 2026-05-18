# Charte de code — EHV Bataille Navale

Cette charte s'applique à **tout** le code du dépôt (Java backend, JavaScript / JSX
frontend, scripts Makefile, configuration). Elle vise à garder une base maintenable
pour un projet école et pédagogique.

## 1. Principe MVC

- **Modèle** (`com.ehv.battleship.model`) : aucune dépendance sur Gson, Spring, console.
- **Contrôleur** : un seul détenteur des règles métier, le legacy
  `com.ehv.battleship.legacy.controller.GameController`.
- **Vue console** (`com.ehv.battleship.view`) et **vue API**
  (`com.ehv.api.presentation`, `com.ehv.api.view`) ne contiennent **aucune** règle
  métier — elles formatent, projettent, désérialisent.
- Toute nouvelle règle (placement, tir, IA, sauvegarde) doit être ajoutée au
  contrôleur, jamais à un service annexe.

## 2. Taille des fichiers

| Type                                   | Soft limit | Hard limit | Action si dépassement                          |
| -------------------------------------- | ---------- | ---------- | ---------------------------------------------- |
| Java classe (hors `Game`/`Grid` model) | 300        | 400        | Extraire un collaborateur dans le même package |
| Java classe modèle (`Game`, `Grid`)    | 400        | 500        | Ajouter une justification dans la PR           |
| React composant (`.jsx`)               | 200        | 300        | Extraire en sous-composants ou hooks           |
| React hook (`use*.js`)                 | 200        | 300        | Découper en hooks plus petits                  |
| CSS                                    | 500        | 800        | Découper par feature                           |

## 3. Taille des fonctions / méthodes

- **Fonction Java** : `≤ 40 lignes` (corps), `≤ 5 paramètres`, profondeur d'imbrication `≤ 3`.
- **Hook / fonction JS** : `≤ 60 lignes`, `≤ 6 paramètres`.
- Si une méthode dépasse, extraire un helper privé bien nommé.

## 4. Nommage

| Élément                     | Convention                                  |
| --------------------------- | ------------------------------------------- |
| Classe / type Java          | `UpperCamelCase`                            |
| Méthode / variable Java     | `lowerCamelCase`                            |
| Constante Java              | `UPPER_SNAKE_CASE`                          |
| Package Java                | `tout.minuscule.sans.tiret`                 |
| Composant React             | `UpperCamelCase` (fichier + composant)      |
| Hook React                  | `useUpperCamelCase`                         |
| Variable JS                 | `lowerCamelCase`                            |
| Constante JS                | `UPPER_SNAKE_CASE` (constante littérale)    |
| Fichier CSS                 | `kebab-case.css`                            |

Pas d'abréviations exotiques (`mgr`, `svc`, `ctx2`, …). Préférer la clarté à la
concision : `placeShipForPlayer` plutôt que `place4P`.

## 5. Imports

- Java : grouper en 3 blocs séparés par une ligne blanche : `java.*`, `org./jakarta./com.google.*`, `com.ehv.*`.
- Pas d'import `*` sauf static utility.
- JS / JSX : groupes `1) externes (react, three, …)`, `2) alias internes (@/…)`, `3) chemins relatifs`.

## 6. Commentaires

- Pas de commentaires "narrateurs" (`// increments x`).
- Documenter le **pourquoi** non évident (verrouillage de cible 4J, brouillard, …).
- Javadoc obligatoire pour les méthodes publiques d'API REST/WS et de présenteurs.

## 7. Tests

- Toute nouvelle règle métier ajoute un test JUnit ciblé dans le **même module
  modèle ou contrôleur**.
- Toute modification du contrat API ajoute un test du présenteur correspondant.
- Avant un commit, rejouer la matrice S1–S12 de `doc/MVC_REFACTOR_AUDIT.md`.

## 8. Style local

Lance les vérifications via la racine du dépôt :

```bash
make lint     # ESLint (frontend) + Spotless en mode check (backend)
make test     # JUnit (backend) + Vitest (frontend)
make check    # combinaison lint + test (utilisé par la CI)
```

Frontend :

- `npm run lint` doit terminer sans **erreur** (`0 errors`).
- Les `warning` ESLint ont vocation à diminuer à chaque PR ; pas de nouveau warning toléré.
- Limites encodées : `max-lines` (250), `max-lines-per-function` (80), `max-depth` (4),
  `complexity` (12), `max-params` (5), `unused-imports/no-unused-imports` (**error**).

Backend :

- `mvn -Pspotless spotless:check` vérifie le formatage (imports, espaces, retour final).
- `mvn -Pspotless spotless:apply` corrige automatiquement.

## 9. Workflow git

- Branche par lot fonctionnel (`feat/...`, `fix/...`, `refactor/...`).
- Commit unitaire concis (`feat(controller): forfeit handling`).
- Une PR = une responsabilité.
