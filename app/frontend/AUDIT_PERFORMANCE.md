# Audit Complet - Optimisation Code & Performance

Date: 2026-03-26  
Projet: `THREE.JS/sea-battle`  
Stack: React 19 + Vite 8 + Three.js + React Three Fiber (+ drei)

## 1) Resume Executif

L'application est globalement propre et lisible, avec une architecture simple et peu de dette technique visible.  
Le principal risque de performance est concentre sur le rendu 3D temps reel (CPU + GPU), puis sur la taille du bundle JavaScript.

Etat actuel:
- Qualite statique: **bonne** (`eslint` OK, pas d'erreurs).
- Build production: **OK** en ~804 ms.
- Taille JS: **elevee** (`dist/assets/index-*.js` ~1.2 MB minifie, ~340 KB gzip).
- Goulots potentiels: animation de geometrie et recalcul de normales a chaque frame.

Conclusion: l'application est fonctionnelle et deja relativement optimisee pour un petit perimetre, mais des gains sensibles sont possibles en priorisant le pipeline de rendu et le poids de chargement initial.

## 2) Methodologie d'Audit

Audit realise via:
- Revue de l'architecture React/R3F.
- Analyse des composants critiques (`BoardScene`, `WaterBoard`, overlays texte/labels).
- Verification build/lint:
  - `npm run build`
  - `npm run lint`
- Analyse des patterns de rendu, allocations et re-renders.

## 3) Mesures Observees

Build production (`vite build`):
- `dist/assets/index-*.js`: **1,199.11 kB** (gzip: **340.07 kB**)
- Warning Vite sur chunk > 500 kB.

Lint:
- `eslint .`: **aucune erreur**.

## 4) Analyse Technique Detaillee

## 4.1 Rendu 3D (critique)

### Constat A - Deformation de la surface a chaque frame
Dans `WaterBoard`, la boucle `useFrame` met a jour tous les vertices du plan pour simuler les vagues.

Impact:
- Cout CPU recurrent a chaque frame.
- Cout qui augmente lineairement avec `segments`.
- Sensible surtout sur machines modestes ou quand le nombre de grilles augmente.

Niveau: **Eleve**

### Constat B - `computeVertexNormals()` tres frequent
`geometry.computeVertexNormals()` est declenche toutes les 2 frames.

Impact:
- Operation lourde CPU.
- Peut devenir le premier facteur de baisse FPS en charge.

Niveau: **Eleve**

### Constat C - Materiau `meshPhysicalMaterial`
Le materiau choisi est visuellement qualitatif mais plus couteux qu'un `meshStandardMaterial`.

Impact:
- Surcout GPU (transmission, clearcoat, etc.).
- Peut impacter le framerate en resolution elevee.

Niveau: **Moyen a eleve** (selon cible materielle)

## 4.2 React / Re-renders

### Constat D - Mouvements pointeur -> `setHoveredCell`
Le `onPointerMove` met a jour l'etat React en continu.

Impact:
- Re-renders React potentiellement frequents.
- Peut provoquer du travail inutile si la cellule n'a pas reellement change.

Niveau: **Moyen**

### Constat E - Creation d'objets recalcules en render
`boardMathOptions` est recree a chaque render de `WaterBoard`.

Impact:
- Mineur actuellement, mais evitable.
- Peut augmenter le bruit de rendu si les composants deviennent plus complexes.

Niveau: **Faible a moyen**

## 4.3 Bundle / Chargement initial

### Constat F - Bundle unique volumineux
Le bundle principal est monolithique (~1.2 MB minifie).

Impact:
- Temps de chargement initial plus long (reseau + parse + execution JS).
- Penalise surtout mobile/reseau limite.

Niveau: **Eleve**

## 4.4 Qualite code / maintenabilite

Points positifs:
- Separation composant/config/utils propre.
- Memoization deja presente sur certains calculs (`useMemo`).
- Code lisible et coherent.

Risque global:
- Peu de garde-fous de mesure (pas de budget perf explicite, pas de profilage automatise).

Niveau: **Moyen**

## 5) Opportunites d'Optimisation (Priorisees)

## Priorite 1 - Gagner des FPS sur la surface d'eau

1. **Migrer l'onde vers le GPU (vertex shader)**
   - Implementer la deformation de hauteur dans le vertex shader (`uTime`, `uAmp1`, `uAmp2`, `uFreq*`, `uSpeed*`).
   - Supprimer la deformation CPU par frame et limiter le CPU a la mise a jour des uniforms.
   - Ajouter un mode A/B (`gpu` vs `cpu`) pour comparaison directe sans regression.
   - Critere perf attendu: baisse du temps frame CPU (JS), meilleur p95 et moins de frame drops.
   - Critere qualite attendu: forme de vague visuellement equivalente (amplitude/frequence/vitesse).

2. **Si conservation CPU: reduire le cout des normales**  
   - Recalculer moins souvent (ex: toutes les 4-8 frames) ou approximer.
   - Eventuellement diminuer `segments` (80 -> 48/64 selon qualite visuelle).

3. **Adapter le material selon mode qualite**
   - Profil "High": `meshPhysicalMaterial`
   - Profil "Normal": `meshStandardMaterial`
   - Toggle expose dans UI debug/perf.

## Priorite 2 - Reducer le travail React inutile

4. **Debouncer intelligemment le hover**
   - Mettre a jour `hoveredCell` uniquement si la cellule change.
   - Eviter un `setState` a chaque mouvement intra-cellule.

5. **Memoriser callbacks/options**
   - `useCallback` pour handlers.
   - `useMemo`/const stables pour options de calcul.

## Priorite 3 - Reduire le temps de chargement

6. **Code splitting**
   - Charger la scene 3D avec `React.lazy`/`Suspense`.
   - Extraire eventuellement certaines briques (labels/overlays) en chunks separes.

7. **Optimiser les deps et imports**
   - Verifier imports depuis `@react-three/drei` (eviter agrégations trop larges).
   - Confirmer tree-shaking effectif en prod.

## 6) Plan d'Execution Recommande

## Sprint court (0.5 - 1 jour)
- [ ] Ajouter instrumentation FPS (stats simples ou panel debug).
- [ ] Eviter `setHoveredCell` si la cellule est identique.
- [ ] Baisser frequence de `computeVertexNormals()`.
- [ ] Tester `segments` a 64 puis 48 (comparatif visuel + FPS).

Resultat attendu:
- Gains perceptibles sans refonte majeure.

## Sprint moyen (1 - 2 jours)
- [ ] Migrer deformation de l'eau vers shader GPU.
- [ ] Ajouter mode qualite (material + densite mesh).
- [ ] Introduire code splitting du bloc scene 3D.

Resultat attendu:
- FPS plus stable et meilleur TTI/chargement initial.

## 7) KPIs a Suivre

- FPS moyen et FPS 1% low sur machine cible.
- Temps de chargement initial (cold start).
- Taille JS minifiee et gzip.
- Temps CPU par frame (profil navigateur).
- Nombre de renders React par seconde pendant hover.

## 8) Risques et Arbitrages

- Passer en shader demande plus de complexite technique mais offre le meilleur ROI perf.
- Baisser `segments` peut reduire la qualite visuelle de l'eau.
- Material simplifie peut changer le rendu "premium".

Arbitrage conseille: activer profils qualite pour conserver la flexibilite selon device.

## 9) Verdict Final

Le projet est sain et deja bien structure.  
Les optimisations les plus rentables sont clairement identifiees:
1) pipeline d'animation de l'eau,  
2) reduction des mises a jour React au hover,  
3) decoupage du bundle initial.

Avec ces actions, l'application peut gagner significativement en fluidite et en temps de chargement sans perte fonctionnelle.
