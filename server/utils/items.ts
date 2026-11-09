import { prisma } from '~/server/utils/prisma'

export const itemInclude = {
  game: true,
  locationCharacter: true,
  // Liens par les tables qui portent le jeu (US-191) : la lecture passe par unlinked
  characterLinks: { select: { character: true }, orderBy: { character: { name: 'asc' as const } } },
  intrigueLinks: { select: { intrigue: true }, orderBy: { intrigue: { name: 'asc' as const } } }
}

export async function validateItemRelations(gameId: string, characterIds: string[], intrigueIds: string[], locationCharacterId?: string | null) {
  const allCharacterIds = [...new Set([
    ...characterIds,
    ...(locationCharacterId ? [locationCharacterId] : [])
  ])]

  if (allCharacterIds.length) {
    const count = await prisma.character.count({
      where: {
        id: { in: allCharacterIds },
        gameId
      }
    })
    if (count !== allCharacterIds.length) {
      throw createError({ statusCode: 400, message: 'Personnages invalides pour ce jeu' })
    }
  }

  if (intrigueIds.length) {
    const count = await prisma.intrigue.count({
      where: { id: { in: intrigueIds }, gameId }
    })
    if (count !== intrigueIds.length) {
      throw createError({ statusCode: 400, message: 'Intrigues invalides pour ce jeu' })
    }
  }
}
