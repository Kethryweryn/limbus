import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { factionSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, factionSchema)
  await requireGameAccess(event, body.gameId)
  const slug = await generateUniqueSlug('faction', body.name)

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

  return await prisma.faction.create({
    data: {
      name: body.name,
      slug,
      pitch: body.pitch,
      background: body.background,
      backgroundDocumentUrl: body.backgroundDocumentUrl,
      costumeIndications: body.costumeIndications,
      showInTrombinoscope: body.showInTrombinoscope ?? false,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: {
        connect: body.characterIds.map((id) => ({ id }))
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
