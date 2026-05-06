import { useMemo } from 'react'

import { BOARD_CONFIGS } from '@/config/boardConfigs'

import {
  getAiBoardIds,
  getBoardStatesById,
  getClientOwnBoardId,
  getCurrentIsAi,
  getExpectedOwnBoardId,
  getInteractiveBoards,
  getIsDuelWithAi,
  getIsPlayerInShootMode,
  getLobbyPartLabel,
  getLocalPlayerNumber,
  getShouldOfferShootMode,
  getTurnOverlayLabel,
  PHASES,
} from './selectors'

/**
 * Memorise toutes les vues derivees du couple `(gameState, lobbyState, ...)`
 * dans un seul hook. Les fonctions de calcul restent pures et testables dans
 * `selectors.js`.
 *
 * @param {{
 *   gameState: object | null,
 *   lobbyState: object,
 *   layoutSet: 'faceoff' | 'star4',
 *   setup: object,
 *   delayedOwnBoardCells: ReadonlyArray<ReadonlyArray<unknown>> | null,
 *   placement: { remainingShipsCount: number, localPlacementLocked: boolean },
 *   shoot: { shootModeActive: boolean },
 * }} params
 */
export default function useGameSelectors({
  gameState,
  lobbyState,
  layoutSet,
  setup,
  delayedOwnBoardCells,
  placement,
  shoot,
}) {
  const boards = useMemo(() => BOARD_CONFIGS[layoutSet], [layoutSet])
  const currentPlayer = gameState?.currentPlayer ?? 1
  const numPlayersInState = gameState?.boards?.length ?? 0

  const localPlayerNumber = useMemo(
    () => getLocalPlayerNumber({ lobbyState, gameState, currentPlayer }),
    [lobbyState, gameState, currentPlayer],
  )
  const isLocalTurn = currentPlayer === localPlayerNumber
  const currentIsAi = useMemo(
    () => getCurrentIsAi({ gameState, currentPlayer }),
    [gameState, currentPlayer],
  )
  const gamePhase = gameState?.phase
  const isGameOver = gamePhase === PHASES.GAME_OVER
  const didLocalPlayerWin = isGameOver && gameState?.winner === localPlayerNumber
  const boardSize = gameState?.boardSize ?? setup.boardSize ?? 10

  const boardStatesById = useMemo(
    () => getBoardStatesById({ gameState, delayedOwnBoardCells }),
    [gameState, delayedOwnBoardCells],
  )
  const expectedOwnBoardId = useMemo(
    () => getExpectedOwnBoardId({ boards, localPlayerNumber }),
    [boards, localPlayerNumber],
  )
  const clientOwnBoardId = useMemo(
    () => getClientOwnBoardId({ gameState, expectedOwnBoardId }),
    [gameState, expectedOwnBoardId],
  )
  const aiBoardIds = useMemo(
    () => getAiBoardIds({ gameState, boards }),
    [gameState, boards],
  )
  const isDuelWithAi = useMemo(() => getIsDuelWithAi(gameState), [gameState])

  const shouldOfferShootMode = useMemo(
    () => getShouldOfferShootMode({ gamePhase, isLocalTurn, currentIsAi, isGameOver }),
    [gamePhase, isLocalTurn, currentIsAi, isGameOver],
  )
  const isPlayerInShootMode = useMemo(
    () => getIsPlayerInShootMode({
      gamePhase,
      isLocalTurn,
      currentIsAi,
      shootModeActive: shoot.shootModeActive,
    }),
    [gamePhase, isLocalTurn, currentIsAi, shoot.shootModeActive],
  )

  const turnOverlayLabel = useMemo(
    () => getTurnOverlayLabel({
      lobbyInLobby: lobbyState.inLobby,
      isDuelWithAi,
      gamePhase,
      currentIsAi,
      remainingShipsCount: placement.remainingShipsCount,
      isLocalTurn,
      currentPlayer,
      isGameOver,
      didLocalPlayerWin,
    }),
    [
      lobbyState.inLobby,
      isDuelWithAi,
      gamePhase,
      currentIsAi,
      placement.remainingShipsCount,
      isLocalTurn,
      currentPlayer,
      isGameOver,
      didLocalPlayerWin,
    ],
  )

  const interactiveBoards = useMemo(
    () => getInteractiveBoards({
      gameState,
      currentIsAi,
      lobbyInLobby: lobbyState.inLobby,
      gamePhase,
      isLocalTurn,
      localPlacementLocked: placement.localPlacementLocked,
      expectedOwnBoardId,
      shouldOfferShootMode,
      shootModeActive: shoot.shootModeActive,
      boards,
      numPlayersInState,
      localPlayerNumber,
    }),
    [
      gameState,
      currentIsAi,
      lobbyState.inLobby,
      gamePhase,
      isLocalTurn,
      placement.localPlacementLocked,
      expectedOwnBoardId,
      shouldOfferShootMode,
      shoot.shootModeActive,
      boards,
      numPlayersInState,
      localPlayerNumber,
    ],
  )

  const lobbyPartLabel = useMemo(() => getLobbyPartLabel(lobbyState), [lobbyState])

  return {
    boards,
    currentPlayer,
    numPlayersInState,
    localPlayerNumber,
    isLocalTurn,
    currentIsAi,
    gamePhase,
    isGameOver,
    didLocalPlayerWin,
    boardSize,
    boardStatesById,
    expectedOwnBoardId,
    clientOwnBoardId,
    aiBoardIds,
    isDuelWithAi,
    shouldOfferShootMode,
    isPlayerInShootMode,
    turnOverlayLabel,
    interactiveBoards,
    lobbyPartLabel,
  }
}
