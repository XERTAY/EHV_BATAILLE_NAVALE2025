import { Suspense } from 'react'

import FleetShipMeshesInner from './FleetShipMeshesInner'

/**
 * Wrapper Suspense autour de la flotte 3D : evite que la suspension du
 * chargement du modele FBX ne fasse remonter un fallback dans tout l'arbre.
 */
export default function FleetShipMeshes(props) {
  return (
    <Suspense fallback={null}>
      <FleetShipMeshesInner {...props} />
    </Suspense>
  )
}
