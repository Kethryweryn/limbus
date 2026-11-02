import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { takenSeatsWhere } from '~/server/utils/registrationPeriods'
import {
  assertFormPeriod,
  findSelectionPeriod,
  lockSession,
  isPermanentPeriod,
  replayerParticipantIds,
  selectableSessions,
  type SelectionPeriod
} from '~/server/utils/registrationSelection'
import {
  CHARACTER_TYPES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_STATUSES
} from '~/utils/domain'
import { balanceReserves, computeDraw, type DrawResult, type DrawSessionInput, type DrawSettings } from '~/utils/registrationDraw'

// La valeur d'équilibre d'un personnage est une des valeurs de l'attribut du jeu (US-091)
export async function assertBalanceValue(gameId: string, value: string | null | undefined) {
  if (!value) return
  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId }, select: { balanceAttribute: true, balanceValues: true } })
  if (!game.balanceAttribute || !game.balanceValues.includes(value)) {
    throw createError({ statusCode: 400, message: 'Valeur d’équilibre inconnue pour ce jeu' })
  }
}

// Question d'équilibre d'un jeu (US-091) : le nom de l'attribut et ses valeurs, null sans attribut
export function balanceQuestion(game: { balanceAttribute: string | null, balanceValues: string[] }) {
  return game.balanceAttribute && game.balanceValues.length
    ? { label: game.balanceAttribute, values: game.balanceValues }
    : null
}

// Personnes non retenues, ou restées en attente, lors d'une autre période du jeu (R17)
async function notDrawnBeforeParticipantIds(period: SelectionPeriod, participantIds: string[]) {
  if (!participantIds.length) return new Set<string>()
  const rows = await prisma.registration.findMany({
    where: {
      participantId: { in: participantIds },
      periodId: { not: period.id },
      // Une période précédente : créée avant celle-ci (R17)
      period: { gameId: period.gameId, createdAt: { lt: period.createdAt } },
      status: { in: [REGISTRATION_STATUSES.rejected, REGISTRATION_STATUSES.waitlisted] }
    },
    distinct: ['participantId'],
    select: { participantId: true }
  })
  return new Set(rows.map((row) => row.participantId))
}

// Nombre de PJ qui portent chaque valeur d'équilibre du jeu
async function characterValueCounts(period: SelectionPeriod) {
  const rows = await prisma.character.groupBy({
    by: ['balanceValue'],
    where: { gameId: period.gameId, type: CHARACTER_TYPES.pj, balanceValue: { in: period.game.balanceValues } },
    _count: { _all: true }
  })
  return Object.fromEntries(rows.map((row) => [row.balanceValue!, row._count._all]))
}

/**
 * Tire au sort les inscriptions reçues d'une période (US-093, ADR-0048) et enregistre le tirage dans le journal.
 * Les décisions sont à annoncer, comme à la main (ADR-0047).
 */
