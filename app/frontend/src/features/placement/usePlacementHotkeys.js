import { useEffect } from 'react'

const ROTATE_KEY = 'r'

function isFromTextInput(target) {
  const tag = target?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

/**
 * Branche le raccourci clavier "R" qui declenche une rotation horaire de
 * l'orientation de placement.
 *
 * @param {{ enabled: boolean, onRotate: () => void }} params
 */
export default function usePlacementHotkeys({ enabled, onRotate }) {
  useEffect(() => {
    if (!enabled) return undefined

    const handleKeyDown = (event) => {
      if (event.repeat) return
      if (event.key?.toLowerCase() !== ROTATE_KEY) return
      if (isFromTextInput(event.target)) return
      event.preventDefault()
      onRotate()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onRotate])
}
