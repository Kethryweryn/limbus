import { withdrawRegistration } from '~/server/utils/registrations'
import {
  exposePublicRegistration,
  guardPublicRegistrationRequest,
  registrationPermissions,
  requireRegistrationByToken
} from '~/server/utils/publicRegistrations'

// Désistement d'une personne confirmée, ou retrait d'une inscription reçue, par son lien, même après la clôture (US-006, US-085, R13)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  const registration = await requireRegistrationByToken(token)
  if (!registrationPermissions(registration).canWithdraw) {
    throw createError({ statusCode: 409, message: 'Cette inscription ne peut pas faire l’objet d’un désistement.' })
  }

  await withdrawRegistration(registration.id, null)
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
