import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, timelineEventSchema } from '~/server/utils/schemas'
import { timelineEventInclude, validateTimelineEventRelations } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, timelineEventSchema)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  const itemIds = [...new Set(body.itemIds)]
  await validateTimelineEventRelations(body.gameId, characterIds, intrigueIds, itemIds)

  return await prisma.timelineEvent.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      day: body.day,
      time: body.time,
      requiredResponsibles: body.requiredResponsibles,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: { set: characterIds.map((characterId) => ({ id: characterId })) },
      intrigues: { set: intrigueIds.map((intrigueId) => ({ id: intrigueId })) },
      items: { set: itemIds.map((itemId) => ({ id: itemId })) }
    },
    include: timelineEventInclude
  })
})
