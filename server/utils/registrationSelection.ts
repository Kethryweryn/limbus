import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { openEmailTransport, type EmailTransport } from '~/server/utils/email'
import { countPlayableCharacters, takenSeatsWhere } from '~/server/utils/registrationPeriods'
import { affinityOverview } from '~/server/utils/registrationAffinities'
import { createRegistrationToken, registrationResponseDueAt, registrationUrl, selectionAnnouncementEmail } from '~/server/utils/registrations'
import {
  REGISTRATION_ANSWERS,
  REGISTRATION_DEFAULT_WAITLIST_SIZE,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_SELECTION_STATUSES,
  REGISTRATION_SESSION_STATUSES as LINE,
  REGISTRATION_STATUSES,
  SESSION_CAST_ROLES,
  SESSION_ROLES,
  SESSION_STATUSES
} from '~/utils/domain'
import type { REGISTRATION_SELECTION_ACTIONS, RegistrationSessionStatus } from '~/utils/domain'
import { isOpenableSession } from '~/utils/registrationPeriods'
import { ANNOUNCEMENT_REMOVED, canConfirmPlace, pendingAnnouncement } from '~/utils/registrations'

export type SelectionAction = typeof REGISTRATION_SELECTION_ACTIONS[number]
const selectionPeriodSelect = {
  id: true,
  gameId: true,
  replayPolicy: true,
  responseDelayDays: true,
  createdAt: true,
  game: { select: { title: true, balanceAttribute: true, balanceValues: true } }
} as const

export type SelectionPeriod = NonNullable<Awaited<ReturnType<typeof findSelectionPeriod>>>

export async function findSelectionPeriod(periodId: string) {
  return await prisma.registrationPeriod.findUnique({ where: { id: periodId }, select: selectionPeriodSelect })
}

/**
 * Sessions du jeu où l'on peut caster (R20) : toutes les sessions prévues, ouvertes ou non, dans l'ordre des dates.
 * Une session sans ligne dans le vivier a les réglages par défaut : elle n'a encore rien de particulier.
 */
export async function selectableSessions(period: { gameId: string }) {
  const [sessions, seats] = await Promise.all([
    prisma.session.findMany({
      where: { gameId: period.gameId, status: SESSION_STATUSES.scheduled },
      orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        date: true,
        status: true,
        registrationPeriodLink: {
          select: { open: true, lastRequestedAt: true, castAnnouncedAt: true, selectionMode: true, organizerPicks: true, weightNotDrawnBefore: true, weightBalance: true, waitlistSize: true }
        }
      }
    }),
    countPlayableCharacters(period.gameId)
  ])
  return sessions.map(({ registrationPeriodLink: link, ...session }) => ({
    ...session,
    seats,
    open: Boolean(link?.open),
    // Proposée au vivier : ouverte par l'équipe, et encore datée et à venir (R6)
    offered: Boolean(link?.open) && isOpenableSession(session),
    openable: isOpenableSession(session),
    lastRequestedAt: link?.lastRequestedAt ?? null,
    castAnnouncedAt: link?.castAnnouncedAt ?? null,
    selectionMode: link?.selectionMode ?? REGISTRATION_SELECTION_MODES.chosen,
    organizerPicks: link?.organizerPicks ?? null,
    weightNotDrawnBefore: link?.weightNotDrawnBefore ?? false,
    weightBalance: link?.weightBalance ?? false,
    waitlistSize: link?.waitlistSize ?? REGISTRATION_DEFAULT_WAITLIST_SIZE
  }))
}

export type SelectableSession = Awaited<ReturnType<typeof selectableSessions>>[number]

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
 * Ce que l'écran de sélection ajoute à la liste du vivier : les sessions à caster avec leurs places et les places
 * prises, le tirage en cours de chacune, et les personnes qui ont déjà joué le jeu, quand le vivier les signale.
 */
