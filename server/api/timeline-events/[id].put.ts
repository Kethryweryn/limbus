import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { readZodBody, timelineEventSchema } from '~/server/utils/schemas'
import { timelineEventInclude, validateTimelineEventRelations } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const timelineEvent = await prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } })
  if (!timelineEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)

  const body = await readZodBody(event, timelineEventSchema)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  const itemIds = [...new Set(body.itemIds)]
  await validateTimelineEventRelations(body.gameId, characterIds, factionIds, intrigueIds, itemIds)

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
      factions: { set: factionIds.map((factionId) => ({ id: factionId })) },
      intrigues: { set: intrigueIds.map((intrigueId) => ({ id: intrigueId })) },
      items: { set: itemIds.map((itemId) => ({ id: itemId })) }
    },
    include: timelineEventInclude
  })
})
