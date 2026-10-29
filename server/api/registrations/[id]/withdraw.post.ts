import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, withdrawRegistration } from '~/server/utils/registrations'

// Retrait d'une personne confirmée par une organisatrice : mêmes effets qu'un désistement (US-005, US-006)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)

  await withdrawRegistration(registration.id, user)
  return { success: true }
})