export async function selectionOverview(periodId: string) {
  const period = (await findSelectionPeriod(periodId))!
  const sessions = await selectableSessions(period)
  const sessionIds = sessions.map((session) => session.id)
  const [taken, draws, pool] = await Promise.all([
    prisma.registrationSession.groupBy({ by: ['sessionId'], where: takenSeatsWhere(sessionIds), _count: { _all: true } }),
    prisma.registrationDraw.findMany({ where: { sessionId: { in: sessionIds }, cancelledAt: null }, select: { id: true, sessionId: true } }),
    prisma.registration.findMany({
      where: { periodId, status: REGISTRATION_STATUSES.received },
      select: {
        participantId: true,
        sessionLines: { where: { sessionId: { in: sessionIds } }, select: { sessionId: true, answer: true } },
        participant: { select: { sessionRoles: { where: { sessionId: { in: sessionIds }, role: { in: SESSION_CAST_ROLES } }, select: { sessionId: true } } } }
      }
    })
  ])
  const takenBySession = new Map(taken.map((row) => [row.sessionId, row._count._all]))
  const drawBySession = new Map(draws.map((draw) => [draw.sessionId, draw.id]))
  const flagged = period.replayPolicy !== REGISTRATION_REPLAY_POLICIES.allowed
  const participants = flagged
    ? await prisma.registration.findMany({ where: { periodId }, select: { participantId: true } })
    : []
  const replayers = await replayerParticipantIds(period.gameId, participants.map((row) => row.participantId))
  // Une rejoueuse exclue ne reçoit pas de demande (R24)
  const askable = period.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded ? pool.filter((person) => !replayers.has(person.participantId)) : pool
  const lines = pool.flatMap((person) => person.sessionLines)
  return {
    replayPolicy: period.replayPolicy,
    sessions: sessions.map((session) => ({
      ...session,
      taken: takenBySession.get(session.id) ?? 0,
      // Demande de disponibilités (R9, R12) : qui recevrait un email, et les réponses reçues
      askableCount: askable.filter((person) => !person.sessionLines.some((line) => line.sessionId === session.id)
        && !person.participant.sessionRoles.some((role) => role.sessionId === session.id)).length,
      answeredCount: lines.filter((line) => line.sessionId === session.id && line.answer).length,
      activeDrawId: drawBySession.get(session.id) ?? null
    })),
    replayerParticipantIds: [...replayers],
    // Alertes, personnes souhaitées et lignes à rattacher (US-095, US-096)
    affinities: await affinityOverview(periodId, sessionIds)
  }
}

// Le tirage actif (non annulé) d'une session : il y en a au plus un (R22)
export async function activeDraw(sessionId: string, db: PrismaTx = prisma) {
  return await db.registrationDraw.findFirst({ where: { sessionId, cancelledAt: null }, select: { id: true, createdAt: true } })
}

/**
 * Retenir à la main avant le tirage (US-092, ADR-0048) : refusé en mode hasard ; en mode mixte, chaque organisatrice
 * retient au plus `organizerPicks` personnes par session. Une fois un tirage fait, les corrections sont libres.
 */
async function assertManualRetainAllowed(db: PrismaTx, session: Pick<SelectableSession, 'id' | 'selectionMode' | 'organizerPicks'>, userId: string) {
  if (session.selectionMode === REGISTRATION_SELECTION_MODES.chosen) return
  if (await activeDraw(session.id, db)) return
  if (session.selectionMode === REGISTRATION_SELECTION_MODES.random) {
    throw createError({ statusCode: 409, message: 'Cette session sélectionne au hasard : lancez le tirage, puis corrigez à la main si besoin.' })
  }
  const picks = session.organizerPicks ?? 0
  const mine = await db.registrationSession.count({ where: { ...takenSeatsWhere([session.id]), retainedById: userId } })
  if (mine >= picks) {
    throw createError({
      statusCode: 409,
      message: `Mode mixte : vous avez déjà retenu ${mine} personne${mine > 1 ? 's' : ''} pour cette session (${picks} au plus par organisatrice avant le tirage).`
    })
  }
}

/**
 * Combien de personnes une organisatrice peut encore retenir à la main pour cette session, et ce qui l'en empêche sinon :
 * les places (R8) et le mode de sélection (assertManualRetainAllowed). Sert à l'assistant de casting, qui ne propose pas
 * plus de pré-inscrites que cela (R21).
 */
