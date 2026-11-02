import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere, queryGameFilter } from '~/server/utils/gameAccess'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const events = await prisma.timelineEvent.findMany({
    where: await gameScopedWhere(event, queryGameFilter(event)),
    orderBy: [{ day: 'asc' }, { time: 'asc' }, { name: 'asc' }],
    include: timelineEventInclude
  })

  return withTimelineConflicts(events)
})
