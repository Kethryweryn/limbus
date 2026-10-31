import { prisma } from '~/server/utils/prisma'
import { openEmailTransport } from '~/server/utils/email'
import { countPlayableCharacters } from '~/server/utils/registrationPeriods'
import { createRegistrationToken, registrationResponseDueAt, registrationUrl, selectionAnnouncementEmail } from '~/server/utils/registrations'
import {
  CLOSED_SESSION_STATUSES,
  REGISTRATION_ENTRY_MODES,
  REGISTRATION_PERIOD_SCOPES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_STATUSES,
  REGISTRATION_STATUSES,
  SESSION_ROLES,
  SESSION_STATUSES
} from '~/utils/domain'
import { canConfirmPlace, isAnnouncementPending } from '~/utils/registrations'

export const SELECTION_ACTIONS = ['retain', 'waitlist', 'unwaitlist', 'reject', 'reset'] as const
export type SelectionAction = typeof SELECTION_ACTIONS[number]

// Statuts qu'une décision de sélection peut changer (US-087) ; confirmée ou désistée, on passe par le désistement
const SORTABLE_STATUSES: string[] = [REGISTRATION_STATUSES.received, ...REGISTRATION_SELECTION_STATUSES]
// Retenues et confirmées occupent une place (R5)
const SEAT_STATUSES: string[] = [REGISTRATION_STATUSES.retained, REGISTRATION_STATUSES.confirmed]

const selectionPeriodSelect = {
  id: true,
  gameId: true,
  scope: true,
  entryMode: true,
  replayPolicy: true,
  responseDelayDays: true,
  game: { select: { title: true } },
  sessions: { select: { sessionId: true, seats: true, session: { select: { id: true, name: true, date: true, status: true } } } }
} as const

type SelectionPeriod = NonNullable<Awaited<ReturnType<typeof findSelectionPeriod>>>

async function findSelectionPeriod(periodId: string) {
  return await prisma.registrationPeriod.findUnique({ where: { id: periodId }, select: selectionPeriodSelect })
}

export function isPermanentPeriod(period: { scope: string }) {
  return period.scope === REGISTRATION_PERIOD_SCOPES.game
}

/**
 * Sessions pour lesquelles on trie (US-087, US-090), avec leurs places :
 * - période ordinaire : ses sessions ni annulées ni terminées, avec les places de la période ;
 * - inscription permanente : les sessions à venir du jeu sans période dédiée, avec `Session.poolSeats`,
 *   ou à défaut le nombre de personnages PJ (R5).
 */
export async function selectableSessions(period: SelectionPeriod) {
  if (!isPermanentPeriod(period)) {
    return period.sessions
      .filter((link) => !CLOSED_SESSION_STATUSES.includes(link.session.status))
      .map((link) => ({ ...link.session, seats: link.seats, defaultSeats: false }))
  }
  const sessions = await prisma.session.findMany({
    where: { gameId: period.gameId, status: { notIn: CLOSED_SESSION_STATUSES }, registrationPeriodLink: null },
    orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    select: { id: true, name: true, date: true, status: true, poolSeats: true }
  })
  const playable = sessions.some((session) => session.poolSeats == null) ? await countPlayableCharacters(period.gameId) : 0
  return sessions.map(({ poolSeats, ...session }) => ({ ...session, seats: poolSeats ?? playable, defaultSeats: poolSeats == null }))
}

// A déjà joué (R7) : participant d'une session terminée du jeu
export async function replayerParticipantIds(gameId: string, participantIds: string[]) {
  if (!participantIds.length) return new Set<string>()
  const rows = await prisma.sessionParticipant.findMany({
    where: {
      participantId: { in: participantIds },
      role: SESSION_ROLES.participant,
      session: { gameId, status: SESSION_STATUSES.completed }
    },
    distinct: ['participantId'],
    select: { participantId: true }
  })
  return new Set(rows.map((row) => row.participantId))
}

/**
 * Vivier de l'inscription permanente (R30, ADR-0047), calculé à la lecture : une inscription reçue, ou
 * retenue ou confirmée pour une session depuis annulée ou terminée, y est (de nouveau). Une personne qui a joué
 * n'y revient pas si les rejoueurs sont exclus.
 */
