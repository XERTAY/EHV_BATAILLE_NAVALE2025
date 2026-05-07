import { useCallback, useState } from 'react'

import { getCellLabel, resolveCellFromEvent } from '@/utils/boardMath'

/**
 * Encapsule la logique pointer du `WaterBoard` : resoud la cellule sous le
 * curseur, expose `hoveredCell` + handlers `onPointerMove/Out/Down`.
 *
 * @param {{
 *   boardId: string,
 *   interactive: boolean,
 *   boardMathOptions: object,
 *   onCellHover?: (data: object | null) => void,
 *   onCellClick?: (data: object) => void,
 * }} params
 */
export default function useBoardPointer({
  boardId,
  interactive,
  boardMathOptions,
  onCellHover,
  onCellClick,
}) {
  const [hoveredCell, setHoveredCell] = useState(null)
  const [isBoardHovered, setIsBoardHovered] = useState(false)

  const onPointerMove = useCallback((event) => {
    if (!interactive) return
    setIsBoardHovered(true)
    const cellData = resolveCellFromEvent(event, boardMathOptions)
    const next = { boardId, ...cellData }
    setHoveredCell(next)
    if (onCellHover) onCellHover(next)
  }, [interactive, boardMathOptions, boardId, onCellHover])

  const onPointerOut = useCallback(() => {
    if (!interactive) return
    setIsBoardHovered(false)
    setHoveredCell(null)
    if (onCellHover) onCellHover(null)
  }, [interactive, onCellHover])

  const onPointerDown = useCallback((event) => {
    if (!interactive) return
    const cellData = resolveCellFromEvent(event, boardMathOptions)
    if (!onCellClick) return
    onCellClick({ boardId, ...cellData, label: getCellLabel(cellData) })
  }, [interactive, boardMathOptions, boardId, onCellClick])

  return { hoveredCell, isBoardHovered, onPointerMove, onPointerOut, onPointerDown }
}
