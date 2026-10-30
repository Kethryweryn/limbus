import { prisma } from '~/server/utils/prisma'
import { myParticipantIds } from '~/server/utils/participantAccounts'
import { myDeliveriesBySession } from '~/server/utils/myDocuments'
import { getSessionPaymentDashboard } from '~/server/utils/sessionPayments'
import { registrationPermissions } from '~/server/utils/publicRegistrations'
import { SESSION_ROLES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'

const sessionSelect = {
  id: true,
  name: true,
  date: true,
  status: true,
  gameId: true,
  paymentLinkUrl: true,
  paymentRibUrl: true,
  location: { select: { name: true, address: true } }
} as const

type MySession = {
  id: string
  name: string
  date: Date | null
  status: string
  gameId: string
  paymentLinkUrl: string | null
  paymentRibUrl: string | null
  location: { name: string, address: string | null } | null
}

/**
 * Paiement d'une de mes fiches pour une session (US-071) : sa ligne du tableau des paiements,
 * sans rien des autres personnes. null s'il n'y a ni montant dû ni versement.
 */
async function myPayment(session: MySession, participantIds: Set<string>) {
  const dashboard = await getSessionPaymentDashboard(session.id)
  const row = dashboard.rows.find((item) => participantIds.has(item.participant.id))
  const refund = dashboard.refunds.find((item) => participantIds.has(item.participant.id))
  const departed = dashboard.unassignedPayments.find((item) => participantIds.has(item.participant.id))
  if (!row && !refund && !departed) return null
  const dueCents = row?.dueCents ?? 0
  const receivedCents = row?.receivedCents ?? refund?.receivedCents ?? departed?.receivedCents ?? 0
  // Mode simple (sans tarif) : payé ou non ; montré si l'équipe a fixé un moyen de payer ou noté un paiement
  const simple = dashboard.mode === 'simple'
  const asksPayment = simple
    ? Boolean(row?.paidAt || session.paymentLinkUrl || session.paymentRibUrl)
    : Boolean(dueCents || receivedCents)
  if (!asksPayment && !row?.offered && !refund && !departed) return null
  return {
    mode: dashboard.mode,
    // paid, partial, unpaid, nothing_due ou offered (PAYMENT_STATES)
    state: row?.state ?? null,
    paidAt: row?.paidAt ?? null,
    dueCents,
    receivedCents,
    remainingCents: row?.remainingCents ?? 0,
    offered: Boolean(row?.offered),
    tariffName: (row && 'tariff' in row ? row.tariff?.name : null) ?? null,
    // Remboursement d'une session annulée ou reportée, ou d'une personne partie (US-023, US-039)
    refundStatus: refund?.refundStatus ?? departed?.refundStatus ?? null,
    paymentLinkUrl: session.paymentLinkUrl,
    hasRib: Boolean(session.paymentRibUrl)
  }
}

// Espace « Je participe » (US-071, ADR-0041) : tout part des fiches rattachées au compte
export async function myParticipations(userId: string, now = new Date()) {
  const ids = await myParticipantIds(userId)
  if (!ids.length) return []
  const inMine = { participantId: { in: ids } }

  const [links, roles, assignments, registrations, attendances, payments, deliveries, documents] = await Promise.all([
    prisma.participantGame.findMany({ where: inMine, select: { game: { select: { id: true, title: true, slug: true } } } }),
    prisma.sessionParticipant.findMany({ where: inMine, select: { role: true, session: { select: sessionSelect } } }),
    // Le casting compte comme un rôle de PJ, sans le personnage (choix du lot 4)
    prisma.sessionAssignment.findMany({ where: inMine, select: { session: { select: sessionSelect } } }),
    prisma.registration.findMany({
      where: inMine,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        responseDueAt: true,
        confirmedAt: true,
        session: { select: { name: true, date: true } },
        period: { select: { name: true, gameId: true, state: true, closesAt: true } }
      }
    }),
    prisma.sessionAttendance.findMany({ where: inMine, select: { sessionId: true, status: true, responseDueAt: true } }),
    prisma.sessionPayment.findMany({ where: inMine, select: { session: { select: sessionSelect } } }),
    // Une session d'où la personne est partie garde ce qu'elle y a reçu (US-079)
    prisma.sessionDocumentDelivery.findMany({ where: inMine, distinct: ['sessionId'], select: { session: { select: sessionSelect } } }),
    myDeliveriesBySession(ids)
  ])

  const sessions = new Map<string, MySession & { roles: Set<string> }>()
  const addSession = (session: MySession, role?: string) => {
    const entry = sessions.get(session.id) ?? { ...session, roles: new Set<string>() }
    if (role) entry.roles.add(role)
    sessions.set(session.id, entry)
  }
  for (const item of roles) addSession(item.session, item.role)
  for (const item of assignments) addSession(item.session, SESSION_ROLES.participant)
  for (const item of payments) addSession(item.session)
  for (const item of deliveries) addSession(item.session)
  const attendanceBySession = new Map(attendances.map((item) => [item.sessionId, item]))
  const participantIds = new Set(ids)

  const sessionViews = await Promise.all([...sessions.values()].map(async (session) => ({
    id: session.id,
    gameId: session.gameId,
    name: session.name,
    date: session.date,
    status: session.status,
    location: session.location,
    roles: [...session.roles],
    attendance: attendanceBySession.get(session.id) ?? null,
    payment: await myPayment(session, participantIds),
    documents: documents.get(session.id) ?? []
  })))

  const games = new Map<string, { id: string, title: string, slug: string }>()
  for (const link of links) games.set(link.game.id, link.game)

  return [...games.values()]
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'))
    .map((game) => ({
      game: { id: game.id, title: game.title },
      sessions: sessionViews
        .filter((session) => session.gameId === game.id)
        .sort((left, right) => (left.date?.getTime() ?? Infinity) - (right.date?.getTime() ?? Infinity)),
      registrations: registrations
        .filter((registration) => registration.period.gameId === game.id)
        .map((registration) => ({
          id: registration.id,
          status: registration.status,
          periodName: registration.period.name,
          periodState: effectivePeriodState(registration.period, now),
          session: registration.session,
          responseDueAt: registration.responseDueAt,
          confirmedAt: registration.confirmedAt,
          ...registrationPermissions(registration, now)
        }))
    }))
}

// RIB d'une session, seulement si l'une de mes fiches y a un paiement (US-071)
export async function requireMySessionRib(userId: string, sessionId: string) {
  const ids = await myParticipantIds(userId)
  const session = ids.length
    ? await prisma.session.findUnique({ where: { id: sessionId }, select: sessionSelect })
    : null
  if (!session?.paymentRibUrl || !await myPayment(session, new Set(ids))) {
    throw createError({ statusCode: 404, message: 'RIB introuvable' })
  }
  return session.paymentRibUrl
}
