import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { resendDeliveries } from '~/server/utils/documents'
import { documentResendSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { requireRouterParam } from '~/server/utils/routeParams'

// Renvoi de la version à jour d'un document, d'une fiche ou d'un trombinoscope (US-030)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-document-resend',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, documentResendSchema)
  return await withSessionSendLock(session.id, () => resendDeliveries(session.id, body))
})
