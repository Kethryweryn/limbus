import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'

// Inscriptions d'une période, sans les réponses au formulaire : leur détail vient avec US-005
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)

  return await prisma.registration.findMany({
    where: { periodId: period.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sessionId: true,
      status: true,
      source: true,
      email: true,
      invitationSentAt: true,
      responseDueAt: true,
      respondedAt: true,
      createdAt: true,
      participant: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } }
    }
  })
})
