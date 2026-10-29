import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { sendAttendanceRequests } from '~/server/utils/attendance'
import { assertNewResponseDueAt } from '~/server/utils/registrations'
import { readZodBody, registrationExtensionSchema } from '~/server/utils/schemas'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Demandes de confirmation de présence à l'équipe d'une session reportée (US-024) : une action, jamais mise en file
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-attendance-send',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const { responseDueAt } = await readZodBody(event, registrationExtensionSchema)
  assertNewResponseDueAt(responseDueAt)
  return await withSessionSendLock(session.id, () => sendAttendanceRequests(session.id, responseDueAt))
})
