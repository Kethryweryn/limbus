import { exposeAttendanceByToken } from '~/server/utils/attendance'
import { guardPublicRegistrationRequest } from '~/server/utils/publicRegistrations'

// Lien personnel de confirmation de présence (US-024) : le jeton tient lieu d'authentification (ADR-0018).
// Mêmes en-têtes et mêmes limites par IP que le lien d'inscription.
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'read')
  return await exposeAttendanceByToken(getRouterParam(event, 'token'))
})
