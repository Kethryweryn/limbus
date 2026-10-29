import { prisma } from '~/server/utils/prisma'
import { openEmailTransport, sendEmail } from '~/server/utils/email'
import { CHARACTER_TYPES, REFUND_STATUSES, SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'
import { readUpload } from '~/server/utils/uploads'
import { isHttpUrl } from '~/utils/urls'
import { PAYMENT_STATES, TARIFF_ROLES, TARIFF_ROLE_ORDER, eurosToCents, paymentAmountLines, type PaymentAmounts, paymentState, solidarityBalance, suggestedDepartureStatus, tariffForPerson, withdrawalDeadlineLine } from '~/utils/sessionTariffs'

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line) => typeof line === 'string' && line.trim()).join('\n')
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

// Le RIB téléversé est joint à l'email : les participants n'ont pas de compte pour l'ouvrir dans Limbus
async function ribAttachment(paymentRibUrl: string | null) {
  const content = await readUpload(paymentRibUrl).catch(() => null)
  if (!content) return null
  return { filename: 'RIB.pdf', content, contentType: 'application/pdf' }
}

function externalRibUrl(paymentRibUrl: string | null) {
  return paymentRibUrl && isHttpUrl(paymentRibUrl) ? paymentRibUrl : null
}

function isPlayableCharacterType(type: string) {
  return type === CHARACTER_TYPES.pj || type === CHARACTER_TYPES.pnj
}

const rowAmounts = (row: { tariff: { name: string } | null, dueCents: number, receivedCents: number, remainingCents: number }) =>
  row.tariff ? { tariffName: row.tariff.name, dueCents: row.dueCents, receivedCents: row.receivedCents, remainingCents: row.remainingCents } : null

// Doit encore quelque chose : reste dû en mode tarifs (paiement partiel compris), case non cochée en mode simple
const owesPayment = (mode: string, row: { paidAt: Date | null, remainingCents: number, state: string }) =>
  row.state !== PAYMENT_STATES.offered && (mode === 'tariffs' ? row.remainingCents > 0 && row.state !== PAYMENT_STATES.paid : !row.paidAt)

function paymentEmailText(params: {
  participantName: string
  sessionName: string
  gameTitle: string
  paymentLinkUrl?: string | null
  paymentRibUrl?: string | null
  ribAttached?: boolean
  reminder?: boolean
  amounts?: PaymentAmounts | null
  withdrawalDeadline?: Date | null
}) {
  const intro = params.reminder
    ? `Petit rappel pour le paiement de ta participation à ${params.sessionName}.`
    : `Tu peux maintenant régler ta participation à ${params.sessionName}.`

  return compactLines([
    `Bonjour ${firstName(params.participantName)},`,
    '',
    intro,
    `Jeu : ${params.gameTitle}`,
    ...paymentAmountLines(params.amounts),
    params.paymentLinkUrl ? `Lien de paiement : ${params.paymentLinkUrl}` : null,
    params.paymentRibUrl ? `RIB : ${params.paymentRibUrl}` : null,
    params.ribAttached ? 'Le RIB est joint à cet email.' : null,
    withdrawalDeadlineLine(params.withdrawalDeadline),
    '',
    'Merci !'
  ])
}

type PaymentParticipant = { id: string, name: string, email: string | null }
type PaymentRecord = { participantId: string, paidAt: Date | null, paymentEmailSentAt: Date | null, paymentReminderSentAt: Date | null, updatedAt?: Date }

/**
 * Lignes du tableau des paiements (R22, US-007) : une par personne, qu'elle joue un personnage
 * PJ ou PNJ de la session, ou qu'elle y ait sans personnage le rôle « participant » (inscrit
 * confirmé avant le casting : « personnage à attribuer ») ou le rôle PNJ. Cuisine et orgas sans
 * personnage n'y sont pas. Les personnes avec personnage d'abord, par nom de personnage.
 */