export async function manualRetainRoom(gameId: string, sessionId: string, userId: string) {
  const session = (await selectableSessions({ gameId })).find((candidate) => candidate.id === sessionId)
  if (!session) return { room: 0, reason: 'Cette session n’est plus prévue : personne ne peut y être retenu.' }
  const taken = await prisma.registrationSession.count({ where: takenSeatsWhere([sessionId]) })
  const free = Math.max(0, session.seats - taken)
  const full = { room: free, reason: 'Plus de place libre pour cette session.' }
  if (session.selectionMode === REGISTRATION_SELECTION_MODES.chosen || await activeDraw(sessionId)) return full
  if (session.selectionMode === REGISTRATION_SELECTION_MODES.random) {
    return { room: 0, reason: 'Cette session sélectionne au hasard : lancez d’abord le tirage.' }
  }
  const mine = await prisma.registrationSession.count({ where: { ...takenSeatsWhere([sessionId]), retainedById: userId } })
  const picks = Math.max(0, (session.organizerPicks ?? 0) - mine)
  return picks < free ? { room: picks, reason: 'Mode mixte : vous avez atteint votre nombre de personnes à retenir avant le tirage.' } : full
}

export async function lockSession(tx: PrismaTx, sessionId: string) {
  // Deux décisions simultanées pour la même session comptent les places l'une après l'autre
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registration-seats:${sessionId}`}))`
}

// Une session recrutée par le vivier a sa ligne, même si l'équipe ne l'a jamais ouverte (ADR-0069)
export async function ensureSessionLink(tx: PrismaTx, periodId: string, sessionId: string) {
  await tx.registrationPeriodSession.upsert({ where: { sessionId }, update: {}, create: { periodId, sessionId } })
}

// Message du refus quand une session est complète (R8)
export function fullSessionMessage(session: { name: string, seats: number }) {
  return `La session « ${session.name} » est complète (${session.seats} place${session.seats > 1 ? 's' : ''}) : créez un personnage pour ajouter une place.`
}

/** Les personnes d'un même vivier et la session d'une décision, contrôlées avant de l'écrire. */
export async function selectionTargets(registrationIds: string[], sessionId: string) {
  const registrations = await prisma.registration.findMany({
    where: { id: { in: registrationIds } },
    select: { id: true, status: true, periodId: true }
  })
  if (registrations.length !== registrationIds.length) {
    throw createError({ statusCode: 404, message: 'Inscription introuvable' })
  }
  if (registrations.some((registration) => registration.status !== REGISTRATION_STATUSES.received)) {
    throw createError({ statusCode: 409, message: 'Cette personne n’est pas dans le vivier : elle n’a pas répondu au questionnaire, ou elle en est sortie.' })
  }
  const [first] = registrations
  if (!first) return []
  const period = (await findSelectionPeriod(first.periodId))!
  const session = (await selectableSessions(period)).find((candidate) => candidate.id === sessionId)
  if (!session) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce vivier' })
  }
  return registrations.map((registration) => ({ registration, session }))
}

export type SelectionTarget = Awaited<ReturnType<typeof selectionTargets>>[number]

/**
 * Écrit une décision dans la transaction donnée : le cast y retient une personne du vivier en même temps qu'il lui
 * réserve son personnage (R20).
 */