export function isBackInPool(registration: { status: string, session: { status: string } | null }) {
  return SEAT_STATUSES.includes(registration.status)
    && (!registration.session || CLOSED_SESSION_STATUSES.includes(registration.session.status))
}

/**
 * Ce que l'écran de sélection ajoute à la liste des inscriptions (US-087, US-090) : les sessions à remplir avec
 * leurs places et les places prises, et les personnes qui ont déjà joué le jeu, quand la période les signale.
 */
export async function selectionOverview(periodId: string) {
  const period = (await findSelectionPeriod(periodId))!
  const sessions = await selectableSessions(period)
  const taken = await prisma.registration.groupBy({
    by: ['sessionId'],
    where: { sessionId: { in: sessions.map((session) => session.id) }, status: { in: SEAT_STATUSES } },
    _count: { _all: true }
  })
  const takenBySession = new Map(taken.map((row) => [row.sessionId, row._count._all]))
  const flagged = period.replayPolicy !== REGISTRATION_REPLAY_POLICIES.allowed
  const participants = flagged
    ? await prisma.registration.findMany({ where: { periodId }, select: { participantId: true } })
    : []
  const replayers = await replayerParticipantIds(period.gameId, participants.map((row) => row.participantId))
  return {
    permanent: isPermanentPeriod(period),
    replayPolicy: period.replayPolicy,
    sessions: sessions.map((session) => ({ ...session, taken: takenBySession.get(session.id) ?? 0 })),
    replayerParticipantIds: [...replayers]
  }
}

function assertFormPeriod(period: { entryMode: string }) {
  if (period.entryMode !== REGISTRATION_ENTRY_MODES.form) {
    throw createError({ statusCode: 409, message: 'La sélection concerne les périodes en mode formulaire : en mode invitation, on invite directement.' })
  }
}

async function lockSession(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], sessionId: string) {
  // Deux décisions simultanées pour la même session comptent les places l'une après l'autre
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-seats:${sessionId}`}))`
}

/**
 * Décision de sélection sur une inscription (US-087, US-090). Rien n'est envoyé : la décision est
 * « à annoncer » (US-088). Le statut lu est revérifié à l'écriture : un désistement simultané l'emporte.
 */
