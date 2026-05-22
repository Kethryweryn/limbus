import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { readZodBody, updateCharacterSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, updateCharacterSchema)
  const { name, pitch, background, backgroundDocumentUrl, costumeIndications, gameId, factionIds, published } = body
  const existingCharacter = factionIds ? await prisma.character.findUnique({
    where: { id },
    select: { gameId: true }
  }) : null

  const targetGameId = gameId || existingCharacter?.gameId
  if (factionIds && targetGameId) {
    const matchingFactions = await prisma.faction.count({
      where: {
        id: { in: factionIds },
        gameId: targetGameId
      }
    })

    if (matchingFactions !== factionIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Groupes invalides pour ce jeu' })
    }
  }

  const data: any = {
    pitch,
    background,
    backgroundDocumentUrl,
    costumeIndications,
    gameId,
    published
  }

  if (name) {
    data.name = name
    data.slug = await generateUniqueSlug('character', name, id)
  }

  if (factionIds) {
    data.factions = {
      set: factionIds.map((factionId) => ({ id: factionId }))
    }
  }

  return await prisma.character.update({
    where: { id },
    data,
    include: {
      game: true,
      factions: true
    }
  })
})
