import { useEffect, useRef } from 'react'

import { AI_STEP_DELAY_MS } from '@/constants/timings'

/**
 * Pilote les coups de l'IA en duel : declenche un setTimeout aligne sur
 * `AI_STEP_DELAY_MS` quand c'est au tour d'un joueur IA, en evitant les appels
 * concurrents grace a un verrou.
 *
 * @param {{
 *   enabled: boolean,
 *   runAiStepAction: (lobbyGameId?: string) => Promise<unknown>,
 *   lobbyGameId: string | null,
 *   lobbyInLobby: boolean,
 *   lobbyIsHost: boolean,
 *   onStatus?: (message: string) => void,
 * }} params
 */
export default function useAiTurnDriver({
  enabled,
  runAiStepAction,
  lobbyGameId,
  lobbyInLobby,
  lobbyIsHost,
  onStatus,
  onAiAction,
}) {
  const lockRef = useRef(false)
  const onStatusRef = useRef(onStatus)
  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  useEffect(() => {
    if (!enabled) return undefined
    if (lobbyInLobby && !lobbyIsHost) return undefined
    if (lockRef.current) return undefined
    lockRef.current = true

    onStatusRef.current?.("Tour de l'IA...")

    const timerId = window.setTimeout(async () => {
      try {
        const scopedGameId = lobbyInLobby && lobbyGameId ? lobbyGameId : undefined
        const action = await runAiStepAction(scopedGameId)
        if (onAiAction) onAiAction(action)
      } catch {
        // L'erreur est geree dans le hook API.
      } finally {
        lockRef.current = false
      }
    }, AI_STEP_DELAY_MS)

    return () => {
      window.clearTimeout(timerId)
      lockRef.current = false
    }
  }, [enabled, runAiStepAction, lobbyGameId, lobbyInLobby, lobbyIsHost, onAiAction])
}