export async function applySelection(registrationId: string, action: SelectionAction, sessionId: string | null) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      sessionId: true,
      periodId: true,
      participantId: true,
      session: { select: { status: true } },
      availabilities: { select: { sessionId: true } },
      waitlistEntries: { select: { sessionId: true } }
    }
  })
  const period = (await findSelectionPeriod(registration.periodId))!
  assertFormPeriod(period)
  const permanent = isPermanentPeriod(period)
  const backInPool = permanent && isBackInPool(registration)
  if (!SORTABLE_STATUSES.includes(registration.status) && !backInPool) {
    throw createError({ statusCode: 409, message: 'Cette inscription ne peut plus être triée : la personne a confirmé ou s’est désistée.' })
  }
  if (action === 'reject' && permanent) {
    throw createError({ statusCode: 400, message: 'Dans le vivier, une personne qu’on ne retient pas y reste simplement.' })
  }

  let session: Awaited<ReturnType<typeof selectableSessions>>[number] | undefined
  if (action === 'retain' || action === 'waitlist') {
    session = (await selectableSessions(period)).find((candidate) => candidate.id === sessionId)
    if (!session) {
      throw createError({ statusCode: 400, message: 'Session invalide pour cette période d’inscription' })
    }
    // Disponibilités : seulement dans une période ordinaire à plusieurs sessions (R10)
    if (!permanent && period.sessions.length > 1 && !registration.availabilities.some((availability) => availability.sessionId === session!.id)) {
      throw createError({ statusCode: 400, message: 'Cette personne n’est pas disponible pour cette session.' })
    }
    if (permanent && period.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
      && (await replayerParticipantIds(period.gameId, [registration.participantId])).size) {
      throw createError({ statusCode: 409, message: 'Cette personne a déjà joué : les rejoueurs sont exclus du vivier.' })
    }
  }
  if (action === 'unwaitlist' && !registration.waitlistEntries.some((entry) => entry.sessionId === sessionId)) {
    throw createError({ statusCode: 400, message: 'Cette personne n’est pas sur la liste d’attente de cette session.' })
  }

  const unchanged = { id: registration.id, status: registration.status, sessionId: registration.sessionId }
  // Une place retenue n'a d'échéance qu'une fois annoncée (ADR-0047)
  const cleared = { responseDueAt: null, respondedAt: null, confirmedAt: null, lastRemindedAt: null }
  await prisma.$transaction(async (tx) => {
    const write = async (data: Record<string, unknown>) => {
      const { count } = await tx.registration.updateMany({ where: unchanged, data })
      if (!count) {
        throw createError({ statusCode: 409, message: 'Cette inscription a changé entre-temps : rechargez la page.' })
      }
    }

    if (action === 'retain') {
      await lockSession(tx, session!.id)
      const taken = await tx.registration.count({
        where: { sessionId: session!.id, status: { in: SEAT_STATUSES }, id: { not: registration.id } }
      })
      if (taken >= session!.seats) {
        throw createError({
          statusCode: 409,
          message: `La session « ${session!.name} » est complète (${session!.seats} place${session!.seats > 1 ? 's' : ''}) : augmentez le nombre de places pour retenir une personne de plus.`
        })
      }
      await write({ status: REGISTRATION_STATUSES.retained, sessionId: session!.id, ...cleared })
      await tx.registrationWaitlistEntry.deleteMany({ where: { registrationId: registration.id } })
    } else if (action === 'waitlist') {
      if (!registration.waitlistEntries.some((entry) => entry.sessionId === session!.id)) {
        const last = await tx.registrationWaitlistEntry.aggregate({ where: { sessionId: session!.id }, _max: { position: true } })
        await tx.registrationWaitlistEntry.create({
          data: { registrationId: registration.id, sessionId: session!.id, position: (last._max.position ?? 0) + 1 }
        })
      }
      await write({ status: REGISTRATION_STATUSES.waitlisted, sessionId: null, ...cleared })
    } else if (action === 'unwaitlist') {
      await tx.registrationWaitlistEntry.deleteMany({ where: { registrationId: registration.id, sessionId: sessionId! } })
      // Sortie de sa dernière file, l'inscription est de nouveau à trier
      const remaining = await tx.registrationWaitlistEntry.count({ where: { registrationId: registration.id } })
      if (!remaining) await write({ status: REGISTRATION_STATUSES.received })
    } else {
      await write({ status: action === 'reject' ? REGISTRATION_STATUSES.rejected : REGISTRATION_STATUSES.received, sessionId: null, ...cleared })
      await tx.registrationWaitlistEntry.deleteMany({ where: { registrationId: registration.id } })
    }
  })
  return { success: true }
}

// Nouvel ordre de la liste d'attente d'une session (R19) : exactement les inscriptions de la période qui y attendent
export async function reorderWaitlist(periodId: string, sessionId: string, registrationIds: string[]) {
  const entries = await prisma.registrationWaitlistEntry.findMany({
    where: { sessionId, registration: { periodId } },
    select: { id: true, registrationId: true }
  })
  const current = new Set(entries.map((entry) => entry.registrationId))
  if (registrationIds.length !== current.size || new Set(registrationIds).size !== current.size || registrationIds.some((id) => !current.has(id))) {
    throw createError({ statusCode: 409, message: 'La liste d’attente a changé entre-temps : rechargez la page.' })
  }
  const entryByRegistration = new Map(entries.map((entry) => [entry.registrationId, entry.id]))
  await prisma.$transaction(registrationIds.map((registrationId, index) =>
    prisma.registrationWaitlistEntry.update({ where: { id: entryByRegistration.get(registrationId)! }, data: { position: index + 1 } })
  ))
  return { success: true }
}

// Places d'une session recrutée par l'inscription permanente (US-090) ; vide : le nombre de personnages PJ
export async function setPoolSeats(periodId: string, sessionId: string, seats: number | null) {
  const period = (await findSelectionPeriod(periodId))!
  if (!isPermanentPeriod(period)) {
    throw createError({ statusCode: 400, message: 'Les places d’une période ordinaire se règlent dans la période.' })
  }
  if (!(await selectableSessions(period)).some((session) => session.id === sessionId)) {
    throw createError({ statusCode: 400, message: 'Session invalide pour cette période d’inscription' })
  }
  const playable = seats ?? await countPlayableCharacters(period.gameId)
  // On ne descend pas sous le nombre de personnes retenues ou confirmées (US-087)
  if (playable < await prisma.registration.count({ where: { sessionId, status: { in: SEAT_STATUSES } } })) {
    throw createError({ statusCode: 409, message: 'Cette session a plus de personnes retenues ou confirmées que de places : retirez-en avant de baisser le nombre de places.' })
  }
  await prisma.session.update({ where: { id: sessionId }, data: { poolSeats: seats } })
  return { success: true }
}

