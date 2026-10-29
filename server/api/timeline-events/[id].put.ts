import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess, assertSameGame } from '~/server/utils/gameAccess'
import { readZodBody, timelineEventSchema } from '~/server/utils/schemas'
import { timelineEventInclude, validateTimelineEventRelations } from '~/server/utils/timelineEvents'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const timelineEvent = await prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } })
  if (!timelineEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)
  await assertUnmodifiedSince(event, 'timelineEvent', id)

  const body = await readZodBody(event, timelineEventSchema)
  assertSameGame(timelineEvent.gameId, body.gameId)
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
      slug: await generateUniqueSlug('timelineEvent', body.name, id),
      description: body.description,
      day: body.day,
      time: body.time,
      requiredResponsibles: body.requiredResponsibles,
      gameId: body.gameId,
      characters: { set: characterIds.map((characterId) => ({ id: characterId })) },
      factions: { set: factionIds.map((factionId) => ({ id: factionId })) },
      intrigues: { set: intrigueIds.map((intrigueId) => ({ id: intrigueId })) },
      items: { set: itemIds.map((itemId) => ({ id: itemId })) }
    },
    include: timelineEventInclude
  })
})
