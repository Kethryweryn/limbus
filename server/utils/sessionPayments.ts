import { prisma } from '~/server/utils/prisma'
import { sendEmail } from '~/server/utils/email'
import { CHARACTER_TYPES } from '~/utils/domain'

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line) => typeof line === 'string' && line.trim()).join('\n')
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function absoluteUrl(baseUrl: string, value?: string | null) {
  if (!value) return value
  if (/^https?:\/\//i.test(value)) return value
  if (!baseUrl) return value
  return `${baseUrl}${value}`
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
    '',
    'Merci !'
  ])
}

async function getPaymentSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      game: true,
      assignments: {
        include: {
          character: true,
          participant: true
        }
      },
      payments: true
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }

  return session
}

export async function getSessionPaymentDashboard(sessionId: string) {
  const session = await getPaymentSession(sessionId)
  const paymentsByParticipantId = new Map(session.payments.map((payment) => [payment.participantId, payment]))

  const rows = session.assignments
    .filter((assignment) =>
      assignment.participant
      && assignment.participantId
      && isPlayableCharacterType(assignment.character.type)
    )
    .sort((left, right) => left.character.name.localeCompare(right.character.name, 'fr'))
    .map((assignment) => {
      const payment = paymentsByParticipantId.get(assignment.participantId!)

      return {
        participant: assignment.participant,
        character: assignment.character,
        paidAt: payment?.paidAt || null,
        paymentEmailSentAt: payment?.paymentEmailSentAt || null,
        paymentReminderSentAt: payment?.paymentReminderSentAt || null
      }
    })

  return {
    session: {
      id: session.id,
      name: session.name,
      date: session.date,
      paymentRibUrl: session.paymentRibUrl,
      paymentLinkUrl: session.paymentLinkUrl,
      game: session.game
    },
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
  const isPlayer = session.assignments.some((assignment) =>
    assignment.participantId === participantId
    && isPlayableCharacterType(assignment.character.type)
  )

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

export async function sendSessionPaymentEmails(sessionId: string, reminder = false, participantId?: string | null, baseUrl = '') {
  const dashboard = await getSessionPaymentDashboard(sessionId)
  const now = new Date()
  let sentCount = 0
  let skippedCount = 0

  const rows = participantId
    ? dashboard.rows.filter((row) => row.participant.id === participantId)
    : dashboard.rows

  for (const row of rows) {
    if (row.paidAt || !row.participant.email) {
      skippedCount++
      continue
    }
    const isReminder = reminder || Boolean(row.paymentEmailSentAt)

    const result = await sendEmail({
      to: row.participant.email,
      subject: `${isReminder ? 'Relance paiement' : 'Paiement'} - ${dashboard.session.name}`,
      text: paymentEmailText({
        participantName: row.participant.name,
        sessionName: dashboard.session.name,
        gameTitle: dashboard.session.game.title,
        paymentLinkUrl: dashboard.session.paymentLinkUrl,
        paymentRibUrl: absoluteUrl(baseUrl, dashboard.session.paymentRibUrl),
        reminder: isReminder
      })
    })
    if (!result.sent) {
      throw createError({ statusCode: 500, message: 'SMTP désactivé' })
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

  return { sentCount, skippedCount }
}

export async function sendSessionPaymentTestEmails(sessionId: string, emails: string[], participantId?: string | null, baseUrl = '') {
  const dashboard = await getSessionPaymentDashboard(sessionId)
  const sample = dashboard.rows.find((row) => row.participant.id === participantId) || dashboard.rows[0]
  const reminder = Boolean(sample?.paymentEmailSentAt)

  const result = await sendEmail({
    to: emails,
    subject: `[Test] ${reminder ? 'Relance paiement' : 'Paiement'} - ${dashboard.session.name}`,
    text: paymentEmailText({
      participantName: sample?.participant.name || 'Prénom',
      sessionName: dashboard.session.name,
      gameTitle: dashboard.session.game.title,
      paymentLinkUrl: dashboard.session.paymentLinkUrl,
      paymentRibUrl: absoluteUrl(baseUrl, dashboard.session.paymentRibUrl),
      reminder
    })
  })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  return { sentCount: emails.length }
}
