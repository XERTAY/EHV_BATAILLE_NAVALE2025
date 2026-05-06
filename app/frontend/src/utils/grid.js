/**
 * Clone superficiel d'une grille de cellules (matrice 2D).
 * Chaque ligne est dupliquee pour permettre une mutation locale sans alterer
 * la reference d'origine.
 *
 * @param {ReadonlyArray<ReadonlyArray<unknown>>} cells
 * @returns {Array<Array<unknown>>}
 */
export function cloneCellsGrid(cells) {
  return cells.map((row) => [...row])
}
