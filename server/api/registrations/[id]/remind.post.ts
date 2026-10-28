import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, remindRegistration } from '~/server/utils/registrations'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Relance d'une invitation sans réponse (US-005, R20) : rappel sans lien, celui de l'invitation reste valable
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  assertRateLimit(event, {
    name: 'registration-remind',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), registration.period.id]
  })

  return await withSessionSendLock(registration.sessionId || registration.id, () => remindRegistration(registration.id))
})
