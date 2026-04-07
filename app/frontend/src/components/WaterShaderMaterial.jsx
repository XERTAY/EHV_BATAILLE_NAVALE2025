import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  createWaterUniforms,
  WATER_FRAGMENT_SHADER,
  WATER_VERTEX_SHADER,
} from '../shaders/waterShader'

function WaterShaderMaterial() {
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

export default WaterShaderMaterial
