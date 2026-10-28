import {
  declineRegistration,
  exposePublicRegistration,
  guardPublicRegistrationRequest,
  requireRegistrationByToken
} from '~/server/utils/publicRegistrations'

// Décliner l'invitation, sans remplir le formulaire (US-004, R16)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')

  const token = getRouterParam(event, 'token')
  await declineRegistration(await requireRegistrationByToken(token))
  return await exposePublicRegistration(await requireRegistrationByToken(token))
})