export async function writeSelection(tx: PrismaTx, { registration, session }: SelectionTarget, action: SelectionAction, author: { id: string }) {
  const registrationId = registration.id
  const sessionId = session.id
  const key = { registrationId_sessionId: { registrationId, sessionId } }
  await lockSession(tx, sessionId)
  if (action === 'retain') await assertManualRetainAllowed(tx, session, author.id)
  const line = await tx.registrationSession.findUnique({ where: key, select: { status: true, answer: true, announcedStatus: true } })
  if (line?.status === LINE.confirmed || line?.status === LINE.transferred) {
    throw createError({ statusCode: 409, message: 'Cette personne a confirmé sa présence : passez par l’annulation.' })
  }
  await ensureSessionLink(tx, registration.periodId, sessionId)
  // La version de la personne suit ses décisions : un assistant qui l'a lue avant ne les écrase pas
  await tx.registration.update({ where: { id: registrationId }, data: { updatedAt: new Date() } })
  // Une annulation repart de zéro : ce qui lui avait été annoncé ne vaut plus
  const fromCancelled = line?.status === LINE.cancelled ? { announcedStatus: null, announcedAt: null, cancelledAt: null, cancelledById: null } : {}

  if (action === 'retain') {
    const taken = await tx.registrationSession.count({ where: { ...takenSeatsWhere([sessionId]), registrationId: { not: registrationId } } })
    if (taken >= session.seats) throw createError({ statusCode: 409, message: fullSessionMessage(session) })
    // Une place retenue n'a d'échéance qu'une fois annoncée (ADR-0047) ; revenir à la place déjà annoncée garde la sienne
    const announced = line?.announcedStatus === LINE.retained && line.status !== LINE.cancelled
    const data = {
      status: LINE.retained,
      waitlistPosition: null,
      retainedById: author.id,
      ignoredStatus: null,
      // Un repère d'avant son retour au cast ne parle plus de ce casting (R16)
      answersChangedAt: null,
      ...fromCancelled,
      ...(announced ? {} : { responseDueAt: null, lastRemindedAt: null })
    }
    await tx.registrationSession.upsert({ where: key, update: data, create: { registrationId, sessionId, ...data } })
    return
  }

  if (action === 'waitlist') {
    if (line?.status !== LINE.waitlisted) {
      const last = await tx.registrationSession.aggregate({ where: { sessionId, status: LINE.waitlisted }, _max: { waitlistPosition: true } })
      const data = { status: LINE.waitlisted, waitlistPosition: (last._max.waitlistPosition ?? 0) + 1, retainedById: null, ignoredStatus: null, ...fromCancelled }
      await tx.registrationSession.upsert({ where: key, update: data, create: { registrationId, sessionId, ...data } })
    }
  } else {
    if (action === 'unwaitlist' && line?.status !== LINE.waitlisted) {
      throw createError({ statusCode: 400, message: 'Cette personne n’est pas sur la liste d’attente de cette session.' })
    }
    if (line) await backToAnswer(tx, registrationId, sessionId, line, author.id)
  }
  // Plus retenue pour cette session : le personnage réservé redevient libre (US-100)
  await tx.sessionAssignment.updateMany({ where: { sessionId, reservedRegistrationId: registrationId }, data: { reservedRegistrationId: null } })
}

/**
 * Décision de sélection pour une session (R20). Rien n'est envoyé : la décision est « à annoncer » (US-088).
 * Une personne du vivier peut être retenue ou mise en attente même sans réponse, même « pas disponible » ou rejoueuse
 * exclue : l'écran le signale. Inscrite ou transférée, on passe par l'annulation.
 */
export async function applySelection(registrationId: string, action: SelectionAction, sessionId: string, author: { id: string }) {
  const [target] = await selectionTargets([registrationId], sessionId)
  await prisma.$transaction((tx) => writeSelection(tx, target!, action, author))
  return { success: true }
}

/**
 * Une personne qui sort du cast ou de la liste d'attente revient à sa dernière réponse (R28). Sans réponse, sa ligne
 * disparaît ; si une place lui avait été annoncée, elle passe à « annulation » (R17).
 */
async function backToAnswer(
  tx: PrismaTx,
  registrationId: string,
  sessionId: string,
  line: { status: string, answer: string | null, announcedStatus: string | null },
  authorId: string
) {
  const key = { registrationId_sessionId: { registrationId, sessionId } }
  const cleared = { waitlistPosition: null, retainedById: null, responseDueAt: null, lastRemindedAt: null, ignoredStatus: null }
  if (line.status === LINE.cancelled) return
  if (line.announcedStatus === LINE.retained || (line.announcedStatus && !line.answer)) {
    await tx.registrationSession.update({ where: key, data: { ...cleared, status: LINE.cancelled, cancelledAt: new Date(), cancelledById: authorId } })
  } else if (line.answer) {
    const status = line.answer === REGISTRATION_ANSWERS.available ? LINE.preregistered : LINE.unavailable
    await tx.registrationSession.update({ where: key, data: { ...cleared, status } })
  } else {
    await tx.registrationSession.delete({ where: key })
  }
}

// Nouvel ordre de la liste d'attente d'une session (R23) : exactement les personnes du vivier qui y attendent
export async function reorderWaitlist(periodId: string, sessionId: string, registrationIds: string[]) {
  const lines = await prisma.registrationSession.findMany({
    where: { sessionId, status: LINE.waitlisted, registration: { periodId } },
    select: { id: true, registrationId: true }
  })
  const current = new Set(lines.map((line) => line.registrationId))
  if (registrationIds.length !== current.size || new Set(registrationIds).size !== current.size || registrationIds.some((id) => !current.has(id))) {
    throw createError({ statusCode: 409, message: 'La liste d’attente a changé entre-temps : rechargez la page.' })
  }
  const lineByRegistration = new Map(lines.map((line) => [line.registrationId, line.id]))
  await prisma.$transaction(registrationIds.map((registrationId, index) =>
    prisma.registrationSession.update({ where: { id: lineByRegistration.get(registrationId)! }, data: { waitlistPosition: index + 1 } })
  ))
  return { success: true }
}

