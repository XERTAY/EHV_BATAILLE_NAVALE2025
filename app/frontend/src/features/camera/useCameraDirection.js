import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  FACE_OFF_CAMERA_DIRECTION_BY_PLAYER,
  STAR4_CAMERA_DIRECTION_BY_PLAYER,
} from '@/constants/game'

const DIRECTION_LABELS = {
  NORTH: 'NORD',
  SOUTH: 'SUD',
  EAST: 'EST',
  WEST: 'OUEST',
}

function pickAnchorPlayer({ isPlayerInShootMode, numPlayersInState, localPlayerNumber }) {
  if (isPlayerInShootMode && numPlayersInState === 2) {
    return localPlayerNumber === 1 ? 2 : 1
  }
  return localPlayerNumber
}

function pickDirection(layoutSet, anchorPlayer) {
  if (layoutSet === 'star4') {
    return STAR4_CAMERA_DIRECTION_BY_PLAYER[anchorPlayer] ?? 'NORTH'
  }
  return FACE_OFF_CAMERA_DIRECTION_BY_PLAYER[anchorPlayer] ?? 'SOUTH'
}

/**
 * Encapsule la logique de direction de la camera et de la boussole :
 * - calcul de la direction par defaut selon le layout et le mode tir,
 * - override manuel via la boussole,
 * - reset de l'override quand le contexte change (anchor / lobby / joueur).
 *
 * @param {{
 *   layoutSet: 'faceoff' | 'star4',
 *   localPlayerNumber: number,
 *   numPlayersInState: number,
 *   isPlayerInShootMode: boolean,
 *   lobbyGameId: string | null,
 * }} params
 */
export default function useCameraDirection({
  layoutSet,
  localPlayerNumber,
  numPlayersInState,
  isPlayerInShootMode,
  lobbyGameId,
}) {
  const cameraAnchorPlayer = useMemo(
    () => pickAnchorPlayer({ isPlayerInShootMode, numPlayersInState, localPlayerNumber }),
    [isPlayerInShootMode, numPlayersInState, localPlayerNumber],
  )
  const cameraDirection = useMemo(
    () => pickDirection(layoutSet, cameraAnchorPlayer),
    [layoutSet, cameraAnchorPlayer],
  )
  const cameraStateKey = useMemo(() => {
    const gamePart = lobbyGameId ?? 'local'
    return `${gamePart}:player:${localPlayerNumber}`
  }, [lobbyGameId, localPlayerNumber])

  const [manualCameraDirection, setManualCameraDirection] = useState(null)
  const [cameraFacingDirection, setCameraFacingDirection] = useState(cameraDirection)

  useEffect(() => {
    setManualCameraDirection(null)
    setCameraFacingDirection(cameraDirection)
  }, [cameraDirection, cameraStateKey])

  const effectiveCameraDirection = manualCameraDirection ?? cameraDirection
  const canChooseCameraDirection = !isPlayerInShootMode

  const handleCompassDirectionClick = useCallback(
    (direction) => {
      if (!canChooseCameraDirection) return
      setManualCameraDirection(direction)
    },
    [canChooseCameraDirection],
  )

  const cameraDirectionLabel = useMemo(
    () => DIRECTION_LABELS[cameraFacingDirection] ?? DIRECTION_LABELS.WEST,
    [cameraFacingDirection],
  )

  return {
    effectiveCameraDirection,
    cameraFacingDirection,
    setCameraFacingDirection,
    cameraStateKey,
    cameraDirectionLabel,
    canChooseCameraDirection,
    handleCompassDirectionClick,
  }
}