export function buildPaymentRows<P extends PaymentParticipant, C extends { name: string, type: string }>(
  assignments: Array<{ participantId: string | null, participant: P | null, character: C }>,
  sessionParticipants: Array<{ role: string, participant: P }>,
  payments: PaymentRecord[]
) {
  const paymentsByParticipantId = new Map(payments.map((payment) => [payment.participantId, payment]))
  const byParticipant = new Map<string, { participant: P, characters: C[], awaitingCharacter: boolean, npcRole: boolean }>()

  // Une personne qui a déjà un personnage, même non jouable, n'attend pas d'attribution
  const withCharacter = new Set(assignments.map((assignment) => assignment.participantId).filter(Boolean))
  const playable = assignments
    .filter((assignment) => assignment.participant && assignment.participantId && isPlayableCharacterType(assignment.character.type))
    .sort((left, right) => left.character.name.localeCompare(right.character.name, 'fr'))
  for (const assignment of playable) {
    const entry = byParticipant.get(assignment.participantId!)
    if (entry) entry.characters.push(assignment.character)
    else byParticipant.set(assignment.participantId!, { participant: assignment.participant!, characters: [assignment.character], awaitingCharacter: false, npcRole: false })
  }

  // Un inscrit confirmé attend un personnage ; un PNJ du cast est suivi sans cette mention
  const tracked = [SESSION_ROLES.participant, SESSION_ROLES.npc] as string[]
  const withoutCharacter = sessionParticipants
    .filter((sessionParticipant) => tracked.includes(sessionParticipant.role) && !byParticipant.has(sessionParticipant.participant.id))
    .sort((left, right) => left.participant.name.localeCompare(right.participant.name, 'fr'))
  for (const sessionParticipant of withoutCharacter) {
    const awaitingCharacter = !withCharacter.has(sessionParticipant.participant.id)
      && sessionParticipants.some((other) => other.participant.id === sessionParticipant.participant.id && other.role === SESSION_ROLES.participant)
    const npcRole = sessionParticipants.some((other) => other.participant.id === sessionParticipant.participant.id && other.role === SESSION_ROLES.npc)
    byParticipant.set(sessionParticipant.participant.id, { participant: sessionParticipant.participant, characters: [], awaitingCharacter, npcRole })
  }

  return [...byParticipant.values()].map(({ participant, characters, awaitingCharacter, npcRole }) => {
    const payment = paymentsByParticipantId.get(participant.id)
    return {
      participant,
      // Premier personnage, pour l'affichage existant ; null sans personnage
      character: characters[0] ?? null,
      characters,
      awaitingCharacter,
      // PNJ du cast sans personnage attribué (choix du 2026-10-28)
      npcRole,
      paidAt: payment?.paidAt || null,
      paymentEmailSentAt: payment?.paymentEmailSentAt || null,
      paymentReminderSentAt: payment?.paymentReminderSentAt || null
    }
  })
}

const participantSelect = { id: true, name: true, email: true } as const

export const REFUNDABLE_SESSION_STATUSES: string[] = [SESSION_STATUSES.cancelled, SESSION_STATUSES.postponed]

/**
 * Remboursement d'un paiement d'une session annulée ou reportée (US-023, ADR-0029). « Reporté » marque la
 * personne comme ayant payé sur la nouvelle session, à la date d'origine, si elle est dans son tableau.
 * Revenir sur un report ne retire pas le paiement de la nouvelle session : on le corrige depuis celle-ci.
 */
