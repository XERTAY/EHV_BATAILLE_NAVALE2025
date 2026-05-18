/** Déclenche le téléchargement d'un fichier texte côté navigateur. */
export function downloadTextFile(content, fileName, mimeType = 'application/json') {
  if (content == null) {
    return
  }
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName?.endsWith('.save') ? fileName : `${fileName || 'partie'}.save`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
