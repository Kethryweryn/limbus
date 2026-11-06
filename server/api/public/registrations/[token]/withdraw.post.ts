import { leavePool } from '~/server/utils/registrations'
import {
  exposePublicRegistration,
  guardPublicRegistrationRequest,
  registrationPermissions,
  requireRegistrationByToken
} from '~/server/utils/publicRegistrations'
import { REGISTRATION_STATUSES } from '~/utils/domain'

// Quitter le vivier par son lien personnel (R5) : le lien cesse de marcher, la réponse dit seulement ce qui s'est passé
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const registration = await requireRegistrationByToken(getRouterParam(event, 'token'))
  if (!registrationPermissions(registration).canLeave) {
    throw createError({ statusCode: 409, message: 'Vous n’êtes pas dans le vivier de ce jeu.' })
  }

  await leavePool(registration.id, null)
  return await exposePublicRegistration({ ...registration, status: REGISTRATION_STATUSES.withdrawn, withdrawnById: null })
})