export async function setSessionPaymentRefund(sessionId: string, participantId: string, status: string | null) {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true, postponedToSessionId: true } })
  if (!REFUNDABLE_SESSION_STATUSES.includes(session.status)) {
    throw createError({ statusCode: 409, message: 'Le remboursement ne se suit que pour une session annulée ou reportée.' })
  }
  const payment = await prisma.sessionPayment.findUnique({
    where: { sessionId_participantId: { sessionId, participantId } },
    include: { instalments: { orderBy: { receivedAt: 'asc' } } }
  })
  if (!payment || !hasPaidSomething(payment)) {
    throw createError({ statusCode: 400, message: 'Cette personne n’a pas payé cette session.' })
  }

  if (status === REFUND_STATUSES.carriedOver) {
    const targetId = session.postponedToSessionId
    if (!targetId) {
      throw createError({ statusCode: 400, message: 'Cette session n’a pas été reportée : le paiement ne peut pas passer sur une autre session.' })
    }
    const target = await getPaymentSession(targetId)
    const inTarget = paymentRowsOf(target).some((row) => row.participant.id === participantId)
    if (!inTarget) {
      throw createError({ statusCode: 400, message: 'Cette personne ne fait pas partie du tableau des paiements de la nouvelle session.' })
    }
    return await prisma.$transaction(async (tx) => {
      // Un paiement déjà reçu sur la nouvelle session garde sa date
      const existing = await tx.sessionPayment.findUnique({
        where: { sessionId_participantId: { sessionId: targetId, participantId } },
        include: { instalments: true }
      })
      if (!existing || !hasPaidSomething(existing)) {
        // Le paiement reporté garde sa date ; ses versements passent en un seul, du total reçu (ADR-0032)
        const carried = await tx.sessionPayment.upsert({
          where: { sessionId_participantId: { sessionId: targetId, participantId } },
          // La date du premier versement tient lieu de date de paiement si la nouvelle session est en mode simple
          create: { sessionId: targetId, participantId, paidAt: payment.paidAt || payment.instalments[0]?.receivedAt || null },
          update: { paidAt: payment.paidAt || payment.instalments[0]?.receivedAt || null }
        })
        const total = receivedCents(payment)
        if (total) {
          await tx.sessionPaymentInstalment.create({
            data: { paymentId: carried.id, amountCents: total, receivedAt: payment.instalments[0]!.receivedAt }
          })
        }
      }
      return await tx.sessionPayment.update({
        where: { id: payment.id },
        data: { refundStatus: status, refundedAt: null, carriedOverToSessionId: targetId }
      })
    })
  }

  return await prisma.sessionPayment.update({
    where: { id: payment.id },
    data: {
      refundStatus: status,
      refundedAt: status === REFUND_STATUSES.refunded ? new Date() : null,
      carriedOverToSessionId: null
    }
  })
}

async function getPaymentSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    // Nom et email suffisent au tableau : ni notes ni téléphone des personnes
    include: {
      game: { select: { id: true, title: true } },
      assignments: {
        include: {
          character: { select: { id: true, name: true, type: true } },
          participant: { select: participantSelect }
        }
      },
      payments: {
        include: {
          participant: { select: participantSelect },
          transferredTo: { select: { id: true, name: true } },
          instalments: { orderBy: { receivedAt: 'asc' } }
        }
      },
      tariffs: { orderBy: { createdAt: 'asc' } },
      participants: {
        include: {
          participant: { select: participantSelect }
        }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }

  return session
}

type TariffRecord = { id: string, name: string, amountCents: number, defaultRole: string | null, baseTariffId: string | null }
type TariffPaymentRecord = PaymentRecord & {
  tariffId: string | null
  offered: boolean
  instalments: Array<{ id: string, amountCents: number, receivedAt: Date }>
}

// A payé quelque chose : case cochée en mode simple, ou au moins un versement (ADR-0032)
export function hasPaidSomething(payment: { paidAt: Date | null, instalments?: Array<unknown> } | null | undefined) {
  return Boolean(payment?.paidAt || payment?.instalments?.length)
}

const receivedCents = (payment: { instalments?: Array<{ amountCents: number }> } | null | undefined) =>
  (payment?.instalments || []).reduce((total, instalment) => total + instalment.amountCents, 0)

/**
 * Tableau en mode tarifs (US-031, ADR-0032) : toute l'équipe de la session, orgas et cuisine compris, avec son
 * tarif (choisi, ou celui de son rôle), le dû, le reçu, le reste et l'état calculé.
 */
