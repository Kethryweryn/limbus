import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { markTrombinoscopeDeliveries } from '~/server/utils/documents'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-trombinoscope-send',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  return await withSessionSendLock(session.id, () => markTrombinoscopeDeliveries(session.id))
})
