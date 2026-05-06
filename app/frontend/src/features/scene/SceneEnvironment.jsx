import { Environment, Sky } from '@react-three/drei'
import { Suspense } from 'react'

const SUN_POSITION = [140, 95, 120]

/**
 * Ciel procedural + IBL type studio pour eclairer les materiaux FBX,
 * avec un soleil directionnel coherent avec le Sky.
 */
export default function SceneEnvironment() {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={SUN_POSITION}
        mieCoefficient={0.004}
        mieDirectionalG={0.84}
        rayleigh={1}
        turbidity={5}
      />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.95} background={false} />
      </Suspense>
      <hemisphereLight args={['#c9e3ff', '#1c2230', 0.55]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={SUN_POSITION}
        intensity={1.4}
        color="#fff8ed"
        castShadow={false}
      />
      <directionalLight position={[-90, 40, -70]} intensity={0.28} color="#b8c8ff" />
    </>
  )
}
