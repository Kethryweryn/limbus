import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'

// Les inscriptions (US-003) rendront la suppression impossible tant qu'il y en a : on clôturera alors
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)

  await prisma.registrationPeriod.delete({ where: { id } })
  return { success: true }
})
