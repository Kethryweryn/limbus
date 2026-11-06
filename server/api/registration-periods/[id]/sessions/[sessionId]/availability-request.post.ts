import { requireUser } from '~/server/utils/auth'
import { sendAvailabilityRequest } from '~/server/utils/availabilityRequests'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { availabilityRequestSchema, readZodBody } from '~/server/utils/schemas'
import { withSessionSendLock } from '~/server/utils/sendLock'

// Demande de disponibilités ou relance pour une session (R9, R12), sur le clic d'une organisatrice
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const { registrationIds } = await readZodBody(event, availabilityRequestSchema)
  const sessionId = getRouterParam(event, 'sessionId')!
  assertRateLimit(event, {
    name: 'registration-availability-request',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), period.id]
  })

  // Un double clic écrirait deux fois : un seul envoi à la fois par session
  return await withSessionSendLock(`availability:${sessionId}`, () => sendAvailabilityRequest(period.id, sessionId, registrationIds))
})
