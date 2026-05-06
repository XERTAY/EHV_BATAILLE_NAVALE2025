import { LAST_SETUP_KEY } from '@/constants/storage'

import { normalizeSetup } from './setupNormalization'

/**
 * Charge la derniere configuration de partie depuis le localStorage du
 * navigateur. Renvoie `null` cote serveur ou si aucune configuration valide
 * n'est presente.
 *
 * @returns {ReturnType<typeof normalizeSetup> | null}
 */
export function loadLastSetupFromStorage() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_SETUP_KEY)
    if (!raw) return null
    return normalizeSetup(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Persiste la configuration courante en localStorage. No-op cote serveur.
 *
 * @param {object} setup
 */
export function saveLastSetupToStorage(setup) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_SETUP_KEY, JSON.stringify(setup))
}
