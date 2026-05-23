import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const gameId = getQuery(event).gameId?.toString()
  const events = await prisma.timelineEvent.findMany({
    where: gameId ? { gameId } : undefined,
    orderBy: [{ day: 'asc' }, { time: 'asc' }, { name: 'asc' }],
    include: timelineEventInclude
  })

  return withTimelineConflicts(events)
})
