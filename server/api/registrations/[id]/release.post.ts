import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, releaseRegistration } from '~/server/utils/registrations'

// Libère la place d'une invitation sans réponse, ou d'une place retenue pas confirmée (US-005, US-089, R20) :
// l'inscription passe à désistée, et la liste d'attente de la session propose sa première personne (R21)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)

  return await releaseRegistration(registration, user)
})
