import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { announceSelection } from '~/server/utils/registrationSelection'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Annonce les décisions pas encore annoncées de la période, un email par personne (US-088)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  assertRateLimit(event, {
    name: 'registration-announce',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), period.id]
  })

  // Un double clic annoncerait deux fois : un seul envoi à la fois par période
  return await withSessionSendLock(`announce:${period.id}`, () => announceSelection(period.id))
})
