import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, registrationPeriodSchema } from '~/server/utils/schemas'
import { assertSameGame, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import {
  assertNoRegistrationsOnRemovedSessions,
  exposeRegistrationPeriod,
  findRegistrationPeriodOr404,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken
} from '~/server/utils/registrationPeriods'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', id)

  const body = await readZodBody(event, registrationPeriodSchema)
  assertSameGame(gameId, body.gameId)
  const sessions = await resolveRegistrationPeriodSessions(gameId, body.sessions, id)
  await assertNoRegistrationsOnRemovedSessions(id, sessions.map((session) => session.sessionId))

  const period = await prisma.$transaction(async (tx) => {
    await tx.registrationPeriodSession.deleteMany({ where: { periodId: id } })
    return await tx.registrationPeriod.update({
      where: { id },
      data: {
        name: body.name,
        entryMode: body.entryMode,
        state: body.state,
        closesAt: parseOptionalDate(body.closesAt),
        responseDelayDays: body.responseDelayDays,
        sessions: { create: sessions }
      },
      include: registrationPeriodInclude
    })
  }).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
