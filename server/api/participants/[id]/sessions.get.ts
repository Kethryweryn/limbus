import { requireUser } from '~/server/utils/auth'
import { requireParticipantAccess } from '~/server/utils/gameAccess'
import { readParticipantSessions } from '~/server/utils/participantSessions'
import { requireRouterParam } from '~/server/utils/routeParams'

// Sessions de la fiche, avec ses rôles et personnages (US-183)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  const gameIds = await requireParticipantAccess(event, id)
  return await readParticipantSessions(id, gameIds)
})
