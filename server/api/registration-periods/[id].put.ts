import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { readZodBody, registrationPeriodUpdateSchema } from '~/server/utils/schemas'
import { assertSameGame, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import {
  assertClosingDateAllowsState,
  assertNoRegistrationsOnRemovedSessions,
  exposeRegistrationPeriod,
  findRegistrationPeriodOr404,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken
} from '~/server/utils/registrationPeriods'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', id)

  const body = await readZodBody(event, registrationPeriodUpdateSchema)
  assertSameGame(gameId, body.gameId)
  // Champs absents : valeurs actuelles (une modification partielle ne remet rien à zéro)
  const current = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id }, select: { state: true, closesAt: true, responseDelayDays: true } })
  const state = body.state ?? current.state
  const closesAt = body.closesAt === undefined ? current.closesAt : parseOptionalDate(body.closesAt)
  assertClosingDateAllowsState(state, closesAt)
  const sessions = await resolveRegistrationPeriodSessions(gameId, body.sessions, id)
  await assertNoRegistrationsOnRemovedSessions(id, sessions.map((session) => session.sessionId))

  const period = await prisma.$transaction(async (tx) => {
    await tx.registrationPeriodSession.deleteMany({ where: { periodId: id } })
    return await tx.registrationPeriod.update({
      where: { id },
      data: {
        name: body.name,
        state,
        closesAt,
        responseDelayDays: body.responseDelayDays ?? current.responseDelayDays,
        sessions: { create: sessions }
      },
      include: registrationPeriodInclude
    })
  }).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
