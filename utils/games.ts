// Un jeu archivé est un jeu dépublié : même règle sur la page Jeux et sur la page Inscriptions
export function isArchivedGame(game: { published?: boolean | null }) {
  return !game.published
}
