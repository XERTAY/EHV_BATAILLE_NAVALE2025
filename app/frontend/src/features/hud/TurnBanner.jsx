/**
 * Bandeau de tour : message contextuel (placement / tir / victoire / defaite).
 */
export default function TurnBanner({ label, isGameOver, didLocalPlayerWin }) {
  if (!label) return null
  const classes = ['turn-banner']
  if (isGameOver) classes.push('turn-banner--result')
  if (didLocalPlayerWin) classes.push('turn-banner--victory')
  if (isGameOver && !didLocalPlayerWin) classes.push('turn-banner--defeat')
  return <div className={classes.join(' ')}>{label}</div>
}
