import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import type { registrationPeriodSchema, registrationPeriodUpdateSchema } from '~/server/utils/schemas'
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
  rethrowSessionAlreadyTaken,
  withFreshPublicId
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_SCOPES, REGISTRATION_SELECTION_MODES } from '~/utils/domain'

// Écritures d'une période d'inscription, communes aux routes de l'interface et aux outils des assistants d'IA (US-130,
// SPEC-014 R12) : mêmes contrôles d'accès, de version, de sessions du même jeu et d'état

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

export async function createRegistrationPeriod(event: H3Event, readBody: Reader<typeof registrationPeriodSchema>) {
  const body = await readBody()
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
      replayPolicy: body.replayPolicy,
      selectionMode: body.selectionMode,
      organizerPicks: body.selectionMode === REGISTRATION_SELECTION_MODES.mixed ? body.organizerPicks ?? 0 : null,
      weightNotDrawnBefore: body.weightNotDrawnBefore,
      weightBalance: body.weightBalance,
      waitlistSize: body.waitlistSize,
      state: body.state,
      closesAt,
      responseDelayDays: body.responseDelayDays,
      sessions: { create: sessions }
    },
    include: registrationPeriodInclude
  })).catch(rethrowSessionAlreadyTaken)

  return exposeRegistrationPeriod(period)
}

export async function updateRegistrationPeriod(event: H3Event, periodId: string | undefined, readBody: Reader<typeof registrationPeriodUpdateSchema>) {
  const { id, gameId } = await findRegistrationPeriodOr404(periodId)
  await requireGameAccess(event, gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', id)

  const body = await readBody()
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
}
