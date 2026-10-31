import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { readZodBody, registrationPeriodSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import {
  assertClosingDateAllowsState,
  assertSinglePermanentOpen,
  exposeRegistrationPeriod,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken,
  withFreshPublicId
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_PERIOD_SCOPES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const body = await readZodBody(event, registrationPeriodSchema)
  await requireGameAccess(event, body.gameId)
  // L'inscription permanente n'a pas de date de clôture : les orgas la clôturent à la main (R30)
  const permanent = body.scope === REGISTRATION_PERIOD_SCOPES.game
  const closesAt = permanent ? null : parseOptionalDate(body.closesAt)
  assertClosingDateAllowsState(body.state, closesAt)
  await assertSinglePermanentOpen(body.gameId, body.scope, body.state)
  const sessions = permanent ? [] : await resolveRegistrationPeriodSessions(body.gameId, body.sessions)

  const period = await withFreshPublicId((publicId) => prisma.registrationPeriod.create({
    data: {
      gameId: body.gameId,
      name: body.name,
      scope: body.scope,
      publicId,
      entryMode: body.entryMode,
      notifyTeam: body.notifyTeam,
      state: body.state,
      closesAt,
      responseDelayDays: body.responseDelayDays,
      sessions: { create: sessions }
    },
    include: registrationPeriodInclude
  })).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
