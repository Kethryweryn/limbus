import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { eraseParticipantForTeam } from '~/server/utils/participantPrivacy'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertParticipantUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  const allowedGameIds = await accessibleGameIds(event)
  await assertParticipantUnmodifiedSince(event, id, allowedGameIds)
  // Fiche suivie aussi par d'autres équipes : seul ce que tient l'équipe part (SPEC-022 R14, US-241)
  const { deletedPhotos } = await eraseParticipantForTeam(id, allowedGameIds)
  return { success: true, deletedPhotos }
})