export function buildTariffPaymentRows<P extends PaymentParticipant, C extends { name: string, type: string }>(
  assignments: Array<{ participantId: string | null, participant: P | null, character: C }>,
  sessionParticipants: Array<{ role: string, participant: P }>,
  payments: TariffPaymentRecord[],
  tariffs: TariffRecord[]
) {
  const baseRows = buildPaymentRows(assignments, sessionParticipants, payments)
  const listed = new Set(baseRows.map((row) => row.participant.id))
  const staff = new Map<string, P>()
  for (const sessionParticipant of sessionParticipants) {
    if (sessionParticipant.role !== SESSION_ROLES.organizer && sessionParticipant.role !== SESSION_ROLES.kitchen) continue
    if (!listed.has(sessionParticipant.participant.id)) staff.set(sessionParticipant.participant.id, sessionParticipant.participant)
  }
  const staffRows = [...staff.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'))
    .map((participant) => ({
      participant,
      character: null,
      characters: [] as C[],
      awaitingCharacter: false,
      npcRole: false,
      paidAt: null as Date | null,
      paymentEmailSentAt: null as Date | null,
      paymentReminderSentAt: null as Date | null
    }))
  const paymentsByParticipantId = new Map(payments.map((payment) => [payment.participantId, payment]))

  return [...baseRows, ...staffRows].map((row) => {
    const payment = paymentsByParticipantId.get(row.participant.id)
    const roles = tariffRolesOf(row.participant.id, assignments, sessionParticipants)
    const { tariff, chosen } = tariffForPerson(roles, tariffs, payment?.tariffId)
    // Place offerte : rien à payer, quel que soit le tarif (US-041)
    const offered = Boolean(payment?.offered)
    const dueCents = offered ? 0 : tariff?.amountCents ?? 0
    const received = receivedCents(payment)
    return {
      ...row,
      paidAt: payment?.paidAt || null,
      paymentEmailSentAt: payment?.paymentEmailSentAt || null,
      paymentReminderSentAt: payment?.paymentReminderSentAt || null,
      // Version de la ligne, renvoyée à chaque modification (ADR-0036) ; null tant qu'elle n'existe pas
      paymentUpdatedAt: payment?.updatedAt || null,
      roles,
      tariff,
      tariffChosen: chosen,
      dueCents,
      receivedCents: received,
      remainingCents: Math.max(dueCents - received, 0),
      instalments: payment?.instalments || [],
      offered,
      state: paymentState({ dueCents, receivedCents: received, legacyPaid: Boolean(payment?.paidAt), offered })
    }
  })
}

// Rôles de tarif d'une personne : PJ ou PNJ selon les personnages qu'elle joue, inscrite sans personnage = PJ
function tariffRolesOf(
  participantId: string,
  assignments: Array<{ participantId: string | null, character: { type: string } }>,
  sessionParticipants: Array<{ role: string, participant: { id: string } }>
) {
  const roles = new Set<string>()
  const playable = assignments.filter((assignment) => assignment.participantId === participantId && isPlayableCharacterType(assignment.character.type))
  for (const assignment of playable) {
    roles.add(assignment.character.type === CHARACTER_TYPES.pj ? TARIFF_ROLES.pj : TARIFF_ROLES.pnj)
  }
  for (const sessionParticipant of sessionParticipants) {
    if (sessionParticipant.participant.id !== participantId) continue
    if (sessionParticipant.role === SESSION_ROLES.participant && !playable.length) roles.add(TARIFF_ROLES.pj)
    if (sessionParticipant.role === SESSION_ROLES.npc) roles.add(TARIFF_ROLES.pnj)
    if (sessionParticipant.role === SESSION_ROLES.organizer) roles.add(TARIFF_ROLES.organizer)
    if (sessionParticipant.role === SESSION_ROLES.kitchen) roles.add(TARIFF_ROLES.kitchen)
  }
  return TARIFF_ROLE_ORDER.filter((role) => roles.has(role))
}

type PaymentSession = Awaited<ReturnType<typeof getPaymentSession>>

// Lignes du tableau selon le mode : simple sans tarif, tarifs dès qu'il y en a un (ADR-0032)
function paymentRowsOf(session: PaymentSession) {
  if (!session.tariffs.length) {
    const offeredIds = new Set(session.payments.filter((payment) => payment.offered).map((payment) => payment.participantId))
    return buildPaymentRows(session.assignments, session.participants, session.payments).map((row) => ({
      ...row,
      offered: offeredIds.has(row.participant.id),
      roles: [] as string[],
      tariff: null as TariffRecord | null,
      tariffChosen: false,
      dueCents: 0,
      receivedCents: 0,
      remainingCents: 0,
      instalments: [] as Array<{ id: string, amountCents: number, receivedAt: Date }>,
      state: offeredIds.has(row.participant.id) ? PAYMENT_STATES.offered : row.paidAt ? PAYMENT_STATES.paid : PAYMENT_STATES.unpaid
    }))
  }
  return buildTariffPaymentRows(session.assignments, session.participants, session.payments, session.tariffs)
}

async function assertInPaymentTable(sessionId: string, participantId: string) {
  const session = await getPaymentSession(sessionId)
  if (!paymentRowsOf(session).some((row) => row.participant.id === participantId)) {
    throw createError({ statusCode: 400, message: 'Participant invalide pour le suivi de paiement' })
  }
  return session
}

async function assertTariffMode(sessionId: string) {
  const count = await prisma.sessionTariff.count({ where: { sessionId } })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Créez d’abord un tarif pour cette session.' })
  }
}

