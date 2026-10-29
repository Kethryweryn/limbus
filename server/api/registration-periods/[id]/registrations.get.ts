import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404, registrationListSelect } from '~/server/utils/registrationPeriods'
import { withSessionPresence } from '~/server/utils/registrations'

// Inscriptions d'une période, sans les réponses au formulaire (détail : GET /api/registrations/:id)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)

  return await withSessionPresence(await prisma.registration.findMany({
    where: { periodId: period.id },
    orderBy: { createdAt: 'asc' },
    select: registrationListSelect
  }))
})
