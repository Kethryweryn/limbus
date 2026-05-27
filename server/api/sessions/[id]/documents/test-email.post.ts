import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { emailTestSchema, readZodBody } from '~/server/utils/schemas'
import { sendDocumentTestEmails } from '~/server/utils/documents'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)
  assertRateLimit(event, {
    name: 'session-document-test-email',
    limit: 20,
    windowMs: 15 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  const body = await readZodBody(event, emailTestSchema)
  return await sendDocumentTestEmails(session.id, body.documentIds, body.emails)
})