// Un tarif de base est un tarif de la session, sans tarif de base lui-même : pas de chaîne (US-033)
async function assertBaseTariff(sessionId: string, baseTariffId: string | null | undefined, tariffId?: string) {
  if (!baseTariffId) return
  if (baseTariffId === tariffId) {
    throw createError({ statusCode: 400, message: 'Un tarif ne peut pas être sa propre base.' })
  }
  const base = await prisma.sessionTariff.findFirst({ where: { id: baseTariffId, sessionId }, select: { baseTariffId: true } })
  if (!base) {
    throw createError({ statusCode: 400, message: 'Tarif de base invalide pour cette session.' })
  }
  if (base.baseTariffId || (tariffId && await prisma.sessionTariff.count({ where: { baseTariffId: tariffId } }))) {
    throw createError({ statusCode: 400, message: 'Un tarif solidaire ne peut pas servir de base, ni en avoir une s’il en sert.' })
  }
}

function isUniqueRoleConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

type TariffInput = { name: string, amount: number, defaultRole?: string | null, baseTariffId?: string | null }

export async function createSessionTariff(sessionId: string, input: TariffInput) {
  await assertBaseTariff(sessionId, input.baseTariffId)
  try {
    return await prisma.sessionTariff.create({
      data: {
        sessionId,
        name: input.name,
        amountCents: eurosToCents(input.amount),
        defaultRole: input.defaultRole || null,
        baseTariffId: input.baseTariffId || null
      }
    })
  } catch (error) {
    if (isUniqueRoleConflict(error)) {
      throw createError({ statusCode: 409, message: 'Un autre tarif s’applique déjà à ce rôle.' })
    }
    throw error
  }
}

export async function updateSessionTariff(sessionId: string, tariffId: string, input: TariffInput) {
  const existing = await prisma.sessionTariff.findFirst({ where: { id: tariffId, sessionId }, select: { id: true } })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Tarif introuvable' })
  }
  await assertBaseTariff(sessionId, input.baseTariffId, tariffId)
  try {
    return await prisma.sessionTariff.update({
      where: { id: tariffId },
      data: {
        name: input.name,
        amountCents: eurosToCents(input.amount),
        defaultRole: input.defaultRole || null,
        baseTariffId: input.baseTariffId || null
      }
    })
  } catch (error) {
    if (isUniqueRoleConflict(error)) {
      throw createError({ statusCode: 409, message: 'Un autre tarif s’applique déjà à ce rôle.' })
    }
    throw error
  }
}

// Supprimer un tarif remet ses personnes au tarif de leur rôle et retire le lien des tarifs solidaires (SetNull)
export async function deleteSessionTariff(sessionId: string, tariffId: string) {
  const { count } = await prisma.sessionTariff.deleteMany({ where: { id: tariffId, sessionId } })
  if (!count) {
    throw createError({ statusCode: 404, message: 'Tarif introuvable' })
  }
  return { success: true }
}

export async function setSessionPaymentTariff(sessionId: string, participantId: string, tariffId: string | null) {
  await assertTariffMode(sessionId)
  await assertInPaymentTable(sessionId, participantId)
  if (tariffId && !await prisma.sessionTariff.count({ where: { id: tariffId, sessionId } })) {
    throw createError({ statusCode: 400, message: 'Tarif invalide pour cette session.' })
  }
  return await prisma.sessionPayment.upsert({
    where: { sessionId_participantId: { sessionId, participantId } },
    create: { sessionId, participantId, tariffId },
    update: { tariffId }
  })
}

export async function addSessionPaymentInstalment(sessionId: string, participantId: string, input: { amount: number, receivedAt?: Date | null }) {
  await assertTariffMode(sessionId)
  await assertInPaymentTable(sessionId, participantId)
  const payment = await prisma.sessionPayment.upsert({
    where: { sessionId_participantId: { sessionId, participantId } },
    create: { sessionId, participantId },
    update: {}
  })
  return await prisma.sessionPaymentInstalment.create({
    data: { paymentId: payment.id, amountCents: eurosToCents(input.amount), receivedAt: input.receivedAt || new Date() }
  })
}

