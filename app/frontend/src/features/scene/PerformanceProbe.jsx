import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

const SAMPLING_WINDOW_S = 5
const FRAME_DROP_THRESHOLD_MS = 22
const MS_PER_SECOND = 1000
const P95_QUANTILE = 0.95

/**
 * Sonde de performance : cumule les durees de frames sur une fenetre
 * `SAMPLING_WINDOW_S` puis log un rapport (avg / p95 / drops). N'a aucun
 * impact UI (renvoie `null`).
 */
export default function PerformanceProbe({ enabled, waveMode }) {
  const samplesRef = useRef([])
  const elapsedRef = useRef(0)

  useEffect(() => {
    samplesRef.current = []
    elapsedRef.current = 0
  }, [enabled, waveMode])

  useFrame((_, delta) => {
    if (!enabled) return
    samplesRef.current.push(delta * MS_PER_SECOND)
    elapsedRef.current += delta
    if (elapsedRef.current < SAMPLING_WINDOW_S) return

    const samples = samplesRef.current.slice().sort((a, b) => a - b)
    const count = samples.length
    const avg = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, count)
    const p95 = samples[Math.min(count - 1, Math.floor(count * P95_QUANTILE))]
    const drops = samples.filter((value) => value > FRAME_DROP_THRESHOLD_MS).length
    const fps = avg > 0 ? MS_PER_SECOND / avg : 0
    console.info(
      `[Perf] mode=${waveMode} fps=${fps.toFixed(1)} avgMs=${avg.toFixed(2)} p95Ms=${p95.toFixed(2)} drops(>${FRAME_DROP_THRESHOLD_MS}ms)=${drops}/${count}`,
    )
    samplesRef.current = []
    elapsedRef.current = 0
  })

  return null
}
