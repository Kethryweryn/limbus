import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, registrationPeriodSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import {
  assertClosingDateAllowsState,
  exposeRegistrationPeriod,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken,
  withFreshPublicId
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_PERIOD_SCOPES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, registrationPeriodSchema)
  await requireGameAccess(event, body.gameId)
  const closesAt = parseOptionalDate(body.closesAt)
  assertClosingDateAllowsState(body.state, closesAt)
  const sessions = await resolveRegistrationPeriodSessions(body.gameId, body.sessions)

  const period = await withFreshPublicId((publicId) => prisma.registrationPeriod.create({
    data: {
      gameId: body.gameId,
      name: body.name,
      scope: REGISTRATION_PERIOD_SCOPES.sessions,
      publicId,
      entryMode: body.entryMode,
      state: body.state,
      closesAt,
      responseDelayDays: body.responseDelayDays,
      sessions: { create: sessions }
    },
    include: registrationPeriodInclude
  })).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
