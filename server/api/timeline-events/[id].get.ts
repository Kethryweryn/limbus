import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const idOrSlug = getRouterParam(event, 'id')
  if (!idOrSlug) {
    throw createError({ statusCode: 400, message: 'Paramètre manquant' })
  }

  const timelineEvent = await prisma.timelineEvent.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    include: timelineEventInclude
  })

  if (!timelineEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)

  const relatedEvents = await prisma.timelineEvent.findMany({
    where: {
      gameId: timelineEvent.gameId,
      day: timelineEvent.day,
      time: timelineEvent.time
    },
    include: timelineEventInclude
  })

  const enrichedEvent = withTimelineConflicts(relatedEvents).find((eventWithConflicts) => eventWithConflicts.id === timelineEvent.id)
  if (!enrichedEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }

  return enrichedEvent
})