export async function drawPeriod(periodId: string, author: { id: string }) {
  const period = (await findSelectionPeriod(periodId))!
  assertFormPeriod(period)
  if (isPermanentPeriod(period) || period.selectionMode === REGISTRATION_SELECTION_MODES.chosen) {
    throw createError({ statusCode: 409, message: 'Cette période sélectionne à la main : choisissez le mode « au hasard » ou « mixte » pour tirer au sort.' })
  }

  const sessions = await selectableSessions(period)
  const registrations = await prisma.registration.findMany({
    where: { periodId, status: REGISTRATION_STATUSES.received },
    select: { id: true, participantId: true, balancePreference: true, availabilities: { select: { sessionId: true } } }
  })
  const participantIds = registrations.map((registration) => registration.participantId)
  const excluded = period.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
    ? await replayerParticipantIds(period.gameId, participantIds)
    : new Set<string>()
  const favoured = period.weightNotDrawnBefore ? await notDrawnBeforeParticipantIds(period, participantIds) : new Set<string>()
  const candidates = registrations.filter((registration) => !excluded.has(registration.participantId))

  const balanced = period.weightBalance && Boolean(period.game.balanceAttribute) && period.game.balanceValues.length > 0
  const valueCounts = balanced ? await characterValueCounts(period) : {}
  const taken = await prisma.registration.findMany({
    where: takenSeatsWhere(sessions.map((session) => session.id)),
    select: { sessionId: true, balancePreference: true }
  })

  // Une période d'une seule session ne demande pas de disponibilités (R10)
  const askedAvailability = period.sessions.length > 1
  const inputs: DrawSessionInput[] = sessions.map((session) => {
    const takenHere = taken.filter((row) => row.sessionId === session.id)
    return {
      sessionId: session.id,
      freeSeats: Math.max(0, session.seats - takenHere.length),
      reserves: balanced ? balanceReserves(session.seats, valueCounts, takenHere.map((row) => balancedPreference(period, row.balancePreference))) : null,
      candidates: candidates
        .filter((registration) => !askedAvailability || registration.availabilities.some((availability) => availability.sessionId === session.id))
        .map((registration) => ({
          registrationId: registration.id,
          weight: favoured.has(registration.participantId) ? 2 : 1,
          preference: balanced ? balancedPreference(period, registration.balancePreference) : null
        }))
    }
  })

  const seed = randomBytes(16).toString('hex')
  const result = await computeDraw(seed, inputs, period.waitlistSize)
  const settings: DrawSettings = {
    selectionMode: period.selectionMode,
    weightNotDrawnBefore: period.weightNotDrawnBefore,
    weightBalance: balanced,
    balanceAttribute: balanced ? period.game.balanceAttribute : null,
    waitlistSize: period.waitlistSize,
    excludedReplayers: registrations.filter((registration) => excluded.has(registration.participantId)).map((registration) => registration.id),
    // Entrées complètes du calcul (places, réserves, candidates avec poids et préférence) : avec la graine,
    // computeDraw les rejoue à l'identique (R18)
    sessions: inputs
  }

  return await prisma.$transaction(async (tx) => {
    // Deux tirages simultanés de la même période : le second voit le premier et refuse
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-draw:${periodId}`}))`
    if (await tx.registrationDraw.findFirst({ where: { periodId, cancelledAt: null }, select: { id: true } })) {
      throw createError({ statusCode: 409, message: 'Un tirage est déjà en cours d’effet : annulez-le pour en refaire un.' })
    }
    // Places recomptées sous le verrou des retenues à la main : une retenue arrivée entre-temps ne fait pas déborder
    for (const input of inputs) {
      await lockSession(tx, input.sessionId)
      const seats = sessions.find((session) => session.id === input.sessionId)!.seats
      const takenNow = await tx.registration.count({ where: takenSeatsWhere([input.sessionId]) })
      if (seats - takenNow < input.freeSeats) {
        throw createError({ statusCode: 409, message: 'Des places ont été prises pendant le tirage : relancez-le.' })
      }
    }
    const stillReceived = async (ids: string[], data: Record<string, unknown>) => {
      if (!ids.length) return
      const { count } = await tx.registration.updateMany({ where: { id: { in: ids }, status: REGISTRATION_STATUSES.received }, data })
      if (count !== ids.length) {
        throw createError({ statusCode: 409, message: 'Des inscriptions ont changé pendant le tirage : relancez-le.' })
      }
    }
    for (const session of result.sessions) {
      await stillReceived(session.retained, {
        status: REGISTRATION_STATUSES.retained,
        sessionId: session.sessionId,
        retainedById: null,
        responseDueAt: null,
        lastRemindedAt: null
      })
    }
    // Une personne peut attendre dans plusieurs sessions : elle passe en attente une fois, puis rejoint chaque file
    const waitlisted = [...new Set(result.sessions.flatMap((session) => session.waitlisted))]
    await stillReceived(waitlisted, { status: REGISTRATION_STATUSES.waitlisted, sessionId: null })
    for (const session of result.sessions) {
      if (!session.waitlisted.length) continue
      const last = await tx.registrationWaitlistEntry.aggregate({ where: { sessionId: session.sessionId }, _max: { position: true } })
      const start = last._max.position ?? 0
      await tx.registrationWaitlistEntry.createMany({
        data: session.waitlisted.map((registrationId, index) => ({ registrationId, sessionId: session.sessionId, position: start + index + 1 })),
        skipDuplicates: true
      })
    }
    await stillReceived(result.rejected, { status: REGISTRATION_STATUSES.rejected, sessionId: null })
    return await tx.registrationDraw.create({
      data: { periodId, seed, settings, result, createdById: author.id },
      select: { id: true, createdAt: true }
    })
  })
}

