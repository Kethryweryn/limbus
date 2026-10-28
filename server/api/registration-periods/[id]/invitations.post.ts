import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { readZodBody, registrationInvitationSchema } from '~/server/utils/schemas'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { inviteToRegistrationPeriod } from '~/server/utils/registrations'
import { withSessionSendLock } from '~/server/utils/sendLock'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireOrganizer(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  assertRateLimit(event, {
    name: 'registration-invitations',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event), period.id]
  })

  const body = await readZodBody(event, registrationInvitationSchema)
  return await withSessionSendLock(body.sessionId, () => inviteToRegistrationPeriod({
    periodId: period.id,
    sessionId: body.sessionId,
    participantIds: body.participantIds,
    newParticipant: body.newParticipant,
    inviter: user
  }))
})
