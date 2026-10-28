import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, resendRegistrationInvitation } from '~/server/utils/registrations'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireOrganizer(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  assertRateLimit(event, {
    name: 'registration-resend',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event)]
  })

  // Sans session (supprimée), le verrou porte sur l'inscription elle-même
  return await withSessionSendLock(registration.sessionId || registration.id, () => resendRegistrationInvitation(registration.id, user))
})
