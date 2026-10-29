import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnansweredInvitation, findRegistrationOr404, releaseRegistration } from '~/server/utils/registrations'

// Libère la place d'une invitation sans réponse (US-005, R20) : l'inscription passe à désistée
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  assertUnansweredInvitation(registration)

  return await releaseRegistration(registration.id, user)
})