const announcementLineSelect = {
  id: true,
  status: true,
  announcedStatus: true,
  ignoredStatus: true,
  cancelledById: true,
  session: { select: { name: true, date: true } }
} as const

type AnnouncementTarget = {
  id: string
  email: string
  participant: { name: string }
}
type AnnouncementLine = { id: string, status: RegistrationSessionStatus, announcedStatus: RegistrationSessionStatus | null, ignoredStatus: RegistrationSessionStatus | null, cancelledById: string | null, session: { name: string, date: Date | null } }

/**
 * Écrit à une personne ce qu'il y a à lui annoncer pour une session. Chaque email a son lien (ADR-0070), créé avant
 * l'envoi : un email parti ne porte jamais un lien mort, et un échec efface le lien et laisse l'annonce à faire.
 * L'échéance d'une place retenue part de cet email (R20, R27). Un retrait annoncé ne se propose plus, et la personne voit
 * son nouveau statut.
 */
async function deliverAnnouncement(transport: EmailTransport, period: { responseDelayDays: number, game: { title: string } }, registration: AnnouncementTarget, line: AnnouncementLine, now = new Date()) {
  const status = pendingAnnouncement(line)!
  const responseDueAt = status === LINE.retained ? registrationResponseDueAt(period.responseDelayDays, now) : null
  const { token, tokenHash } = createRegistrationToken()
  const link = await prisma.registrationLink.create({ data: { registrationId: registration.id, tokenHash }, select: { id: true } })
  try {
    await transport.send({
      to: registration.email,
      ...selectionAnnouncementEmail({ status, participantName: registration.participant.name, gameTitle: period.game.title, url: registrationUrl(token), sessions: [line.session], responseDueAt })
    })
  } catch (error) {
    await prisma.registrationLink.delete({ where: { id: link.id } })
    throw error
  }
  const announcedStatus = status !== ANNOUNCEMENT_REMOVED ? status : line.status === LINE.cancelled ? LINE.cancelled : null
  await prisma.registrationSession.updateMany({
    where: { id: line.id, status: line.status },
    data: { announcedStatus, announcedAt: now, ignoredStatus: null, ...(responseDueAt ? { responseDueAt } : {}) }
  })
}

/**
 * Annonce le casting d'une session (R26) : un email à chaque personne retenue, et à la liste d'attente si l'équipe l'a
 * coché. Sans cette case, son email est écarté : il ne se propose pas ensuite. Une fois une annonce partie, chaque
 * changement se propose sur sa ligne (R27) ; ce qui n'est pas parti y reste à envoyer.
 */
export async function announceCast(periodId: string, sessionId: string, includeWaitlist: boolean) {
  const period = (await findSelectionPeriod(periodId))!
  const session = (await selectableSessions(period)).find((candidate) => candidate.id === sessionId)
  if (!session) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce vivier' })
  }
  if (session.castAnnouncedAt) {
    throw createError({ statusCode: 409, message: 'Ce casting est déjà annoncé : chaque changement se propose sur sa ligne.' })
  }
  const registrations = await prisma.registration.findMany({
    where: { periodId, status: REGISTRATION_STATUSES.received, sessionLines: { some: { sessionId, status: { in: REGISTRATION_SELECTION_STATUSES } } } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      participant: { select: { name: true } },
      sessionLines: { where: { sessionId }, select: announcementLineSelect }
    }
  })
  const lines = registrations.flatMap(({ sessionLines, ...registration }) => sessionLines.map((line) => ({ registration, line }))).filter(({ line }) => pendingAnnouncement(line))

  const failures: Array<{ participantName: string, message: string | null }> = []
  let announcedCount = 0
  const transport = await openEmailTransport().catch(() => null)
  try {
    for (const { registration, line } of lines) {
      if (line.status === LINE.waitlisted && !includeWaitlist) continue
      const participantName = registration.participant.name
      if (!transport) {
        failures.push({ participantName, message: 'SMTP désactivé' })
        continue
      }
      try {
        await deliverAnnouncement(transport, period, registration, line)
        announcedCount++
      } catch (error) {
        failures.push({ participantName, message: (error as { message?: string })?.message || 'Erreur SMTP' })
      }
    }
  } finally {
    transport?.close()
  }

  if (announcedCount) {
    await prisma.$transaction(async (tx) => {
      await tx.registrationPeriodSession.update({ where: { sessionId }, data: { castAnnouncedAt: new Date() } })
      if (!includeWaitlist) {
        const waiting = lines.filter(({ line }) => line.status === LINE.waitlisted).map(({ line }) => line.id)
        await tx.registrationSession.updateMany({ where: { id: { in: waiting }, status: LINE.waitlisted }, data: { ignoredStatus: LINE.waitlisted } })
      }
    })
  }
  return { announcedCount, failures }
}

