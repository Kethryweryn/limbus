import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { factionSchema, readZodBody } from '~/server/utils/schemas'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const faction = await prisma.faction.findUnique({ where: { id }, select: { gameId: true } })
  if (!faction) {
    throw createError({ statusCode: 404, message: 'Groupe introuvable' })
  }
  await requireGameAccess(event, faction.gameId)
  await assertUnmodifiedSince(event, 'faction', id)

  const body = await readZodBody(event, factionSchema)
  await requireGameAccess(event, body.gameId)

  if (body.characterIds.length) {
    const matchingCharacters = await prisma.character.count({
      where: {
        id: { in: body.characterIds },
        gameId: body.gameId
      }
    })

    if (matchingCharacters !== body.characterIds.length) {
      throw createError({ statusCode: 400, message: 'Personnages invalides pour ce jeu' })
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
      showInTrombinoscope: body.showInTrombinoscope ?? false,
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