export async function deleteSessionPaymentInstalment(sessionId: string, participantId: string, instalmentId: string) {
  const { count } = await prisma.sessionPaymentInstalment.deleteMany({
    where: { id: instalmentId, payment: { sessionId, participantId } }
  })
  if (!count) {
    throw createError({ statusCode: 404, message: 'Versement introuvable' })
  }
  return { success: true }
}

export async function getSessionPaymentDashboard(sessionId: string) {
  const session = await getPaymentSession(sessionId)
  const rows = paymentRowsOf(session)

  // Paiements reçus de personnes qui ne sont plus dans le tableau (désistement, retrait) : à rembourser ou
  // garder à la main ; ils restent visibles, hors du décompte et des envois
  const listed = new Set(rows.map((row) => row.participant.id))
  const suggestion = suggestedDepartureStatus(session.withdrawalDeadline)
  const unassignedPayments = session.payments
    .filter((payment) => hasPaidSomething(payment) && !listed.has(payment.participantId))
    .map((payment) => ({
      participant: payment.participant,
      paidAt: payment.paidAt || payment.instalments[0]?.receivedAt || null,
      receivedCents: receivedCents(payment),
      // Décision sur le paiement d'une personne partie (US-039, ADR-0033) ; sans décision, la proposition (US-040)
      refundStatus: payment.refundStatus,
      refundedAt: payment.refundedAt,
      transferredTo: payment.transferredTo,
      paymentUpdatedAt: payment.updatedAt,
      suggestedStatus: payment.refundStatus ? null : suggestion
    }))

  // Session annulée ou reportée : chaque paiement reçu se rembourse ou passe sur la nouvelle session (US-023)
  const refunds = REFUNDABLE_SESSION_STATUSES.includes(session.status)
    ? session.payments
      .filter((payment) => hasPaidSomething(payment))
      .map((payment) => ({
        participant: payment.participant,
        paidAt: payment.paidAt || payment.instalments[0]?.receivedAt || null,
        receivedCents: receivedCents(payment),
        refundStatus: payment.refundStatus,
        refundedAt: payment.refundedAt,
        paymentUpdatedAt: payment.updatedAt
      }))
      .sort((left, right) => left.participant.name.localeCompare(right.participant.name, 'fr'))
    : []

  return {
    session: {
      id: session.id,
      name: session.name,
      date: session.date,
      status: session.status,
      postponedToSessionId: session.postponedToSessionId,
      paymentRibUrl: session.paymentRibUrl,
      paymentLinkUrl: session.paymentLinkUrl,
      withdrawalDeadline: session.withdrawalDeadline,
      paymentSettingsUpdatedAt: session.paymentSettingsUpdatedAt,
      game: session.game
    },
    // Mode simple sans tarif, mode tarifs dès qu'il y en a un (ADR-0032)
    mode: session.tariffs.length ? 'tariffs' : 'simple',
    tariffs: session.tariffs,
    totals: {
      dueCents: rows.reduce((total, row) => total + row.dueCents, 0),
      receivedCents: rows.reduce((total, row) => total + row.receivedCents, 0),
      remainingCents: rows.reduce((total, row) => total + row.remainingCents, 0)
    },
    solidarity: solidarityBalance(rows.filter((row) => !row.offered), session.tariffs),
    unassignedPayments,
    refunds,
    sessionRoleRecipients: session.participants.map((sessionParticipant) => ({
      role: sessionParticipant.role,
      participant: sessionParticipant.participant
    })),
    rows
  }
}

export async function updateSessionPaymentSettings(sessionId: string, data: {
  paymentRibUrl?: string | null
  paymentLinkUrl?: string | null
  withdrawalDeadline?: Date | null
}) {
  // Les paiements ne font pas partie de la version de la session (ADR-0028) : updatedAt est gardé,
  // sinon le casting enregistré ensuite depuis la même page serait refusé comme un conflit
  const { updatedAt } = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { updatedAt: true } })
  return await prisma.session.update({
    where: { id: sessionId },
    // Un champ absent est conservé : modifier le lien de paiement ne retire pas le RIB
    data: {
      ...(data.paymentRibUrl !== undefined && { paymentRibUrl: data.paymentRibUrl || null }),
      ...(data.paymentLinkUrl !== undefined && { paymentLinkUrl: data.paymentLinkUrl || null }),
      ...(data.withdrawalDeadline !== undefined && { withdrawalDeadline: data.withdrawalDeadline }),
      // Version des réglages (ADR-0036)
      paymentSettingsUpdatedAt: new Date(),
      updatedAt
    },
    select: {
      id: true,
      paymentRibUrl: true,
      paymentLinkUrl: true,
      withdrawalDeadline: true,
      paymentSettingsUpdatedAt: true,
      updatedAt: true
    }
  })
}

