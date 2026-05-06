import { useCallback, useEffect, useRef, useState } from 'react'

import { ENEMY_IMPACT_STAGGER_MS, IMPACT_FLASH_MS } from '@/constants/timings'
import { cloneCellsGrid } from '@/utils/grid'

const IMPACT_VALUES = new Set(['MISS', 'HIT', 'SUNK'])

function buildImpactStatus(impactType) {
  if (impactType === 'SUNK') return 'Votre flotte a subi un coup critique (navire coule).'
  if (impactType === 'HIT') return 'Alerte: l\u2019ennemi a touche votre grille.'
  return "L'ennemi a tire sans toucher."
}

/**
 * Encapsule la file d'attente d'affichage echelonne des impacts adverses sur
 * la grille du joueur local, ainsi que le "flash" temporaire des derniers
 * impacts (utilise pour les FX 3D).
 *
 * Comportement preserve depuis l'implementation originale d'`App.jsx` :
 * - les changements EMPTY/SHIP s'appliquent immediatement,
 * - les MISS/HIT/SUNK sont mis en file et reveles toutes les
 *   `ENEMY_IMPACT_STAGGER_MS`,
 * - une fois reveles, ils declenchent un message de statut + un flash
 *   `IMPACT_FLASH_MS` exploite par les particules.
 *
 * @param {{
 *   gameState: object | null,
 *   clientOwnBoardId: string,
 *   onStatus?: (message: string) => void,
 * }} params
 */
