import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const gameId = getQuery(event).gameId?.toString()
  const events = await prisma.timelineEvent.findMany({
    where: await gameScopedWhere(event, gameId ? { gameId } : {}),
    orderBy: [{ day: 'asc' }, { time: 'asc' }, { name: 'asc' }],
    include: timelineEventInclude
  })

  return withTimelineConflicts(events)
})
