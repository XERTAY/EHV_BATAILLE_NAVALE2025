import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

import {
  WATER_FRAGMENT_SHADER,
  WATER_VERTEX_SHADER,
  createWaterUniforms,
} from '@/shaders/waterShader'

/**
 * Materiau d'eau anime cote GPU (vertex + fragment shaders custom).
 */
export default function WaterShaderMaterial() {
  const materialRef = useRef(null)
  const uniforms = useMemo(() => createWaterUniforms(), [])

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={WATER_VERTEX_SHADER}
      fragmentShader={WATER_FRAGMENT_SHADER}
      transparent
    />
  )
}
