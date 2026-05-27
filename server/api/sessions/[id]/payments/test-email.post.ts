import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { emailTestSchema, readZodBody } from '~/server/utils/schemas'
import { sendSessionPaymentTestEmails } from '~/server/utils/sessionPayments'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { publicAppUrl } from '~/server/utils/appUrl'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-payment-test-email',
    limit: 20,
    windowMs: 15 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, emailTestSchema)
  return await sendSessionPaymentTestEmails(session.id, body.emails, body.participantId, publicAppUrl())
})
