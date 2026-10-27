import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { readZodBody, sessionDocumentSendSchema } from '~/server/utils/schemas'
import { markDocumentDeliveries } from '~/server/utils/documents'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-document-send',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, sessionDocumentSendSchema)
  return await withSessionSendLock(session.id, () => markDocumentDeliveries(session.id, body.documentIds))
})
