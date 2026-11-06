import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { announceCast } from '~/server/utils/registrationSelection'
import { castAnnouncementSchema, readZodBody } from '~/server/utils/schemas'
import { withSessionSendLock } from '~/server/utils/sendLock'

// Annonce le casting d'une session (R26) : les personnes retenues, et la liste d'attente si l'équipe l'a coché
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const { includeWaitlist } = await readZodBody(event, castAnnouncementSchema)
  const sessionId = getRouterParam(event, 'sessionId')!
  assertRateLimit(event, {
    name: 'registration-announce',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), period.id]
  })

  // Un double clic annoncerait deux fois : un seul envoi à la fois par session
  return await withSessionSendLock(`announce:${sessionId}`, () => announceCast(period.id, sessionId, includeWaitlist))
})
