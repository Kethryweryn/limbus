export const itemInclude = {
  game: true,
  locationCharacter: true,
  // Liens par les tables qui portent le jeu (US-191) : la lecture passe par unlinked
  characterLinks: { select: { character: true }, orderBy: { character: { name: 'asc' as const } } },
  intrigueLinks: { select: { intrigue: true }, orderBy: { intrigue: { name: 'asc' as const } } }
}

