import { useEffect, useState } from 'react'

import { DEFAULT_SETUP } from '@/constants/game'
import { normalizeSetup } from '@/utils/setupNormalization'
import { loadLastSetupFromStorage, saveLastSetupToStorage } from '@/utils/setupStorage'

/**
 * Encapsule la configuration de partie persistee :
 * - hydrate l'etat initial depuis le localStorage (si dispo),
 * - garde l'etat normalise via {@link normalizeSetup},
 * - persiste automatiquement chaque changement.
 *
 * @returns {{
 *   setup: typeof DEFAULT_SETUP,
 *   setSetup: (updater: (prev: typeof DEFAULT_SETUP) => typeof DEFAULT_SETUP) => void,
 *   applySetupPatch: (patch: Partial<typeof DEFAULT_SETUP>) => void,
 * }}
 */
export default function useSetupPersistence() {
  const [setup, setSetup] = useState(DEFAULT_SETUP)

  useEffect(() => {
    const lastSetup = loadLastSetupFromStorage()
    if (lastSetup) {
      setSetup((current) => normalizeSetup({ ...current, ...lastSetup }))
    }
  }, [])

  useEffect(() => {
    saveLastSetupToStorage(setup)
  }, [setup])

  const applySetupPatch = (patch) => {
    setSetup((current) => normalizeSetup({ ...current, ...patch }))
  }

  return { setup, setSetup, applySetupPatch }
}
