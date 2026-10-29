import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { sendAllergySheet } from '~/server/utils/allergies'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Envoie la fiche allergies à l'équipe cuisine de la session (US-008, R15)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const session = await requireSessionAccess(event, getRouterParam(event, 'id') || '')
  assertRateLimit(event, {
    name: 'session-allergies-send',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), session.id]
  })

  return await withSessionSendLock(session.id, () => sendAllergySheet(session.id))
})
