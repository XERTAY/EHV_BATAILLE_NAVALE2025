import { useEffect, useMemo, useState } from 'react'

function formatRemainingSeconds(forfeitDeadlineAt, nowMs) {
  if (!forfeitDeadlineAt) return null
  const deadline = Date.parse(forfeitDeadlineAt)
  if (Number.isNaN(deadline)) return null
  const delta = Math.max(0, Math.ceil((deadline - nowMs) / 1000))
  return delta
}

export default function OpponentPresencePanel({ presence }) {
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    if (!presence?.disconnected) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [presence?.disconnected])

  const remainingSeconds = useMemo(
    () => formatRemainingSeconds(presence?.forfeitDeadlineAt, nowMs),
    [presence?.forfeitDeadlineAt, nowMs],
  )

  if (!presence) return null
  if (presence.disconnected) {
    return (
      <aside className="opponent-presence-panel">
        <strong>Adversaire deconnecte</strong>
        <span>Joueur {presence.disconnectedPlayerNumber ?? '?'}</span>
        {remainingSeconds != null ? <span>Forfait dans {remainingSeconds}s</span> : null}
      </aside>
    )
  }
  if (presence.lastEvent === 'reconnected') {
    return <aside className="opponent-presence-panel">Adversaire reconnecte.</aside>
  }
  if (presence.lastEvent === 'forfeited') {
    return <aside className="opponent-presence-panel">Adversaire forfait.</aside>
  }
  return null
}
