import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

import { IMPACT_ANIMATION_MS, PARTICLE_COUNT, impactColor, impactParticleColor } from './boardVisuals'

const PARTICLE_RING_BASE = 0.35
const PARTICLE_RING_STEP = 0.12
const PARTICLE_SPEED_BASE = 0.35
const PARTICLE_SPEED_STEP = 0.09
const PARTICLE_SIZE_BASE = 0.18
const PARTICLE_SIZE_STEP = 0.08
const PARTICLE_WOBBLE_BASE = 0.2
const PARTICLE_WOBBLE_STEP = 0.08

function createImpactParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    angle: (index / PARTICLE_COUNT) * Math.PI * 2,
    ring: PARTICLE_RING_BASE + ((index % 5) * PARTICLE_RING_STEP),
    speed: PARTICLE_SPEED_BASE + ((index % 7) * PARTICLE_SPEED_STEP),
    wobble: PARTICLE_WOBBLE_BASE + ((index % 3) * PARTICLE_WOBBLE_STEP),
    size: PARTICLE_SIZE_BASE + ((index % 4) * PARTICLE_SIZE_STEP),
  }))
}

function ImpactParticles({ cell, cellSize }) {
  const groupRef = useRef(null)
  const particleRefs = useRef([])
  const particles = useMemo(() => createImpactParticles(), [])
  const color = impactParticleColor(cell.type)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const nowMs = Date.now()
    const startedAt = Number(cell.startedAt) || 0
    const elapsedMs = Math.max(0, nowMs - startedAt)
    const progress = Math.min(1, elapsedMs / IMPACT_ANIMATION_MS)
    const life = 1 - progress
    const t = elapsedMs * 0.001

    const burstScale = 0.55 + Math.sin(elapsedMs * 0.01) * 0.1
    group.scale.setScalar(0.8 + burstScale * life * 0.9)

    for (let i = 0; i < particles.length; i += 1) {
      const part = particles[i]
      const mesh = particleRefs.current[i]
      if (!mesh?.material) continue
      const radial = (part.ring + progress * (1.2 + part.speed)) * cellSize * 0.26
      const wave = Math.sin(t * (3 + part.speed) + i) * part.wobble * cellSize * 0.05
      const x = Math.cos(part.angle + t * 0.7) * radial + wave
      const y = Math.sin(part.angle + t * 0.7) * radial - wave
      const z = 0.12 + Math.sin(t * 5 + i) * 0.05 + progress * 0.18
      mesh.position.set(x, y, z)
      const s = (part.size * cellSize * 0.1) * (0.7 + life * 1.1)
      mesh.scale.set(s, s, s)
      mesh.material.opacity = Math.max(0.12, 0.25 + life * 0.75)
    }
  })

  return (
    <group ref={groupRef} position={[cell.x, cell.y, 0.08]}>
      {particles.map((_part, idx) => (
        <mesh
          key={`p-${cell.key}-${idx}`}
          ref={(node) => { particleRefs.current[idx] = node }}
          renderOrder={8}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function AnimatedImpactCell({ cell, cellSize }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)

  useFrame(() => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (!mesh || !material) return
    const nowMs = Date.now()
    const startedAt = Number(cell.startedAt) || 0
    const elapsedMs = Math.max(0, nowMs - startedAt)
    const progress = Math.min(1, elapsedMs / IMPACT_ANIMATION_MS)
    const life = 1 - progress

    const pulse = Math.sin(elapsedMs * 0.006)
    const blink = Math.sin(elapsedMs * 0.022)
    const dynamicScale = 1 + pulse * 0.12 * (0.4 + life * 0.6)
    mesh.scale.set(dynamicScale, dynamicScale, 1)

    const baseOpacity = 0.46 + life * 0.32
    const blinkOpacity = blink * 0.06 * life
    material.opacity = Math.max(0.18, Math.min(0.92, baseOpacity + blinkOpacity))
  })

  return (
    <mesh ref={meshRef} position={[cell.x, cell.y, 0.07]}>
      <planeGeometry args={[cellSize * 0.95, cellSize * 0.95]} />
      <meshBasicMaterial ref={materialRef} color={impactColor(cell.type)} transparent opacity={0.9} />
    </mesh>
  )
}

/**
 * FX d'impact (cellule animee + particules) groupe en un composant pour
 * etre rendu directement dans `WaterBoard`.
 */
export default function ImpactFx({ cell, cellSize }) {
  return (
    <group>
      <AnimatedImpactCell cell={cell} cellSize={cellSize} />
      <ImpactParticles cell={cell} cellSize={cellSize} />
    </group>
  )
}