export async function setSessionPaymentStatus(sessionId: string, participantId: string, paid: boolean, paidAt?: Date) {
  const session = await assertInPaymentTable(sessionId, participantId)
  // En mode tarifs, l'état se calcule à partir des versements (ADR-0032) : on peut seulement retirer une
  // validation faite en mode simple
  if (session.tariffs.length && paid) {
    throw createError({ statusCode: 409, message: 'Cette session a des tarifs : notez un versement plutôt que de cocher « payé ».' })
  }

  return await prisma.sessionPayment.upsert({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId
      }
    },
    create: {
      sessionId,
      participantId,
      paidAt: paid ? paidAt || new Date() : null
    },
    update: {
      paidAt: paid ? paidAt || new Date() : null
    }
  })
}

/**
 * Envoie les emails de paiement (ou de relance) aux personnes du tableau qui n'ont pas payé, sur une seule
 * connexion SMTP. Un échec n'arrête pas les envois suivants : il est rendu dans `failures`.
 */
export async function sendSessionPaymentEmails(sessionId: string, reminder = false, participantId?: string | null) {
  const dashboard = await getSessionPaymentDashboard(sessionId)
  const rib = await ribAttachment(dashboard.session.paymentRibUrl)
  const now = new Date()
  let sentCount = 0
  const failures: string[] = []

  const rows = participantId
    ? dashboard.rows.filter((row) => row.participant.id === participantId)
    : dashboard.rows
  const recipients = rows.filter((row) => owesPayment(dashboard.mode, row) && row.participant.email)
  const skippedCount = rows.length - recipients.length
  if (!recipients.length) return { sentCount, skippedCount, failures }

  const transport = await openEmailTransport().catch(() => null)
  if (!transport) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé ou mal configuré' })
  }

  try {
    for (const row of recipients) {
      const isReminder = reminder || Boolean(row.paymentEmailSentAt)
      try {
        await transport.send({
          to: row.participant.email!,
          subject: `${isReminder ? 'Relance paiement' : 'Paiement'} - ${dashboard.session.name}`,
          text: paymentEmailText({
            participantName: row.participant.name,
            sessionName: dashboard.session.name,
            gameTitle: dashboard.session.game.title,
            paymentLinkUrl: dashboard.session.paymentLinkUrl,
            paymentRibUrl: externalRibUrl(dashboard.session.paymentRibUrl),
            ribAttached: Boolean(rib),
            reminder: isReminder,
            amounts: rowAmounts(row),
            withdrawalDeadline: dashboard.session.withdrawalDeadline
          }),
          attachments: rib ? [rib] : []
        })
      } catch {
        failures.push(row.participant.name)
        continue
      }

      await prisma.sessionPayment.upsert({
        where: {
          sessionId_participantId: {
            sessionId,
            participantId: row.participant.id
          }
        },
        create: {
          sessionId,
          participantId: row.participant.id,
          paymentEmailSentAt: isReminder ? row.paymentEmailSentAt || now : now,
          paymentReminderSentAt: isReminder ? now : null
        },
        update: isReminder
          ? { paymentReminderSentAt: now }
          : { paymentEmailSentAt: now }
      })
      sentCount++
    }
  } finally {
    transport.close()
  }

  if (!sentCount && failures.length) {
    throw createError({ statusCode: 502, message: `Aucun email de paiement n’est parti (${failures.join(', ')}).` })
  }
  return { sentCount, skippedCount, failures }
}

