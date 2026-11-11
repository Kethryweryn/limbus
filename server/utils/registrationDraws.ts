import { labelNestedSessions } from '~/server/utils/sessionLabels'
import { randomBytes } from 'node:crypto'
import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { takenSeatsWhere } from '~/server/utils/registrationPeriods'
import {
  findSelectionPeriod,
  lockSession,
  replayerParticipantIds,
  selectableSessions,
  type SelectableSession,
  type SelectionPeriod
} from '~/server/utils/registrationSelection'
import {
  CHARACTER_TYPES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_SESSION_STATUSES as LINE,
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

// Personnes restées sans place lors d'un tirage d'une session plus ancienne du jeu (R22)
async function notDrawnBeforeRegistrationIds(period: SelectionPeriod, session: SelectableSession) {
  if (!session.date) return new Set<string>()
  const draws = await prisma.registrationDraw.findMany({
    where: { periodId: period.id, cancelledAt: null, session: { date: { lt: session.date } } },
    select: { result: true }
  })
  // Colonne JSON écrite par le tirage
  return new Set(draws.flatMap(({ result }) => {
    const { sessions, rejected } = result as DrawResult
    return [...sessions.flatMap((drawn) => drawn.waitlisted), ...rejected]
  }))
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
 * Tire au sort les pré-inscrits d'une session (R22, R23, ADR-0048) et enregistre le tirage dans le journal. Les personnes
 * sans place vont en liste d'attente dans la limite réglée ; les autres restent pré-inscrites. Les décisions sont à
 * annoncer, comme à la main (ADR-0047).
 */
export async function drawSession(periodId: string, sessionId: string, author: { id: string }) {
  const period = (await findSelectionPeriod(periodId))!
  const session = (await selectableSessions(period)).find((candidate) => candidate.id === sessionId)
  if (!session) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce vivier' })
  }
  if (session.selectionMode === REGISTRATION_SELECTION_MODES.chosen) {
    throw createError({ statusCode: 409, message: 'Cette session sélectionne à la main : choisissez le mode « au hasard » ou « mixte » pour tirer au sort.' })
  }

  const lines = await prisma.registrationSession.findMany({
    where: { sessionId, status: LINE.preregistered, registration: { status: REGISTRATION_STATUSES.received } },
    select: { registrationId: true, registration: { select: { participantId: true, balancePreference: true } } }
  })
  const participantIds = lines.map((line) => line.registration.participantId)
  const excluded = period.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
    ? await replayerParticipantIds(period.gameId, participantIds)
    : new Set<string>()
  const favoured = session.weightNotDrawnBefore ? await notDrawnBeforeRegistrationIds(period, session) : new Set<string>()
  const candidates = lines.filter((line) => !excluded.has(line.registration.participantId))

  const balanced = session.weightBalance && Boolean(period.game.balanceAttribute) && period.game.balanceValues.length > 0
  const valueCounts = balanced ? await characterValueCounts(period) : {}
  const taken = await prisma.registrationSession.findMany({
    where: takenSeatsWhere([sessionId]),
    select: { registration: { select: { balancePreference: true } } }
  })

  const input: DrawSessionInput = {
    sessionId,
    freeSeats: Math.max(0, session.seats - taken.length),
    reserves: balanced ? balanceReserves(session.seats, valueCounts, taken.map((row) => balancedPreference(period, row.registration.balancePreference))) : null,
    candidates: candidates.map((line) => ({
      registrationId: line.registrationId,
      weight: favoured.has(line.registrationId) ? 2 : 1,
      preference: balanced ? balancedPreference(period, line.registration.balancePreference) : null
    }))
  }

  const seed = randomBytes(16).toString('hex')
  const result = await computeDraw(seed, [input], session.waitlistSize)
  const drawn = result.sessions[0]!
  const settings: DrawSettings = {
    selectionMode: session.selectionMode,
    weightNotDrawnBefore: session.weightNotDrawnBefore,
    weightBalance: balanced,
    balanceAttribute: balanced ? period.game.balanceAttribute : null,
    waitlistSize: session.waitlistSize,
    excludedReplayers: lines.filter((line) => excluded.has(line.registration.participantId)).map((line) => line.registrationId),
    // Entrées complètes du calcul (places, réserves, candidates avec poids et préférence) : avec la graine,
    // computeDraw les rejoue à l'identique (R18 de SPEC-001)
    sessions: [input]
  }

  return await prisma.$transaction(async (tx) => {
    // Deux tirages simultanés de la même session : le second voit le premier et refuse
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-draw:${sessionId}`}))`
    if (await tx.registrationDraw.findFirst({ where: { sessionId, cancelledAt: null }, select: { id: true } })) {
      throw createError({ statusCode: 409, message: 'Un tirage est déjà en cours d’effet : annulez-le pour en refaire un.' })
    }
    // Places recomptées sous le verrou des retenues à la main : une retenue arrivée entre-temps ne fait pas déborder
    await lockSession(tx, sessionId)
    const takenNow = await tx.registrationSession.count({ where: takenSeatsWhere([sessionId]) })
    if (session.seats - takenNow < input.freeSeats) {
      throw createError({ statusCode: 409, message: 'Des places ont été prises pendant le tirage : relancez-le.' })
    }
    const stillPreregistered = async (ids: string[], data: Record<string, unknown>) => {
      if (!ids.length) return
      const { count } = await tx.registrationSession.updateMany({ where: { sessionId, registrationId: { in: ids }, status: LINE.preregistered }, data })
      if (count !== ids.length) {
        throw createError({ statusCode: 409, message: 'Des personnes ont changé pendant le tirage : relancez-le.' })
      }
    }
    await stillPreregistered(drawn.retained, { status: LINE.retained, retainedById: null, responseDueAt: null, lastRemindedAt: null })
    await touchRegistrations(tx, [...drawn.retained, ...drawn.waitlisted])
    const last = await tx.registrationSession.aggregate({ where: { sessionId, status: LINE.waitlisted }, _max: { waitlistPosition: true } })
    const start = last._max.waitlistPosition ?? 0
    for (const [index, registrationId] of drawn.waitlisted.entries()) {
      await stillPreregistered([registrationId], { status: LINE.waitlisted, waitlistPosition: start + index + 1 })
    }
    return await tx.registrationDraw.create({
      data: { gameId: period.gameId, periodId, sessionId, seed, settings, result, createdById: author.id },
      select: { id: true, createdAt: true }
    })
  })
}

// La version d'une personne suit ses décisions : un assistant qui l'a lue avant ne les écrase pas
function touchRegistrations(tx: PrismaTx, ids: string[]) {
  return tx.registration.updateMany({ where: { id: { in: ids } }, data: { updatedAt: new Date() } })
}

// Une réponse qui n'est plus une valeur du jeu compte comme « peu importe » (ADR-0048)
function balancedPreference(period: SelectionPeriod, preference: string | null) {
  return preference && period.game.balanceValues.includes(preference) ? preference : null
}

/**
 * Annule un tirage (US-094) tant qu'aucune de ses personnes n'a reçu d'annonce depuis : celles dont la décision est
 * encore celle du tirage repartent pré-inscrites. Le tirage reste dans le journal, marqué annulé.
 */
export async function cancelDraw(drawId: string, author: { id: string }) {
  const draw = await prisma.registrationDraw.findUniqueOrThrow({ where: { id: drawId }, select: { id: true, sessionId: true, cancelledAt: true, createdAt: true, result: true } })
  if (draw.cancelledAt) {
    throw createError({ statusCode: 409, message: 'Ce tirage est déjà annulé.' })
  }
  const sessionId = draw.sessionId
  if (!sessionId) {
    throw createError({ statusCode: 409, message: 'Ce tirage d’une ancienne période reste au journal : il ne s’annule plus.' })
  }
  const result = draw.result as DrawResult
  const retained = result.sessions.flatMap((session) => session.retained)
  const waitlisted = result.sessions.flatMap((session) => session.waitlisted)
  if (await prisma.registrationSession.count({ where: { sessionId, registrationId: { in: [...retained, ...waitlisted] }, announcedAt: { gt: draw.createdAt } } })) {
    throw createError({ statusCode: 409, message: 'Des résultats de ce tirage sont déjà annoncés : corrigez à la main.' })
  }
  const back = { status: LINE.preregistered, waitlistPosition: null, responseDueAt: null, lastRemindedAt: null }

  await prisma.$transaction(async (tx) => {
    await touchRegistrations(tx, [...retained, ...waitlisted])
    const { count } = await tx.registrationDraw.updateMany({ where: { id: draw.id, cancelledAt: null }, data: { cancelledAt: new Date(), cancelledById: author.id } })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Ce tirage est déjà annulé.' })
    }
    await tx.registrationSession.updateMany({
      where: { sessionId, registrationId: { in: retained }, status: LINE.retained, retainedById: null },
      data: back
    })
    // Les personnages réservés aux personnes revenues pré-inscrites redeviennent libres (US-100)
    await tx.sessionAssignment.updateMany({
      where: { sessionId, reservedRegistration: { id: { in: retained }, sessionLines: { some: { sessionId, status: LINE.preregistered } } } },
      data: { reservedRegistrationId: null }
    })
    await tx.registrationSession.updateMany({
      where: { sessionId, registrationId: { in: waitlisted }, status: LINE.waitlisted },
      data: back
    })
  })
  return { success: true }
}

// Journal des tirages d'un vivier (US-094), annulés compris, du plus récent au plus ancien
export async function listDraws(periodId: string) {
  const draws = await prisma.registrationDraw.findMany({
    where: { periodId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      sessionId: true,
      seed: true,
      settings: true,
      result: true,
      createdAt: true,
      cancelledAt: true,
      session: { select: { id: true, status: true } },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } }
    }
  })
  // Colonnes JSON écrites par le tirage
  // Leur session avec son libellé (SPEC-021)
  return await labelNestedSessions(prisma, draws.map((draw) => ({ ...draw, settings: draw.settings as DrawSettings, result: draw.result as DrawResult })))
}
