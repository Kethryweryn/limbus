import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const timelineEvent = await prisma.timelineEvent.findUnique({
    where: { id },
    include: timelineEventInclude
  })

  if (!timelineEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  }

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
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  }

  return enrichedEvent
})
