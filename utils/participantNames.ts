/**
 * Nom d'une personne tel que le tient l'équipe d'un jeu (SPEC-022 R6, ADR-0086) : la liste des participants donne le
 * nom de chaque jeu visible (`gameNames`) ; sans jeu précis ni nom pour ce jeu, celui de la fiche.
 */
export const nameInGame = (participant: { name: string, gameNames?: Record<string, string | null> }, gameId?: string | null) =>
  (gameId && participant.gameNames?.[gameId]) || participant.name
