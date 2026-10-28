// Un jeu archivé est un jeu dépublié : même règle sur la page Jeux et sur la page Inscriptions
export function isArchivedGame(game: { published?: boolean | null }) {
  return !game.published
}

// Crédit affiché sur la copie (R11)
export function gameCreditText(game: { creditSourceTitle?: string | null, creditAuthorName?: string | null }) {
  if (!game.creditSourceTitle) return null
  return game.creditAuthorName
    ? `D’après « ${game.creditSourceTitle} », de ${game.creditAuthorName}`
    : `D’après « ${game.creditSourceTitle} »`
}
