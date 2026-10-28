import { exposePublicRegistration, guardPublicRegistrationRequest, requireRegistrationByToken } from '~/server/utils/publicRegistrations'

// Route publique du lien personnel (US-004) : le jeton tient lieu d'authentification (ADR-0018)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'read')

  const registration = await requireRegistrationByToken(getRouterParam(event, 'token'))
  return await exposePublicRegistration(registration)
})
