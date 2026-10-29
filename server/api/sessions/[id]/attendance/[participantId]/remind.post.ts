import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { remindAttendance } from '~/server/utils/attendance'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Confirmation de présence (US-024) : une action, jamais mise en file hors ligne
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-attendance-remind',
    limit: 20,
    windowMs: 15 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })
  return await remindAttendance(session.id, participantId)
})