// Une réponse qui n'est plus une valeur du jeu compte comme « peu importe » (ADR-0048)
function balancedPreference(period: SelectionPeriod, preference: string | null) {
  return preference && period.game.balanceValues.includes(preference) ? preference : null
}

/**
 * Annule un tirage (US-094) tant qu'aucune de ses personnes n'a reçu d'annonce depuis : les inscriptions dont la
 * décision est encore celle du tirage repartent à « reçue ». Le tirage reste dans le journal, marqué annulé.
 */
export async function cancelDraw(drawId: string, author: { id: string }) {
  const draw = await prisma.registrationDraw.findUniqueOrThrow({ where: { id: drawId }, select: { id: true, cancelledAt: true, createdAt: true, result: true } })
  if (draw.cancelledAt) {
    throw createError({ statusCode: 409, message: 'Ce tirage est déjà annulé.' })
  }
  const result = draw.result as DrawResult
  const everyone = [...new Set([...result.sessions.flatMap((session) => [...session.retained, ...session.waitlisted]), ...result.rejected])]
  if (await prisma.registration.count({ where: { id: { in: everyone }, announcedAt: { gt: draw.createdAt } } })) {
    throw createError({ statusCode: 409, message: 'Des résultats de ce tirage sont déjà annoncés : corrigez à la main.' })
  }
  const back = { status: REGISTRATION_STATUSES.received, sessionId: null, responseDueAt: null, lastRemindedAt: null }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.registrationDraw.updateMany({ where: { id: draw.id, cancelledAt: null }, data: { cancelledAt: new Date(), cancelledById: author.id } })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Ce tirage est déjà annulé.' })
    }
    for (const session of result.sessions) {
      await tx.registration.updateMany({
        where: { id: { in: session.retained }, status: REGISTRATION_STATUSES.retained, sessionId: session.sessionId, retainedById: null },
        data: back
      })
      // Les personnages réservés aux personnes revenues à trier redeviennent libres (US-100)
      await tx.sessionAssignment.updateMany({
        where: { reservedRegistration: { id: { in: session.retained }, status: REGISTRATION_STATUSES.received } },
        data: { reservedRegistrationId: null }
      })
      await tx.registrationWaitlistEntry.deleteMany({ where: { registrationId: { in: session.waitlisted }, sessionId: session.sessionId } })
    }
    // En attente sans plus aucune file : de nouveau à trier
    const waiting = [...new Set(result.sessions.flatMap((session) => session.waitlisted))]
    await tx.registration.updateMany({
      where: { id: { in: waiting }, status: REGISTRATION_STATUSES.waitlisted, waitlistEntries: { none: {} } },
      data: back
    })
    await tx.registration.updateMany({ where: { id: { in: result.rejected }, status: REGISTRATION_STATUSES.rejected }, data: back })
  })
  return { success: true }
}

// Journal des tirages d'une période (US-094, R18), annulés compris, du plus récent au plus ancien
export async function listDraws(periodId: string) {
  const draws = await prisma.registrationDraw.findMany({
    where: { periodId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      seed: true,
      settings: true,
      result: true,
      createdAt: true,
      cancelledAt: true,
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } }
    }
  })
  // Colonnes JSON écrites par drawRegistrations
  return draws.map((draw) => ({ ...draw, settings: draw.settings as DrawSettings, result: draw.result as DrawResult }))
}
