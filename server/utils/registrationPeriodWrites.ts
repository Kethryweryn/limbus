import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import type { registrationPeriodSchema, registrationPeriodUpdateSchema, registrationSessionSettingsSchema } from '~/server/utils/schemas'
import { assertSameGame, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import {
  exposeRegistrationPeriod,
  findRegistrationPeriodOr404,
  registrationPeriodInclude,
  rethrowPoolAlreadyExists,
  withFreshPublicId
} from '~/server/utils/registrationPeriods'
import { REGISTRATION_SELECTION_MODES } from '~/utils/domain'
import { isOpenableSession } from '~/utils/registrationPeriods'

// Écritures d'un vivier, communes aux routes de l'interface et aux outils des assistants d'IA (US-130, SPEC-014 R12) :
// mêmes contrôles d'accès, de version et de sessions du même jeu

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

export async function createRegistrationPeriod(event: H3Event, readBody: Reader<typeof registrationPeriodSchema>) {
  const body = await readBody()
  await requireGameAccess(event, body.gameId)
  // Un jeu a au plus un vivier (R1)
  if (await prisma.registrationPeriod.findUnique({ where: { gameId: body.gameId }, select: { id: true } })) {
    throw createError({ statusCode: 409, message: 'Ce jeu a déjà un vivier.' })
  }

  const period = await withFreshPublicId((publicId) => prisma.registrationPeriod.create({
    data: {
      gameId: body.gameId,
      publicId,
      notifyTeam: body.notifyTeam,
      replayPolicy: body.replayPolicy,
      state: body.state,
      responseDelayDays: body.responseDelayDays
    },
    include: registrationPeriodInclude
  })).catch(rethrowPoolAlreadyExists)

  return await exposeRegistrationPeriod(period)
}

export async function updateRegistrationPeriod(event: H3Event, periodId: string | undefined, readBody: Reader<typeof registrationPeriodUpdateSchema>) {
  const { id, gameId } = await findRegistrationPeriodOr404(periodId)
  await requireGameAccess(event, gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', id)

  const body = await readBody()
  assertSameGame(gameId, body.gameId)
  // Champs absents : valeurs actuelles (une modification partielle ne remet rien à zéro)
  const period = await prisma.registrationPeriod.update({
    where: { id },
    data: {
      state: body.state,
      responseDelayDays: body.responseDelayDays,
      notifyTeam: body.notifyTeam,
      replayPolicy: body.replayPolicy
    },
    include: registrationPeriodInclude
  })
  return await exposeRegistrationPeriod(period)
}

/**
 * Ouverture et sélection d'une session du vivier (R6, R22). Une session sans date, passée, annulée ou terminée ne
 * s'ouvre pas. La refermer ne retire aucune pré-inscription. Un champ absent reste tel quel.
 */
export async function updateRegistrationSession(period: { id: string, gameId: string }, sessionId: string, body: z.output<typeof registrationSessionSettingsSchema>) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, gameId: period.gameId }, select: { id: true, date: true, status: true } })
  if (!session) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce jeu' })
  }
  if (body.open && !isOpenableSession(session)) {
    throw createError({ statusCode: 409, message: 'Seule une session datée et à venir, ni annulée ni terminée, peut être ouverte.' })
  }
  const current = await prisma.registrationPeriodSession.findUnique({ where: { sessionId }, select: { selectionMode: true, organizerPicks: true } })
  const selectionMode = body.selectionMode ?? current?.selectionMode ?? REGISTRATION_SELECTION_MODES.chosen
  const organizerPicks = selectionMode === REGISTRATION_SELECTION_MODES.mixed
    ? (body.organizerPicks === undefined ? current?.organizerPicks : body.organizerPicks) ?? 0
    : null
  const data = {
    open: body.open,
    selectionMode,
    organizerPicks,
    weightNotDrawnBefore: body.weightNotDrawnBefore,
    weightBalance: body.weightBalance,
    waitlistSize: body.waitlistSize
  }
  await prisma.registrationPeriodSession.upsert({
    where: { sessionId },
    update: data,
    create: { ...data, gameId: period.gameId, periodId: period.id, sessionId }
  })
  return { success: true }
}
