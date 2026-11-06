import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, remindRegistration } from '~/server/utils/registrations'
import { readZodBody, registrationTargetSchema } from '~/server/utils/schemas'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Relance d'une invitation sans réponse, ou d'une place retenue pas confirmée (US-005, R20) : rappel sans lien
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  assertRateLimit(event, {
    name: 'registration-remind',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), registration.period.id]
  })
  const { sessionId } = await readZodBody(event, registrationTargetSchema)

  return await withSessionSendLock(sessionId || registration.id, () => remindRegistration(registration.id, sessionId))
})
