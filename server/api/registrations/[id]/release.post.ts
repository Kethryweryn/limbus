import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, releaseRegistration } from '~/server/utils/registrations'
import { readZodBody, registrationTargetSchema } from '~/server/utils/schemas'

// Libère une invitation sans réponse, ou une place retenue pas confirmée (US-005, US-089, R20) : la liste d'attente de
// la session propose alors sa première personne (R23)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const { sessionId } = await readZodBody(event, registrationTargetSchema)

  return await releaseRegistration(registration.id, user, sessionId)
})
