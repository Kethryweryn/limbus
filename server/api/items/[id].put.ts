import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess, assertSameGame } from '~/server/utils/gameAccess'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { itemInclude, validateItemRelations } from '~/server/utils/items'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const item = await prisma.item.findUnique({ where: { id }, select: { gameId: true } })
  if (!item) {
    throw createError({ statusCode: 404, message: 'Objet introuvable' })
  }
  await requireGameAccess(event, item.gameId)
  await assertUnmodifiedSince(event, 'item', id)

  const body = await readZodBody(event, itemSchema)
  assertSameGame(item.gameId, body.gameId)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, characterIds, intrigueIds, body.locationCharacterId)

  return await prisma.item.update({
    where: { id },
    data: {
      name: body.name,
      slug: await generateUniqueSlug('item', body.name, id),
      description: body.description,
      quantity: body.quantity,
      locationText: body.locationCharacterId ? null : body.locationText,
      locationCharacterId: body.locationCharacterId || null,
      gameId: body.gameId,
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
