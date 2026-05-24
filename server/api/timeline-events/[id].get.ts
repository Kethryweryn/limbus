import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const timelineEvent = await prisma.timelineEvent.findUnique({
    where: { id },
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

  const enrichedEvent = withTimelineConflicts(relatedEvents).find((eventWithConflicts) => eventWithConflicts.id === id)
  if (!enrichedEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }

  return enrichedEvent
})
