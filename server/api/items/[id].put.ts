import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { itemInclude, validateItemRelations } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, itemSchema)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, characterIds, intrigueIds, body.locationCharacterId)

  return await prisma.item.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      locationText: body.locationCharacterId ? null : body.locationText,
      locationCharacterId: body.locationCharacterId || null,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: {
        set: characterIds.map((characterId) => ({ id: characterId }))
      },
      intrigues: {
        set: intrigueIds.map((intrigueId) => ({ id: intrigueId }))
      }
    },
    include: itemInclude
  })
})
