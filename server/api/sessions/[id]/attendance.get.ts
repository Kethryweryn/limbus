import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { getSessionAttendance } from '~/server/utils/attendance'

// Suivi des confirmations de présence d'une session reportée (US-024)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  return await getSessionAttendance(session.id)
})
