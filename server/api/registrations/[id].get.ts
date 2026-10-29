import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, withSessionPresence } from '~/server/utils/registrations'
import { registrationListSelect } from '~/server/utils/registrationPeriods'

// Détail d'une inscription pour les organisatrices du jeu (US-005) : réponses au formulaire comprises,
// allergies et date du consentement (données de santé, R14)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, period } = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  setHeader(event, 'cache-control', 'private, no-store')

  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id },
    select: {
      ...registrationListSelect,
      firstName: true,
      lastName: true,
      facebookName: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      dietary: true,
      healthConsentAt: true,
      charterAcceptedAt: true,
      formVersion: { select: { number: true } },
      session: { select: { id: true, name: true } }
    }
  })
  const [withPresence] = await withSessionPresence([registration])
  return withPresence
})
