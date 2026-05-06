import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

const NORMAL_RECOMPUTE_INTERVAL = 2

/**
 * Anime la geometrie de l'eau en CPU (mode `cpu`). En mode `gpu`, le hook
 * est essentiellement no-op puisque la deformation est faite dans le shader.
 *
 * @param {{ geometryRef: { current: THREE.BufferGeometry | null }, waveMode: 'cpu' | 'gpu' }} params
 */
export default function useCpuWaveAnimation({ geometryRef, waveMode }) {
  const baseVerticesRef = useRef(null)
  const frameCounterRef = useRef(0)

  useFrame(({ clock }) => {
    if (waveMode === 'gpu') return
    const geometry = geometryRef.current
    if (!geometry) return
    const positionAttribute = geometry.attributes.position
    if (!baseVerticesRef.current) {
      baseVerticesRef.current = positionAttribute.array.slice()
    }
    const baseVertices = baseVerticesRef.current
    const array = positionAttribute.array
    const t = clock.elapsedTime

    for (let i = 0; i < positionAttribute.count; i += 1) {
      const idx = i * 3
      const x = baseVertices[idx]
      const y = baseVertices[idx + 1]
      array[idx + 2] =
        Math.sin(x * 0.13 + t * 1.1) * Math.cos(y * 0.11 + t * 1.05) * 1.25
        + Math.sin(x * 0.05 - t * 0.55) * Math.cos(y * 0.06 - t * 0.5) * 0.75
    }

    positionAttribute.needsUpdate = true
    frameCounterRef.current += 1
    if (frameCounterRef.current % NORMAL_RECOMPUTE_INTERVAL === 0) {
      geometry.computeVertexNormals()
    }
  })
}
