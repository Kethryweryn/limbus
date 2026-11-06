import { cancelRegistrationSession } from '~/server/utils/registrations'
import { assertCanCancelSession, exposePublicRegistration, guardPublicRegistrationRequest, requireRegistrationByToken } from '~/server/utils/publicRegistrations'
import { readZodBody, registrationSessionTargetSchema } from '~/server/utils/schemas'

// Annuler sa présence à une session par son lien personnel (R19) : la personne reste dans le vivier
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  const registration = await requireRegistrationByToken(token)
  const { sessionId } = await readZodBody(event, registrationSessionTargetSchema)
  assertCanCancelSession(registration, sessionId)
  await cancelRegistrationSession(registration.id, sessionId, null)
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
