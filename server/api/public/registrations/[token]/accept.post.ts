import { confirmRetainedPlace } from '~/server/utils/registrationSelection'
import { exposePublicRegistration, guardPublicRegistrationRequest, requireRegistrationByToken } from '~/server/utils/publicRegistrations'

// Confirmer sa place retenue par son lien personnel (US-089, R20)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  await confirmRetainedPlace(await requireRegistrationByToken(token))
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
