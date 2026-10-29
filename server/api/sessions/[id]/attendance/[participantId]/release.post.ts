import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { releaseAttendance } from '~/server/utils/attendance'

// Confirmation de présence (US-024) : une action, jamais mise en file hors ligne
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  const session = await requireSessionAccess(event, id)
  return await releaseAttendance(session.id, participantId)
})
