/**
 * Toast d'erreur non bloquant pour les retours backend.
 */
export default function ErrorToast({ message }) {
  if (!message) return null
  return (
    <div className="shot-feedback shot-feedback--error">
      Erreur: {message}
    </div>
  )
}
