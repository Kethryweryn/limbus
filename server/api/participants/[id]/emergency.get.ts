import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { readParticipantEmergency } from '~/server/utils/participantEmergency'
import { requireRouterParam } from '~/server/utils/routeParams'

// Contact d'urgence et allergies de la fiche (US-178) : données de santé, jamais mises en cache. La lecture vérifie
// elle-même que la fiche est dans les jeux accessibles
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  const data = await readParticipantEmergency(id, await accessibleGameIds(event))
  setHeader(event, 'Cache-Control', 'private, no-store')
  return data
})
