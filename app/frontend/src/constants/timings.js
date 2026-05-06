/**
 * Cadence des coups IA : alignee sur ENEMY_IMPACT_STAGGER_MS pour que la grille
 * defenseur reste lisible.
 */
export const AI_STEP_DELAY_MS = 1000

/** Delai apres lequel le bouton "Mode tir" devient cliquable. */
export const SHOOT_MODE_UNLOCK_DELAY_MS = 1000

/** Delai apres lequel le mode tir est entre automatiquement (si non clique avant). */
export const SHOOT_MODE_AUTO_ENTER_MS = 7000

/** Duree d'affichage du flash d'impact sur la grille du joueur. */
export const IMPACT_FLASH_MS = 3000

/**
 * Ecart minimum entre deux impacts adverses visibles sur votre grille
 * (rafales ou reseau rapide). Le premier coup d'une serie s'affiche tout de suite.
 */
export const ENEMY_IMPACT_STAGGER_MS = 1000

/**
 * Synchronisation HTTP reguliere en lobby (complement des messages WebSocket
 * GAME_STATE_UPDATE).
 */
export const LOBBY_SYNC_POLL_MS = 400
