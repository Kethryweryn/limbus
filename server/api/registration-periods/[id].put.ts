import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { readZodBody, registrationPeriodUpdateSchema } from '~/server/utils/schemas'
import { assertSameGame, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import {
  assertClosingDateAllowsState,
  assertNoRegistrationsOnRemovedSessions,
  assertSinglePermanentOpen,
  exposeRegistrationPeriod,
  findRegistrationPeriodOr404,
  parseOptionalDate,
  registrationPeriodInclude,
  resolveRegistrationPeriodSessions,
  rethrowSessionAlreadyTaken
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_SCOPES, REGISTRATION_SELECTION_MODES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', id)

  const body = await readZodBody(event, registrationPeriodUpdateSchema)
  assertSameGame(gameId, body.gameId)
  // Champs absents : valeurs actuelles (une modification partielle ne remet rien à zéro)
  const current = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id }, select: { state: true, closesAt: true, responseDelayDays: true, notifyTeam: true, replayPolicy: true, scope: true, entryMode: true, selectionMode: true, organizerPicks: true, weightNotDrawnBefore: true, weightBalance: true, waitlistSize: true } })
  const permanent = current.scope === REGISTRATION_PERIOD_SCOPES.game
  const state = body.state ?? current.state
  const closesAt = permanent ? null : body.closesAt === undefined ? current.closesAt : parseOptionalDate(body.closesAt)
  assertClosingDateAllowsState(state, closesAt)
  await assertSinglePermanentOpen(gameId, current.scope, state, id)
  if (permanent ? body.sessions.length : !body.sessions.length) {
    throw createError({ statusCode: 400, message: permanent ? 'L’inscription permanente couvre tout le jeu : ne choisissez pas de session' : 'Choisissez au moins une session' })
  }
  // Tirage et mode mixte : périodes ordinaires en mode formulaire (US-092)
  const selectionMode = body.selectionMode ?? current.selectionMode
  if (selectionMode !== REGISTRATION_SELECTION_MODES.chosen && (permanent || current.entryMode !== REGISTRATION_ENTRY_MODES.form)) {
    throw createError({ statusCode: 400, message: 'Le tirage concerne les périodes ordinaires en mode formulaire' })
  }
  const organizerPicks = selectionMode === REGISTRATION_SELECTION_MODES.mixed
    ? (body.organizerPicks === undefined ? current.organizerPicks : body.organizerPicks) ?? 0
    : null
  const sessions = permanent ? [] : await resolveRegistrationPeriodSessions(gameId, body.sessions, id)
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
        notifyTeam: body.notifyTeam ?? current.notifyTeam,
        replayPolicy: body.replayPolicy ?? current.replayPolicy,
        selectionMode,
        organizerPicks,
        weightNotDrawnBefore: body.weightNotDrawnBefore ?? current.weightNotDrawnBefore,
        weightBalance: body.weightBalance ?? current.weightBalance,
        waitlistSize: body.waitlistSize ?? current.waitlistSize,
        sessions: { create: sessions }
      },
      include: registrationPeriodInclude
    })
  }).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
})