/**
 * Annonce les décisions pas encore annoncées d'une période (US-088, ADR-0047) : un email par personne,
 * avec un nouveau lien personnel ; l'échéance d'une place retenue part de l'annonce (R20).
 * Le jeton n'est enregistré qu'après l'envoi : un échec laisse l'ancien lien valable et la décision à annoncer.
 */
export async function announceSelection(periodId: string) {
  const period = (await findSelectionPeriod(periodId))!
  assertFormPeriod(period)
  const registrations = (await prisma.registration.findMany({
    where: { periodId, status: { in: REGISTRATION_SELECTION_STATUSES } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      sessionId: true,
      email: true,
      announcedStatus: true,
      announcedSessionId: true,
      participant: { select: { name: true } },
      session: { select: { name: true, date: true } },
      waitlistEntries: { orderBy: { session: { date: 'asc' } }, select: { session: { select: { name: true, date: true } } } }
    }
  })).filter(isAnnouncementPending)

  const results: Array<{ participantName: string, sent: boolean, message: string | null }> = []
  const transport = await openEmailTransport().catch(() => null)
  try {
    for (const registration of registrations) {
      const now = new Date()
      const retained = registration.status === REGISTRATION_STATUSES.retained
      const responseDueAt = retained ? registrationResponseDueAt(period.responseDelayDays, now) : null
      const { token, tokenHash } = createRegistrationToken()
      const email = selectionAnnouncementEmail({
        status: registration.status,
        participantName: registration.participant.name,
        gameTitle: period.game.title,
        sessions: retained ? [registration.session!] : registration.waitlistEntries.map((entry) => entry.session),
        responseDueAt,
        url: registrationUrl(token)
      })
      if (!transport) {
        results.push({ participantName: registration.participant.name, sent: false, message: 'SMTP désactivé' })
        continue
      }
      try {
        await transport.send({ to: registration.email, ...email })
      } catch (error) {
        results.push({ participantName: registration.participant.name, sent: false, message: (error as { message?: string })?.message || 'Erreur SMTP' })
        continue
      }
      await prisma.registration.updateMany({
        where: { id: registration.id, status: registration.status, sessionId: registration.sessionId },
        data: {
          tokenHash,
          announcedStatus: registration.status,
          announcedSessionId: registration.sessionId,
          announcedAt: now,
          ...(retained ? { responseDueAt } : {})
        }
      })
      results.push({ participantName: registration.participant.name, sent: true, message: null })
    }
  } finally {
    transport?.close()
  }

  return {
    announcedCount: results.filter((result) => result.sent).length,
    failures: results.filter((result) => !result.sent).map(({ participantName, message }) => ({ participantName, message }))
  }
}

/**
 * Confirmation d'une place retenue (US-089, R20, R22), même après l'échéance tant que la place n'est pas libérée :
 * la personne devient participante de la session, comme à l'acceptation d'une invitation.
 */
export async function confirmRetainedPlace(registration: { id: string, status: string, sessionId: string | null, participantId: string, announcedStatus: string | null, announcedSessionId: string | null }) {
  if (!canConfirmPlace(registration)) {
    throw createError({ statusCode: 409, message: 'Aucune place à confirmer pour cette inscription.' })
  }
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.registration.updateMany({
      where: { id: registration.id, status: REGISTRATION_STATUSES.retained, sessionId: registration.sessionId },
      data: { status: REGISTRATION_STATUSES.confirmed, respondedAt: now, confirmedAt: now }
    })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
    }
    const key = { sessionId: registration.sessionId!, participantId: registration.participantId, role: SESSION_ROLES.participant }
    await tx.sessionParticipant.upsert({ where: { sessionId_participantId_role: key }, update: {}, create: key })
  })
}