// La ligne à annoncer d'une session déjà annoncée (R27)
async function requireProposedLine(registrationId: string, sessionId: string) {
  const link = await prisma.registrationPeriodSession.findUnique({ where: { sessionId }, select: { castAnnouncedAt: true } })
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      id: true,
      email: true,
      periodId: true,
      participant: { select: { name: true } },
      sessionLines: { where: { sessionId }, select: announcementLineSelect }
    }
  })
  const line = registration.sessionLines[0]
  if (!link?.castAnnouncedAt || !line || !pendingAnnouncement(line)) {
    throw createError({ statusCode: 409, message: 'Il n’y a plus d’email à proposer pour cette personne : rechargez la page.' })
  }
  return { registration, line }
}

export async function sendLineAnnouncement(registrationId: string, sessionId: string) {
  const { registration, line } = await requireProposedLine(registrationId, sessionId)
  const period = (await findSelectionPeriod(registration.periodId))!
  const transport = await openEmailTransport().catch(() => null)
  if (!transport) throw createError({ statusCode: 502, message: 'L’envoi d’emails est désactivé : rien n’est parti.' })
  try {
    await deliverAnnouncement(transport, period, registration, line)
  } catch (error) {
    throw createError({ statusCode: 502, message: `L’email n’est pas parti : ${(error as { message?: string })?.message || 'erreur SMTP'}` })
  } finally {
    transport.close()
  }
  return { success: true }
}

// L'équipe n'écrit pas : la proposition disparaît, et la personne voit encore ce qui lui a été annoncé (R28)
export async function ignoreLineAnnouncement(registrationId: string, sessionId: string) {
  const { line } = await requireProposedLine(registrationId, sessionId)
  await prisma.registrationSession.updateMany({ where: { id: line.id, status: line.status }, data: { ignoredStatus: line.status } })
  return { success: true }
}

/**
 * Confirmation d'une place retenue (US-089, R18), même après l'échéance tant que la place n'est pas libérée :
 * la personne devient inscrite à cette session seulement, et participante de la session.
 */
export async function confirmRetainedPlace(registration: { id: string, participantId: string }, sessionId: string) {
  const key = { registrationId_sessionId: { registrationId: registration.id, sessionId } }
  const line = await prisma.registrationSession.findUnique({ where: key, select: { status: true, announcedStatus: true } })
  if (!line || !canConfirmPlace(line)) {
    throw createError({ statusCode: 409, message: 'Aucune place à confirmer pour cette session.' })
  }
  await confirmLine(registration, sessionId)
}

export async function confirmLine(registration: { id: string, participantId: string }, sessionId: string) {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.registrationSession.updateMany({
      where: { registrationId: registration.id, sessionId, status: LINE.retained },
      data: { status: LINE.confirmed, confirmedAt: now }
    })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
    }
    await joinSession(tx, registration, sessionId)
  })
}

// La personne entre dans la session (SPEC-001, R22) ; le personnage qui lui était réservé devient le sien (US-100, ADR-0051)
export async function joinSession(tx: PrismaTx, registration: { id: string, participantId: string }, sessionId: string) {
  const key = { sessionId, participantId: registration.participantId, role: SESSION_ROLES.participant }
  await tx.sessionParticipant.upsert({ where: { sessionId_participantId_role: key }, update: {}, create: key })
  await tx.sessionAssignment.updateMany({
    where: { sessionId, reservedRegistrationId: registration.id, participantId: null },
    data: { participantId: registration.participantId, reservedRegistrationId: null }
  })
}