export default function useEnemyImpactReveal({ gameState, clientOwnBoardId, onStatus }) {
  const [delayedOwnBoardCells, setDelayedOwnBoardCells] = useState(null)
  const [recentImpactsByBoard, setRecentImpactsByBoard] = useState({})

  const delayedOwnBoardTimerRef = useRef(null)
  const displayedOwnBoardCellsRef = useRef(null)
  const pendingImpactRevealsRef = useRef([])
  const impactRevealInProgressRef = useRef(false)
  const previousDisplayedOwnBoardCellsRef = useRef(null)
  const impactClearTimerRef = useRef(null)

  const onStatusRef = useRef(onStatus)
  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  const scheduleNextImpactReveal = useCallback((delayBeforeRevealMs = ENEMY_IMPACT_STAGGER_MS) => {
    if (impactRevealInProgressRef.current) return
    if (pendingImpactRevealsRef.current.length === 0) return
    impactRevealInProgressRef.current = true
    delayedOwnBoardTimerRef.current = window.setTimeout(() => {
      const nextImpact = pendingImpactRevealsRef.current.shift()
      const displayedCells = displayedOwnBoardCellsRef.current
      if (nextImpact && Array.isArray(displayedCells?.[nextImpact.y])) {
        const nextDisplayed = cloneCellsGrid(displayedCells)
        nextDisplayed[nextImpact.y][nextImpact.x] = nextImpact.value
        displayedOwnBoardCellsRef.current = nextDisplayed
        setDelayedOwnBoardCells(nextDisplayed)
      }
      delayedOwnBoardTimerRef.current = null
      impactRevealInProgressRef.current = false
      if (pendingImpactRevealsRef.current.length > 0) {
        scheduleNextImpactReveal(ENEMY_IMPACT_STAGGER_MS)
      }
    }, delayBeforeRevealMs)
  }, [])

  // Cleanup global des timers au demontage.
  useEffect(() => {
    return () => {
      if (delayedOwnBoardTimerRef.current) {
        window.clearTimeout(delayedOwnBoardTimerRef.current)
        delayedOwnBoardTimerRef.current = null
      }
      if (impactClearTimerRef.current) {
        window.clearTimeout(impactClearTimerRef.current)
        impactClearTimerRef.current = null
      }
    }
  }, [])

  // Compare la grille recue serveur avec celle affichee : applique les changements
  // immediats et empile les impacts adverses pour un reveal echelonne.
  useEffect(() => {
    if (!gameState || gameState.phase !== 'BATTLE') {
      if (delayedOwnBoardTimerRef.current) {
        window.clearTimeout(delayedOwnBoardTimerRef.current)
        delayedOwnBoardTimerRef.current = null
      }
      pendingImpactRevealsRef.current = []
      impactRevealInProgressRef.current = false
      displayedOwnBoardCellsRef.current = null
      previousDisplayedOwnBoardCellsRef.current = null
      setDelayedOwnBoardCells(null)
      return
    }

    const ownBoard = gameState.boards?.find((board) => board.ownBoard)
    const nextCells = ownBoard?.cells
    if (!ownBoard || !Array.isArray(nextCells)) return

    const displayedCells = displayedOwnBoardCellsRef.current
    if (!displayedCells) {
      displayedOwnBoardCellsRef.current = nextCells
      previousDisplayedOwnBoardCellsRef.current = nextCells
      setDelayedOwnBoardCells(nextCells)
      return
    }

    const nextDisplayed = cloneCellsGrid(displayedCells)
    let hasImmediateChange = false
    let newlyQueuedEnemyImpacts = 0
    for (let y = 0; y < nextCells.length; y += 1) {
      const nextRow = nextCells[y] ?? []
      const shownRow = nextDisplayed[y] ?? []
      for (let x = 0; x < nextRow.length; x += 1) {
        const nextCell = nextRow[x]
        const shownCell = shownRow[x]
        if (nextCell === shownCell) continue
        if (IMPACT_VALUES.has(nextCell)) {
          pendingImpactRevealsRef.current.push({ x, y, value: nextCell })
          newlyQueuedEnemyImpacts += 1
          continue
        }
        shownRow[x] = nextCell
        hasImmediateChange = true
      }
    }

    if (hasImmediateChange) {
      displayedOwnBoardCellsRef.current = nextDisplayed
      setDelayedOwnBoardCells(nextDisplayed)
    }
    if (newlyQueuedEnemyImpacts > 0 && !impactRevealInProgressRef.current) {
      scheduleNextImpactReveal(0)
    }
  }, [gameState, scheduleNextImpactReveal])

  // Detecte les nouvelles MISS/HIT/SUNK qui viennent d'apparaitre dans la
  // grille AFFICHEE (post-staggering) et declenche un flash + un message.
  useEffect(() => {
    if (!gameState || gameState.phase !== 'BATTLE' || !Array.isArray(delayedOwnBoardCells)) {
      previousDisplayedOwnBoardCellsRef.current = null
      return
    }
    const previousOwnBoardCells = previousDisplayedOwnBoardCellsRef.current
    previousDisplayedOwnBoardCellsRef.current = delayedOwnBoardCells
    if (!Array.isArray(previousOwnBoardCells)) return

    const impactStartedAt = Date.now()
    const impacts = []
    for (let y = 0; y < delayedOwnBoardCells.length; y += 1) {
      const row = delayedOwnBoardCells[y] ?? []
      const previousRow = previousOwnBoardCells[y] ?? []
      for (let x = 0; x < row.length; x += 1) {
        const nextCell = row[x]
        const prevCell = previousRow[x]
        if (nextCell === prevCell) continue
        if (IMPACT_VALUES.has(nextCell)) {
          impacts.push({ x, y, type: nextCell, startedAt: impactStartedAt })
        }
      }
    }
    if (impacts.length === 0) return

    setRecentImpactsByBoard({ [clientOwnBoardId]: impacts })
    const last = impacts[impacts.length - 1]
    onStatusRef.current?.(buildImpactStatus(last.type))

    if (impactClearTimerRef.current) {
      window.clearTimeout(impactClearTimerRef.current)
    }
    impactClearTimerRef.current = window.setTimeout(() => {
      setRecentImpactsByBoard({})
      impactClearTimerRef.current = null
    }, IMPACT_FLASH_MS)
  }, [gameState, delayedOwnBoardCells, clientOwnBoardId])

  return { delayedOwnBoardCells, recentImpactsByBoard }
}
