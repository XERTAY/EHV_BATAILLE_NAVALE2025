import { CAMERA_PRESET_STORAGE_PREFIX } from '@/constants/storage'

/**
 * Enregistre la position et la cible courantes de la camera pour un scope
 * donne (ex. partie + joueur).
 */
export function savePreset({ camera, controls, key }) {
  if (!key || !controls) return
  const payload = {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
  }
  try {
    window.localStorage.setItem(`${CAMERA_PRESET_STORAGE_PREFIX}${key}`, JSON.stringify(payload))
  } catch {
    // Quota / mode prive : on ignore.
  }
}

/**
 * Lit un preset de camera persiste pour un scope donne. Renvoie `null` si
 * indisponible ou invalide.
 */
export function readPreset(key) {
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(`${CAMERA_PRESET_STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.position) || !Array.isArray(parsed?.target)) return null
    if (parsed.position.length !== 3 || parsed.target.length !== 3) return null
    return parsed
  } catch {
    return null
  }
}
