import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { factionSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, factionSchema)

  if (body.characterIds.length) {
    const matchingCharacters = await prisma.character.count({
      where: {
        id: { in: body.characterIds },
        gameId: body.gameId
      }
    })

    if (matchingCharacters !== body.characterIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Personnages invalides pour ce jeu' })
    }
  }

  return await prisma.faction.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('faction', body.name, id),
      pitch: body.pitch,
      background: body.background,
      backgroundDocumentUrl: body.backgroundDocumentUrl,
      costumeIndications: body.costumeIndications,
      gameId: body.gameId,
      published: body.published,
      characters: {
        set: body.characterIds.map((characterId) => ({ id: characterId }))
      }
    },
    include: {
      game: true,
      characters: {
        orderBy: { name: 'asc' }
      },
      intrigues: {
        orderBy: { updatedAt: 'desc' }
      }
    }
  })
})
