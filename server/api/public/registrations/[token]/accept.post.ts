import { confirmRetainedPlace } from '~/server/utils/registrationSelection'
import { exposePublicRegistration, guardPublicRegistrationRequest, requireRegistrationByToken } from '~/server/utils/publicRegistrations'
import { readZodBody, registrationSessionTargetSchema } from '~/server/utils/schemas'

// Confirmer sa place retenue pour une session, par son lien personnel (US-089, R18)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  const registration = await requireRegistrationByToken(token)
  const { sessionId } = await readZodBody(event, registrationSessionTargetSchema)
  await confirmRetainedPlace(registration, sessionId)
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
