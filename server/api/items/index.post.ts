import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { itemInclude, validateItemRelations } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, itemSchema)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, characterIds, intrigueIds, body.locationCharacterId)

  return await prisma.item.create({
    data: {
      name: body.name,
      description: body.description,
      quantity: 1,
      locationText: body.locationCharacterId ? null : body.locationText,
      locationCharacterId: body.locationCharacterId || null,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: {
        connect: characterIds.map((characterId) => ({ id: characterId }))
      },
      intrigues: {
        connect: intrigueIds.map((intrigueId) => ({ id: intrigueId }))
      }
    },
    include: itemInclude
  })
})
