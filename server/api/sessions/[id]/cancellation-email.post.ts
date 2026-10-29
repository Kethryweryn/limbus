import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { cancellationEmailSchema, readZodBody } from '~/server/utils/schemas'
import { sendCancellationEmail } from '~/server/utils/sessionLifecycle'
import { withSessionSendLock } from '~/server/utils/sendLock'

// Email d'annulation à l'équipe, relu et envoyé à la main (US-025) : une action, jamais mise en file
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-cancellation-email',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, cancellationEmailSchema)
  return await withSessionSendLock(session.id, () => sendCancellationEmail(session.id, body))
})
