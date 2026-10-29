import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { readZodBody, sessionPaymentSendSchema } from '~/server/utils/schemas'
import { sendSessionPaymentEmails } from '~/server/utils/sessionPayments'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-payment-send',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, sessionPaymentSendSchema)
  return await withSessionSendLock(session.id, () => sendSessionPaymentEmails(session.id, body.reminder, body.participantId))
})
