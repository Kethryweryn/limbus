import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404, registrationListSelect } from '~/server/utils/registrationPeriods'
import { withSessionPresence } from '~/server/utils/registrations'
import { withGameValues } from '~/server/utils/participantValues'

// Inscriptions d'une période, sans les réponses au formulaire (détail : GET /api/registrations/:id)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)

  // Noms tenus par l'équipe du jeu (ADR-0086)
  return await withSessionPresence(await withGameValues(await prisma.registration.findMany({
    where: { periodId: period.id },
    orderBy: { createdAt: 'asc' },
    select: registrationListSelect
  })))
})
