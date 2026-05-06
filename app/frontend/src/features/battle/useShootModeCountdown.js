import { useCallback, useEffect, useState } from 'react'

import { SHOOT_MODE_AUTO_ENTER_MS, SHOOT_MODE_UNLOCK_DELAY_MS } from '@/constants/timings'

const PROGRESS_TICK_MS = 50

/**
 * Pilote l'animation et la logique du "mode tir" :
 * - deverrouille le bouton apres `SHOOT_MODE_UNLOCK_DELAY_MS`,
 * - bascule automatiquement en mode tir actif apres `SHOOT_MODE_AUTO_ENTER_MS`,
 * - met a jour une barre de progression a 50ms d'intervalle,
 * - se reset si l'eligibilite (`shouldOffer`) disparait.
 *
 * @param {{ shouldOffer: boolean, currentPlayer: number, localPlayerNumber: number }} params
 */
export default function useShootModeCountdown({ shouldOffer, currentPlayer, localPlayerNumber }) {
  const [shootModeActive, setShootModeActive] = useState(false)
  const [shootModeButtonUnlocked, setShootModeButtonUnlocked] = useState(false)
  const [shootModeProgress, setShootModeProgress] = useState(0)

  useEffect(() => {
    if (!shouldOffer) {
      setShootModeActive(false)
      setShootModeButtonUnlocked(false)
      setShootModeProgress(0)
      return undefined
    }

    setShootModeActive(false)
    setShootModeButtonUnlocked(false)
    setShootModeProgress(0)

    const startedAt = Date.now()
    const unlockTimer = window.setTimeout(() => {
      setShootModeButtonUnlocked(true)
    }, SHOOT_MODE_UNLOCK_DELAY_MS)
    const autoEnterTimer = window.setTimeout(() => {
      setShootModeActive(true)
    }, SHOOT_MODE_AUTO_ENTER_MS)
    const progressInterval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const nextProgress = Math.min(1, elapsed / SHOOT_MODE_AUTO_ENTER_MS)
      setShootModeProgress(nextProgress)
    }, PROGRESS_TICK_MS)

    return () => {
      window.clearTimeout(unlockTimer)
      window.clearTimeout(autoEnterTimer)
      window.clearInterval(progressInterval)
    }
  }, [shouldOffer, currentPlayer, localPlayerNumber])

  const enterShootMode = useCallback(() => {
    if (!shootModeButtonUnlocked) return
    setShootModeActive(true)
  }, [shootModeButtonUnlocked])

  return {
    shootModeActive,
    shootModeButtonUnlocked,
    shootModeProgress,
    enterShootMode,
  }
}
