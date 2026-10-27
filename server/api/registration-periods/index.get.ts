import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { exposeRegistrationPeriod, registrationPeriodInclude } from '~/server/utils/registrationPeriods'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = getQuery(event).gameId
  const periods = await prisma.registrationPeriod.findMany({
    where: await gameScopedWhere(event, typeof gameId === 'string' && gameId ? { gameId } : {}),
    orderBy: { createdAt: 'desc' },
    include: registrationPeriodInclude
  })

  return periods.map(exposeRegistrationPeriod)
})
