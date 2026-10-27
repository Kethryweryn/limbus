import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { exposeRegistrationPeriod, findRegistrationPeriodOr404, registrationPeriodInclude } from '~/server/utils/registrationPeriods'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)

  const period = await prisma.registrationPeriod.findUniqueOrThrow({
    where: { id },
    include: registrationPeriodInclude
  })
  return exposeRegistrationPeriod(period)
})
