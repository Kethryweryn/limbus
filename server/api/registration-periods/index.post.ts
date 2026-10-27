import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, registrationPeriodSchema } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import {
  createRegistrationPeriodPublicId,
  exposeRegistrationPeriod,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_PERIOD_SCOPES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, registrationPeriodSchema)
  await requireGameAccess(event, body.gameId)
  const sessions = await resolveRegistrationPeriodSessions(body.gameId, body.sessions)

  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: body.gameId,
      name: body.name,
      scope: REGISTRATION_PERIOD_SCOPES.sessions,
      publicId: createRegistrationPeriodPublicId(),
      entryMode: body.entryMode,
      state: body.state,
      closesAt: parseOptionalDate(body.closesAt),
      responseDelayDays: body.responseDelayDays,
      sessions: { create: sessions }
    },
    include: registrationPeriodInclude
  }).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
