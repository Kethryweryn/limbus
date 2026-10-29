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

// Le contenu d'un jeu est archivé avec lui (US-013, ADR-0027). Un élément créé hors ligne n'a pas encore
// son jeu en cache : on le tient pour actif plutôt que de le faire disparaître de la liste.
export function isInArchivedGame(item: { game?: { published?: boolean | null } | null }) {
  return Boolean(item.game) && isArchivedGame(item.game!)
}

// Le contenu d'un jeu archivé n'apparaît que si l'on affiche les archives, ou si l'on a choisi ce jeu
export function isVisibleContent(item: { gameId?: string, game?: { published?: boolean | null } | null }, selectedGameId: string, showArchived: boolean) {
  return showArchived || !isInArchivedGame(item) || (Boolean(selectedGameId) && item.gameId === selectedGameId)
}
