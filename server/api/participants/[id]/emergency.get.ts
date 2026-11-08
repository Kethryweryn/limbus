import { requireUser } from '~/server/utils/auth'
import { requireParticipantAccess } from '~/server/utils/gameAccess'
import { readParticipantEmergency } from '~/server/utils/participantEmergency'
import { requireRouterParam } from '~/server/utils/routeParams'

// Contact d'urgence et allergies de la fiche (US-178) : données de santé, jamais mises en cache
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  const gameIds = await requireParticipantAccess(event, id)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return await readParticipantEmergency(id, gameIds)
})
