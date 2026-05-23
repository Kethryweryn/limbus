import { prisma } from '~/server/utils/prisma'

export const itemInclude = {
  game: true,
  locationCharacter: true,
  characters: {
    orderBy: { name: 'asc' as const }
  },
  intrigues: {
    orderBy: { name: 'asc' as const }
  }
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
      throw createError({ statusCode: 400, statusMessage: 'Personnages invalides pour ce jeu' })
    }
  }

  if (intrigueIds.length) {
    const count = await prisma.intrigue.count({
      where: { id: { in: intrigueIds }, gameId }
    })
    if (count !== intrigueIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Intrigues invalides pour ce jeu' })
    }
  }
}
