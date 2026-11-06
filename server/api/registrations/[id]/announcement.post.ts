import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { findRegistrationOr404 } from '~/server/utils/registrations'
import { ignoreLineAnnouncement, sendLineAnnouncement } from '~/server/utils/registrationSelection'
import { readZodBody, registrationLineAnnouncementSchema } from '~/server/utils/schemas'
import { withSessionSendLock } from '~/server/utils/sendLock'

// Après l'annonce d'une session, l'email individuel que propose une ligne : l'envoyer ou l'ignorer (R27)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const { action, sessionId } = await readZodBody(event, registrationLineAnnouncementSchema)
  if (action === 'ignore') return await ignoreLineAnnouncement(registration.id, sessionId)

  assertRateLimit(event, {
    name: 'registration-line-announcement',
    limit: 60,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), registration.period.id]
  })
  // Un double clic écrirait deux fois
  return await withSessionSendLock(`announcement:${registration.id}:${sessionId}`, () => sendLineAnnouncement(registration.id, sessionId))
})