export async function sendSessionPaymentTestEmails(sessionId: string, emails: string[], participantId?: string | null) {
  const dashboard = await getSessionPaymentDashboard(sessionId)
  const rib = await ribAttachment(dashboard.session.paymentRibUrl)
  const sample = participantId ? dashboard.rows.find((row) => row.participant.id === participantId) : dashboard.rows[0]
  if (participantId && !sample) {
    throw createError({ statusCode: 400, message: 'Cette personne ne fait plus partie du tableau des paiements : rechargez la page.' })
  }
  const reminder = Boolean(sample?.paymentEmailSentAt)

  const result = await sendEmail({
    to: emails,
    subject: `[Test] ${reminder ? 'Relance paiement' : 'Paiement'} - ${dashboard.session.name}`,
    text: paymentEmailText({
      participantName: sample?.participant.name || 'Prénom',
      sessionName: dashboard.session.name,
      gameTitle: dashboard.session.game.title,
      paymentLinkUrl: dashboard.session.paymentLinkUrl,
      paymentRibUrl: externalRibUrl(dashboard.session.paymentRibUrl),
      ribAttached: Boolean(rib),
      reminder,
      amounts: sample ? rowAmounts(sample) : null,
      withdrawalDeadline: dashboard.session.withdrawalDeadline
    }),
    attachments: rib ? [rib] : []
  })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  return { sentCount: emails.length }
}

// Place offerte (US-041) : rien à payer, sans créer de tarif
export async function setSessionPaymentOffered(sessionId: string, participantId: string, offered: boolean) {
  await assertInPaymentTable(sessionId, participantId)
  return await prisma.sessionPayment.upsert({
    where: { sessionId_participantId: { sessionId, participantId } },
    create: { sessionId, participantId, offered },
    update: { offered }
  })
}

const DEPARTURE_STATUSES: string[] = [REFUND_STATUSES.toRefund, REFUND_STATUSES.refunded, REFUND_STATUSES.kept, REFUND_STATUSES.transferred]

/**
 * Décision sur le paiement d'une personne partie (US-039, ADR-0033). « Transféré » compte le montant reçu
 * comme payé par le remplaçant : un versement en mode tarifs, la case « payé » en mode simple. Revenir sur
 * un transfert ne retire rien chez le remplaçant : on le corrige depuis sa ligne.
 */
export async function setDepartedPaymentStatus(sessionId: string, participantId: string, status: string | null, transferToParticipantId?: string | null) {
  if (status && !DEPARTURE_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, message: 'Décision invalide' })
  }
  const session = await getPaymentSession(sessionId)
  const rows = paymentRowsOf(session)
  const payment = session.payments.find((item) => item.participantId === participantId)
  if (!payment || !hasPaidSomething(payment) || rows.some((row) => row.participant.id === participantId)) {
    throw createError({ statusCode: 400, message: 'Cette personne n’a pas de paiement à traiter : elle est encore dans le tableau, ou n’a rien payé.' })
  }

  // Le remplaçant déjà crédité reste noté : revenir sur un transfert ne retire rien chez lui (ADR-0033)
  if (status !== REFUND_STATUSES.transferred) {
    return await prisma.sessionPayment.update({
      where: { id: payment.id },
      data: {
        refundStatus: status,
        refundedAt: status === REFUND_STATUSES.refunded ? new Date() : null
      }
    })
  }

  if (!transferToParticipantId || !rows.some((row) => row.participant.id === transferToParticipantId)) {
    throw createError({ statusCode: 400, message: 'Choisissez une personne du tableau des paiements pour reprendre ce paiement.' })
  }
  // Un paiement ne se transfère qu'une fois : sinon le remplaçant serait crédité deux fois
  if (payment.transferredToParticipantId) {
    if (payment.transferredToParticipantId !== transferToParticipantId) {
      throw createError({ statusCode: 409, message: 'Ce paiement a déjà été transféré à une autre personne : corrigez d’abord sa ligne.' })
    }
    return await prisma.sessionPayment.update({ where: { id: payment.id }, data: { refundStatus: status, refundedAt: null } })
  }
  const paidAt = payment.paidAt || payment.instalments[0]?.receivedAt || new Date()
  const total = receivedCents(payment)
  return await prisma.$transaction(async (tx) => {
    const target = await tx.sessionPayment.upsert({
      where: { sessionId_participantId: { sessionId, participantId: transferToParticipantId } },
      create: { sessionId, participantId: transferToParticipantId, paidAt: session.tariffs.length ? null : paidAt },
      update: session.tariffs.length ? {} : { paidAt }
    })
    if (session.tariffs.length && total) {
      await tx.sessionPaymentInstalment.create({ data: { paymentId: target.id, amountCents: total, receivedAt: paidAt } })
    }
    return await tx.sessionPayment.update({
      where: { id: payment.id },
      data: { refundStatus: status, refundedAt: null, transferredToParticipantId: transferToParticipantId }
    })
  })
}

