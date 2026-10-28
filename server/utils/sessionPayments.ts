import { prisma } from '~/server/utils/prisma'
import { openEmailTransport, sendEmail } from '~/server/utils/email'
import { CHARACTER_TYPES, SESSION_ROLES } from '~/utils/domain'
import { readUpload } from '~/server/utils/uploads'
import { isHttpUrl } from '~/utils/urls'

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

function paymentEmailText(params: {
  participantName: string
  sessionName: string
  gameTitle: string
  paymentLinkUrl?: string | null
  paymentRibUrl?: string | null
  ribAttached?: boolean
  reminder?: boolean
}) {
  const intro = params.reminder
    ? `Petit rappel pour le paiement de ta participation à ${params.sessionName}.`
    : `Tu peux maintenant régler ta participation à ${params.sessionName}.`

  return compactLines([
    `Bonjour ${firstName(params.participantName)},`,
    '',
    intro,
    `Jeu : ${params.gameTitle}`,
    params.paymentLinkUrl ? `Lien de paiement : ${params.paymentLinkUrl}` : null,
    params.paymentRibUrl ? `RIB : ${params.paymentRibUrl}` : null,
    params.ribAttached ? 'Le RIB est joint à cet email.' : null,
    '',
    'Merci !'
  ])
}

type PaymentParticipant = { id: string, name: string, email: string | null }
type PaymentRecord = { participantId: string, paidAt: Date | null, paymentEmailSentAt: Date | null, paymentReminderSentAt: Date | null }

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
      payments: { include: { participant: { select: participantSelect } } },
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

export async function getSessionPaymentDashboard(sessionId: string) {
  const session = await getPaymentSession(sessionId)
  const rows = buildPaymentRows(session.assignments, session.participants, session.payments)

  // Paiements reçus de personnes qui ne sont plus dans le tableau (désistement, retrait) : à rembourser ou
  // garder à la main ; ils restent visibles, hors du décompte et des envois
  const listed = new Set(rows.map((row) => row.participant.id))
  const unassignedPayments = session.payments
    .filter((payment) => payment.paidAt && !listed.has(payment.participantId))
    .map((payment) => ({ participant: payment.participant, paidAt: payment.paidAt }))

  return {
    session: {
      id: session.id,
      name: session.name,
      date: session.date,
      paymentRibUrl: session.paymentRibUrl,
      paymentLinkUrl: session.paymentLinkUrl,
      game: session.game
    },
    unassignedPayments,
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
}) {
  return await prisma.session.update({
    where: { id: sessionId },
    data: {
      paymentRibUrl: data.paymentRibUrl || null,
      paymentLinkUrl: data.paymentLinkUrl || null
    },
    select: {
      id: true,
      paymentRibUrl: true,
      paymentLinkUrl: true,
      updatedAt: true
    }
  })
}

export async function setSessionPaymentStatus(sessionId: string, participantId: string, paid: boolean) {
  const session = await getPaymentSession(sessionId)
  const isPlayer = buildPaymentRows(session.assignments, session.participants, session.payments)
    .some((row) => row.participant.id === participantId)

  if (!isPlayer) {
    throw createError({ statusCode: 400, message: 'Participant invalide pour le suivi de paiement' })
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
      paidAt: paid ? new Date() : null
    },
    update: {
      paidAt: paid ? new Date() : null
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
  const recipients = rows.filter((row) => !row.paidAt && row.participant.email)
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
            reminder: isReminder
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
      reminder
    }),
    attachments: rib ? [rib] : []
  })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  return { sentCount: emails.length }
}
