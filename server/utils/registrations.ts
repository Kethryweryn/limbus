import { gamePhotoInformation } from '~/utils/photoInformation'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { accountIdForEmail } from '~/server/utils/participantAccounts'
import { absoluteAppUrl, publicAppUrl } from '~/server/utils/appUrl'
import { openEmailTransport, sendEmail, type EmailTransport } from '~/server/utils/email'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { REGISTRATION_PERIOD_STATES, REGISTRATION_SESSION_STATUSES as LINE, REGISTRATION_SOURCES, REGISTRATION_STATUSES, SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'
import { canConfirmPlace } from '~/utils/registrations'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Jeton du lien personnel (ADR-0018) : 32 octets aléatoires dans l'URL, seul leur SHA-256 est stocké.
 * Un hash sans sel suffit, le jeton étant aléatoire et long.
 */
export function createRegistrationToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashRegistrationToken(token) }
}

export function hashRegistrationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function registrationUrl(token: string) {
  return absoluteAppUrl(`/inscription/${token}`)
}

export function registrationResponseDueAt(responseDelayDays: number, now = new Date()) {
  return new Date(now.getTime() + responseDelayDays * DAY_MS)
}

/**
 * Participants rapprochables par email (R12) : sans tenir compte de la casse, et seulement parmi
 * les participants des jeux de la même propriétaire. Un jeu sans propriétaire ne regarde que lui-même.
 */
export function participantEmailMatchWhere(game: { id: string, ownerId: string | null }, email: string) {
  return {
    email: { equals: email.trim(), mode: 'insensitive' as const },
    gameLinks: { some: game.ownerId ? { game: { ownerId: game.ownerId } } : { gameId: game.id } }
  }
}

export async function findParticipantByEmail(game: { id: string, ownerId: string | null }, email: string) {
  return await prisma.participant.findFirst({
    where: participantEmailMatchWhere(game, email),
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, email: true }
  })
}

// Un doublon (vivier, participant) n'a qu'une ligne : deux invitations simultanées donnent le même refus
export function rethrowAlreadyRegistered(error: unknown): never {
  const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
  if (code === 'P2002' && JSON.stringify(meta ?? {}).includes('participantId')) {
    throw createError({ statusCode: 409, message: 'Cette personne est déjà dans le vivier' })
  }
  // Deux invitations simultanées d'une nouvelle personne de même nom visent le même slug de fiche
  if (code === 'P2002' && JSON.stringify(meta ?? {}).includes('slug')) {
    throw createError({ statusCode: 409, message: 'Une invitation de la même personne est en cours : rechargez la page et vérifiez la liste.' })
  }
  throw error
}

const formatDate = (value: Date) => value.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

// Une échéance passée n'est jamais rappelée : l'invitation reste ouverte tant que la place n'est pas libérée (ADR-0020)
function responseDueLine(responseDueAt: Date | null, now: Date) {
  if (!responseDueAt) return null
  return responseDueAt.getTime() > now.getTime()
    ? `Merci de répondre avant le ${formatDate(responseDueAt)}.`
    : 'Merci de répondre dès que possible.'
}

export function registrationInvitationEmailText(params: {
  participantName: string
  gameTitle: string
  sessionName: string | null
  sessionDate: Date | null
  responseDueAt: Date | null
  inviterName: string | null
  url: string
  // Usage des photos (US-107)
  photoInformation?: string | null
}, now = new Date()) {
  const session = params.sessionName
    ? `${params.sessionName}${params.sessionDate ? ` (${formatDate(params.sessionDate)})` : ''}`
    : null

  return [
    `Bonjour ${params.participantName},`,
    '',
    `${params.inviterName || 'L’équipe d’organisation'} vous invite à jouer à « ${params.gameTitle} »${session ? `, session ${session}` : ''}.`,
    '',
    'Ce lien personnel vous permet de lire la note d’intention et de répondre au questionnaire du jeu :',
    params.url,
    '',
    responseDueLine(params.responseDueAt, now),
    'Ce lien vous est propre : ne le transférez pas.',
    ...(params.photoInformation ? ['', params.photoInformation] : [])
  ].filter((line) => line !== null).join('\n')
}

/**
 * Rappel d'une invitation sans réponse (US-005, R20) : sans lien, car seul le hash du jeton est
 * stocké (ADR-0018). La personne reprend son email d'invitation, dont le lien reste valable.
 */
export function registrationReminderEmailText(params: {
  participantName: string
  gameTitle: string
  sessionName: string | null
  invitationSentAt: Date
  responseDueAt: Date | null
  // Place retenue à confirmer (US-089) plutôt qu'invitation
  retained?: boolean
}, now = new Date()) {
  const session = params.sessionName ? `, session ${params.sessionName}` : ''
  return [
    `Bonjour ${params.participantName},`,
    '',
    params.retained
      ? `Votre inscription à « ${params.gameTitle} »${session} est retenue, mais nous n’avons pas encore reçu la confirmation de votre place.`
      : `Nous n’avons pas encore reçu votre réponse à l’invitation à jouer à « ${params.gameTitle} »${session}.`,
    '',
    params.retained
      ? `Votre lien personnel se trouve dans l’email envoyé le ${formatDate(params.invitationSentAt)}, intitulé « Place retenue : ${params.gameTitle} ». Il permet de confirmer votre place ou de vous désister.`
      : `Votre lien personnel se trouve dans l’email d’invitation envoyé le ${formatDate(params.invitationSentAt)}, intitulé « Invitation : ${params.gameTitle} ». Il permet de lire la note d’intention et de répondre.`,
    responseDueLine(params.responseDueAt, now) ?? 'Merci de répondre dès que possible.',
    '',
    'Vous ne retrouvez pas cet email ? Prévenez l’équipe d’organisation : elle vous enverra un nouveau lien.'
  ].join('\n')
}

// Emails de l'annonce des résultats (US-088), et du renvoi d'un lien à une personne retenue (US-089)
function sessionLabel(session: { name: string, date: Date | null }) {
  return `${session.name}${session.date ? ` (${formatDate(session.date)})` : ''}`
}

export function selectionAnnouncementEmail(params: {
  status: string
  participantName: string
  gameTitle: string
  sessions: Array<{ name: string, date: Date | null }>
  responseDueAt: Date | null
  url: string
}) {
  const greeting = [`Bonjour ${params.participantName},`, '']
  const link = ['', 'Ce lien personnel remplace ceux des emails précédents ; il vous est propre, ne le transférez pas.']
  if (params.status === LINE.retained) {
    return {
      subject: `Place retenue : ${params.gameTitle}`,
      text: [
        ...greeting,
        `Bonne nouvelle : votre inscription à « ${params.gameTitle} » est retenue pour la session ${sessionLabel(params.sessions[0]!)}.`,
        '',
        `Confirmez votre place par ce lien${params.responseDueAt ? `, avant le ${formatDate(params.responseDueAt)}` : ''} :`,
        params.url,
        '',
        'Sans confirmation à temps, l’équipe pourra proposer votre place à une autre personne. Vous pouvez aussi annuler votre présence par ce lien.',
        ...link
      ].join('\n')
    }
  }
  return {
    subject: `Liste d’attente : ${params.gameTitle}`,
    text: [
      ...greeting,
      `Votre inscription à « ${params.gameTitle} » est sur liste d’attente pour ${params.sessions.length > 1 ? 'les sessions' : 'la session'} ${params.sessions.map(sessionLabel).join(', ')}.`,
      'Si une place se libère, l’équipe vous écrira.',
      '',
      'Ce lien vous permet de suivre votre inscription, ou d’annuler votre présence :',
      params.url,
      ...link
    ].join('\n')
  }
}

type InvitationEmailTarget = {
  registrationId: string
  token: string
  to: string
  participantName: string
}

type InvitationContext = {
  gameTitle: string
  sessionName: string | null
  sessionDate: Date | null
  responseDueAt: Date | null
  inviterName: string | null
  photoInformation: string | null
}

/**
 * Envoie l'email d'invitation et note la date d'envoi. Un échec est rendu, pas levé :
 * dans un envoi groupé, il ne doit pas empêcher les envois suivants.
 * Le transport est ouvert une fois pour tout l'envoi groupé ; null : envoi d'emails désactivé.
 */
async function sendInvitationEmail(transport: EmailTransport | null, target: InvitationEmailTarget, context: InvitationContext) {
  if (!transport) {
    return { sent: false, message: 'SMTP désactivé' }
  }
  try {
    await transport.send({
      to: target.to,
      subject: `Invitation : ${context.gameTitle}`,
      text: registrationInvitationEmailText({ ...context, participantName: target.participantName, url: registrationUrl(target.token) })
    })
  } catch (error) {
    return { sent: false, message: (error as { message?: string })?.message || 'Erreur SMTP' }
  }

  await prisma.registration.update({ where: { id: target.registrationId }, data: { invitationSentAt: new Date() } })
  return { sent: true, message: null }
}

const periodForInvitationSelect = {
  id: true,
  gameId: true,
  state: true,
  responseDelayDays: true,
  game: { select: { id: true, title: true, ownerId: true, photoRetentionMonths: true, contactEmail: true, owner: { select: { email: true } } } }
} as const

/**
 * Invite des personnes à rejoindre le vivier ouvert (R4) : des participants du jeu, et/ou une nouvelle personne
 * rapprochée par email (R12 de SPEC-001). L'invitation peut viser une session : la personne y sera inscrite si elle
 * répond en se disant disponible. Une place n'est pas réservée à l'envoi.
 * Une personne sortie du vivier peut être réinvitée : sa ligne repart invitée, avec un nouveau lien.
 * Les invitations sont créées ensemble, puis les emails partent sur une seule connexion SMTP.
 */
export async function inviteToRegistrationPeriod(params: {
  periodId: string
  sessionId?: string | null
  participantIds: string[]
  newParticipant?: { name: string, email: string } | null
  inviter: { id: string, name?: string | null }
}) {
  const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: params.periodId }, select: periodForInvitationSelect })
  if (period.state !== REGISTRATION_PERIOD_STATES.open) {
    throw createError({ statusCode: 409, message: 'Le vivier doit être ouvert pour inviter' })
  }
  const invitedSession = params.sessionId
    ? await prisma.session.findFirst({ where: { id: params.sessionId, gameId: period.gameId, status: SESSION_STATUSES.scheduled }, select: { id: true, name: true, date: true } })
    : null
  if (params.sessionId && !invitedSession) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce vivier' })
  }

  // Les participants invités doivent être liés au jeu de la période
  const participants = await prisma.participant.findMany({
    where: { id: { in: params.participantIds }, gameLinks: { some: { gameId: period.gameId } } },
    select: { id: true, name: true, email: true }
  })
  if (participants.length !== params.participantIds.length) {
    throw createError({ statusCode: 400, message: 'Participant invalide pour ce jeu' })
  }
  const withoutEmail = participants.filter((participant) => !participant.email?.trim())
  if (withoutEmail.length) {
    throw createError({
      statusCode: 400,
      message: `Une personne sans email ne peut pas être invitée : ${withoutEmail.map((participant) => participant.name).join(', ')}`
    })
  }

  // Deux fiches avec la même adresse recevraient deux liens dans la même boîte
  const byEmail = new Map<string, string[]>()
  for (const participant of participants) {
    const email = participant.email!.trim().toLowerCase()
    byEmail.set(email, [...(byEmail.get(email) || []), participant.name])
  }
  const sharedEmails = [...byEmail.values()].filter((names) => names.length > 1)
  if (sharedEmails.length) {
    throw createError({
      statusCode: 400,
      message: `Ces fiches ont la même adresse email : ${sharedEmails.map((names) => names.join(' et ')).join(' ; ')}. Invitez une seule d’entre elles.`
    })
  }

  const matched = params.newParticipant ? await findParticipantByEmail(period.game, params.newParticipant.email) : null
  const knownIds = [...new Set([...participants.map((participant) => participant.id), ...(matched ? [matched.id] : [])])]
  const existing = await prisma.registration.findMany({
    where: { periodId: period.id, participantId: { in: knownIds } },
    select: { id: true, participantId: true, status: true, participant: { select: { name: true } } }
  })
  const active = existing.filter((registration) => registration.status !== REGISTRATION_STATUSES.withdrawn)
  if (active.length) {
    throw createError({
      statusCode: 409,
      message: `Déjà dans le vivier : ${active.map((registration) => registration.participant.name).join(', ')}`
    })
  }
  const reinvitedByParticipant = new Map(existing.map((registration) => [registration.participantId, registration.id]))

  const responseDueAt = registrationResponseDueAt(period.responseDelayDays)
  const newParticipant = params.newParticipant
  const slug = newParticipant && !matched ? await generateUniqueSlug('participant', newParticipant.name) : null

  const targets = await prisma.$transaction(async (tx) => {
    if (invitedSession) await tx.registrationPeriodSession.upsert({ where: { sessionId: invitedSession.id }, update: {}, create: { periodId: period.id, sessionId: invitedSession.id } })
    const invited = participants.map((participant) => ({ id: participant.id, name: participant.name, email: participant.email!.trim() }))
    if (newParticipant && matched) {
      await tx.participantGame.upsert({
        where: { participantId_gameId: { participantId: matched.id, gameId: period.gameId } },
        update: {},
        create: { participantId: matched.id, gameId: period.gameId }
      })
      // La fiche existante garde son email : on écrit à l'adresse saisie, qui ne diffère que par la casse
      if (!invited.some((participant) => participant.id === matched.id)) {
        invited.push({ id: matched.id, name: matched.name, email: newParticipant.email })
      }
    } else if (newParticipant) {
      const created = await tx.participant.create({
        data: {
          name: newParticipant.name,
          slug: slug!,
          email: newParticipant.email,
          userId: await accountIdForEmail(newParticipant.email),
          gameLinks: { create: { gameId: period.gameId } }
        },
        select: { id: true, name: true }
      })
      invited.push({ id: created.id, name: created.name, email: newParticipant.email })
    }

    const created: InvitationEmailTarget[] = []
    for (const participant of invited) {
      const { token, tokenHash } = createRegistrationToken()
      const invitation = {
        invitedSessionId: invitedSession?.id ?? null,
        status: REGISTRATION_STATUSES.invited,
        invitedById: params.inviter.id,
        email: participant.email,
        tokenHash,
        responseDueAt
      }
      const previousId = reinvitedByParticipant.get(participant.id)
      // Réinvitation : les réponses précédentes restent pour préremplir, mais l'adhésion,
      // le consentement santé et la version du formulaire sont à redonner
      const registration = previousId
        ? await tx.registration.update({
            where: { id: previousId, status: REGISTRATION_STATUSES.withdrawn },
            data: {
              ...invitation,
              invitationSentAt: null,
              respondedAt: null,
              withdrawnAt: null,
              withdrawnById: null,
              charterAcceptedAt: null,
              healthConsentAt: null,
              formVersionId: null
            },
            select: { id: true }
          })
        : await tx.registration.create({
            data: { ...invitation, periodId: period.id, participantId: participant.id, source: REGISTRATION_SOURCES.invitation },
            select: { id: true }
          })
      created.push({ registrationId: registration.id, token, to: participant.email, participantName: participant.name })
    }
    return created
  }).catch(rethrowAlreadyRegistered)

  const context = {
    gameTitle: period.game.title,
    sessionName: invitedSession?.name ?? null,
    sessionDate: invitedSession?.date ?? null,
    responseDueAt,
    inviterName: params.inviter.name ?? null,
    photoInformation: gamePhotoInformation(period.game)
  }
  const results = []
  const transport = await openEmailTransport().catch(() => null)
  try {
    for (const target of targets) {
      const result = await sendInvitationEmail(transport, target, context)
      results.push({ registrationId: target.registrationId, participantName: target.participantName, ...result })
    }
  } finally {
    transport?.close()
  }

  return {
    invitedCount: results.length,
    sentCount: results.filter((result) => result.sent).length,
    failures: results.filter((result) => !result.sent).map(({ participantName, message }) => ({ participantName, message }))
  }
}

export async function findRegistrationOr404(id: string | undefined) {
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const registration = await prisma.registration.findUnique({
    where: { id },
    select: { id: true, status: true, respondedAt: true, period: { select: { id: true, gameId: true } } }
  })
  if (!registration) {
    throw createError({ statusCode: 404, message: 'Inscription introuvable' })
  }
  return registration
}

export function assertUnansweredInvitation(registration: { status: string, respondedAt: Date | null }) {
  if (registration.status !== REGISTRATION_STATUSES.invited || registration.respondedAt) {
    throw createError({ statusCode: 409, message: 'Cette invitation a déjà reçu une réponse' })
  }
}

const awaitingLineKey = (registrationId: string, sessionId: string) => ({ registrationId_sessionId: { registrationId, sessionId } })

// La ligne d'une place retenue et annoncée, pas encore confirmée (R20 de SPEC-001, ADR-0047)
async function requireAwaitingLine(registrationId: string, sessionId: string) {
  const line = await prisma.registrationSession.findUnique({
    where: awaitingLineKey(registrationId, sessionId),
    select: { status: true, announcedStatus: true, announcedAt: true, responseDueAt: true, session: { select: { name: true, date: true } } }
  })
  if (!line || !canConfirmPlace(line)) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu, ou sa place n’est pas annoncée.' })
  }
  return line
}

// Condition d'écriture qui revérifie l'attente : une confirmation arrivée entre-temps l'emporte
const awaitingLineWhere = (registrationId: string, sessionId: string) => ({ registrationId, sessionId, status: LINE.retained, announcedStatus: LINE.retained })

const invitationSelect = {
  id: true,
  status: true,
  respondedAt: true,
  email: true,
  invitationSentAt: true,
  responseDueAt: true,
  participant: { select: { name: true } },
  invitedSession: { select: { name: true, date: true } },
  period: { select: { game: { select: { title: true, photoRetentionMonths: true, contactEmail: true, owner: { select: { email: true } } } } } }
} as const

/**
 * Nouveau lien (R13) : l'ancien cesse de fonctionner (ADR-0018). L'email part à l'adresse de l'inscription : c'est elle
 * qui fait foi. Invitation sans réponse : l'invitation ; place retenue (sessionId) : l'email de l'annonce ; sinon, un
 * simple rappel du lien, pour une personne du vivier qui a perdu ses emails.
 */
export async function resendRegistrationInvitation(registrationId: string, inviter: { name?: string | null }, sessionId?: string | null) {
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: invitationSelect })
  if (registration.status === REGISTRATION_STATUSES.withdrawn) {
    throw createError({ statusCode: 409, message: 'Cette personne est sortie du vivier.' })
  }
  const invited = registration.status === REGISTRATION_STATUSES.invited
  const line = !invited && sessionId ? await requireAwaitingLine(registrationId, sessionId) : null
  const to = registration.email

  const { token, tokenHash } = createRegistrationToken()
  // Statut revérifié dans l'écriture : une réponse ou une sortie arrivée entre-temps garde son état
  const { count } = await prisma.registration.updateMany({ where: { id: registrationId, status: registration.status }, data: { tokenHash } })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu entre-temps.' })
  }

  if (!invited) {
    const gameTitle = registration.period.game.title
    const email = line
      ? selectionAnnouncementEmail({ status: LINE.retained, participantName: registration.participant.name, gameTitle, sessions: [line.session], responseDueAt: line.responseDueAt, url: registrationUrl(token) })
      : {
          subject: `Votre lien : ${gameTitle}`,
          text: [
            `Bonjour ${registration.participant.name},`,
            '',
            `Voici votre nouveau lien personnel pour « ${gameTitle} ». Il vous permet de revoir et de modifier vos réponses :`,
            registrationUrl(token),
            '',
            'Il remplace ceux des emails précédents ; il vous est propre, ne le transférez pas.'
          ].join('\n')
        }
    const sent = await sendEmail({ to, ...email }).catch(() => ({ sent: false }))
    if (!sent.sent) {
      throw createError({ statusCode: 502, message: 'L’ancien lien est invalidé, mais l’email n’est pas parti.' })
    }
    return { sent: true }
  }

  const transport = await openEmailTransport().catch(() => null)
  const result = await sendInvitationEmail(
    transport,
    { registrationId: registration.id, token, to, participantName: registration.participant.name },
    {
      gameTitle: registration.period.game.title,
      sessionName: registration.invitedSession?.name ?? null,
      sessionDate: registration.invitedSession?.date ?? null,
      responseDueAt: registration.responseDueAt,
      inviterName: inviter.name ?? null,
      photoInformation: gamePhotoInformation(registration.period.game)
    }
  ).finally(() => transport?.close())
  if (!result.sent) {
    throw createError({ statusCode: 502, message: `L’ancien lien est invalidé, mais l’email n’est pas parti : ${result.message}` })
  }
  return { sent: true }
}

/**
 * Relance une invitation sans réponse, ou une place retenue pas confirmée (sessionId), par un rappel sans lien (US-005,
 * R20) : le lien reçu reste valable. Une invitation jamais partie s'envoie, elle ne se relance pas.
 */
export async function remindRegistration(registrationId: string, sessionId?: string | null) {
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: invitationSelect })
  const line = sessionId ? await requireAwaitingLine(registrationId, sessionId) : null
  if (!line) assertUnansweredInvitation(registration)
  const retained = Boolean(line)
  // Place retenue : le lien est dans l'email de l'annonce (US-089)
  const sentAt = line ? line.announcedAt : registration.invitationSentAt
  if (!sentAt) {
    throw createError({ statusCode: 409, message: 'L’email d’invitation n’est jamais parti : envoyez-le plutôt que de relancer.' })
  }

  const result = await sendEmail({
    to: registration.email,
    subject: retained ? `Rappel – place retenue : ${registration.period.game.title}` : `Rappel – invitation : ${registration.period.game.title}`,
    text: registrationReminderEmailText({
      participantName: registration.participant.name,
      gameTitle: registration.period.game.title,
      sessionName: (line?.session ?? registration.invitedSession)?.name ?? null,
      invitationSentAt: sentAt,
      responseDueAt: line ? line.responseDueAt : registration.responseDueAt,
      retained
    })
  }).catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'erreur SMTP' }))
  if (!result.sent) {
    const reason = 'reason' in result && result.reason !== 'smtp_disabled' ? result.reason : 'envoi d’emails désactivé'
    throw createError({ statusCode: 502, message: `Le rappel n’est pas parti : ${reason}.` })
  }
  const now = new Date()
  if (sessionId) await prisma.registrationSession.update({ where: awaitingLineKey(registrationId, sessionId), data: { lastRemindedAt: now } })
  else await prisma.registration.update({ where: { id: registrationId }, data: { lastRemindedAt: now } })
  return { sent: true }
}

const MAX_EXTENSION_DAYS = 365

// Nouvelle échéance choisie par l'organisatrice (R20) : dans le futur, au plus un an après aujourd'hui
export function assertNewResponseDueAt(responseDueAt: Date, now = new Date()) {
  if (responseDueAt.getTime() <= now.getTime()) {
    throw createError({ statusCode: 400, message: 'La nouvelle échéance doit être dans le futur.' })
  }
  if (responseDueAt.getTime() > now.getTime() + MAX_EXTENSION_DAYS * DAY_MS) {
    throw createError({ statusCode: 400, message: 'La nouvelle échéance doit être à moins d’un an.' })
  }
}

/** Prolonge l'échéance d'une invitation sans réponse, ou d'une place retenue (sessionId), jusqu'à la date choisie (US-005, US-089, R20). */
export async function extendRegistrationDeadline(registrationId: string, responseDueAt: Date, sessionId?: string | null) {
  assertNewResponseDueAt(responseDueAt)
  const { count } = sessionId
    ? await prisma.registrationSession.updateMany({ where: awaitingLineWhere(registrationId, sessionId), data: { responseDueAt } })
    : await prisma.registration.updateMany({ where: { id: registrationId, status: REGISTRATION_STATUSES.invited, respondedAt: null }, data: { responseDueAt } })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu, ou sa place n’est pas annoncée.' })
  }
  return { responseDueAt }
}

/**
 * Libère une place retenue sans confirmation (sessionId), qui passe à « annulation », ou une invitation sans réponse,
 * qui sort du vivier (US-005, R20) ; l'organisatrice en est l'autrice. Le personnage réservé redevient libre (US-100).
 */
export async function releaseRegistration(registrationId: string, releasedBy: { id: string }, sessionId?: string | null) {
  const now = new Date()
  const { count } = sessionId
    ? await prisma.registrationSession.updateMany({
        where: awaitingLineWhere(registrationId, sessionId),
        data: { status: LINE.cancelled, cancelledAt: now, cancelledById: releasedBy.id, waitlistPosition: null }
      })
    : await prisma.registration.updateMany({
        where: { id: registrationId, status: REGISTRATION_STATUSES.invited, respondedAt: null },
        data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: now, withdrawnById: releasedBy.id }
      })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu, ou sa place n’est pas annoncée.' })
  }
  await prisma.sessionAssignment.updateMany({ where: { reservedRegistrationId: registrationId, ...(sessionId ? { sessionId } : {}) }, data: { reservedRegistrationId: null } })
  return { success: true }
}

/**
 * Signale les personnes inscrites qui ne sont plus participantes de leur session (ADR-0021) :
 * retirées à la main de l'écran de session, sans passer par l'annulation.
 */
export async function withSessionPresence<T extends { sessionLines: Array<{ status: string, sessionId: string }>, participant: { id: string } }>(registrations: T[]) {
  const confirmed = registrations.flatMap((registration) => registration.sessionLines
    .filter((line) => line.status === LINE.confirmed)
    .map((line) => ({ sessionId: line.sessionId, participantId: registration.participant.id })))
  const present = confirmed.length
    ? await prisma.sessionParticipant.findMany({
        where: {
          role: SESSION_ROLES.participant,
          sessionId: { in: [...new Set(confirmed.map((row) => row.sessionId))] },
          participantId: { in: [...new Set(confirmed.map((row) => row.participantId))] }
        },
        select: { sessionId: true, participantId: true }
      })
    : []
  const keys = new Set(present.map((row) => `${row.sessionId}:${row.participantId}`))
  return registrations.map((registration) => ({
    ...registration,
    sessionLines: registration.sessionLines.map((line): T['sessionLines'][number] & { missingFromSession: boolean } => ({
      ...line,
      missingFromSession: line.status === LINE.confirmed && !keys.has(`${line.sessionId}:${registration.participant.id}`)
    }))
  }))
}

export function registrationWithdrawalEmailText(params: {
  participantName: string
  gameTitle: string
  sessionName: string | null
  withdrawnBy: string | null
  // La personne était inscrite : elle quitte la session, ses personnages sont libres
  wasInSession?: boolean
  trombinoscopes: 'regenerated' | 'failed' | null
}) {
  const session = params.sessionName ? ` de la session ${params.sessionName}` : ''
  return [
    params.withdrawnBy
      ? `${params.withdrawnBy} a retiré ${params.participantName}${session} du jeu « ${params.gameTitle} ».`
      : `${params.participantName} a annulé sa présence${session} au jeu « ${params.gameTitle} ».`,
    '',
    params.wasInSession ? 'La personne ne fait plus partie des participants de la session, et ses personnages (PJ et PNJ) sont libres.' : null,
    params.trombinoscopes === 'regenerated'
      ? 'Les trombinoscopes de la session ont été régénérés sans elle : renvoyez-les si vous les aviez déjà envoyés.'
      : params.trombinoscopes === 'failed'
        ? 'Les trombinoscopes de la session n’ont pas pu être régénérés : relancez leur génération depuis la session.'
        : null,
    params.wasInSession ? 'Un paiement déjà reçu n’est pas modifié : il reste visible dans le tableau des paiements de la session, à traiter à la main.' : null,
    'Elle reste dans le vivier du jeu.'
  ].filter((line) => line !== null).join('\n')
}

// Email à la propriétaire et aux co-organisatrices du jeu ; un échec est seulement signalé
export async function notifyGameTeam(gameId: string, text: string, subject: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    select: { owner: { select: { email: true } }, shares: { select: { user: { select: { email: true } } } } }
  })
  const recipients = [...new Set([game.owner?.email, ...game.shares.map((share) => share.user.email)].filter((email): email is string => Boolean(email)))]
  if (!recipients.length) return false
  try {
    return (await sendEmail({ to: recipients, subject, text })).sent
  } catch {
    return false
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Une présence qu'on peut annuler (R19) ; « pas disponible » n'est pas une présence, et une annulation l'est déjà
const CANCELLABLE_LINE_STATUSES: string[] = [LINE.preregistered, LINE.waitlisted, LINE.retained, LINE.confirmed, LINE.transferred]

/**
 * Annule une ligne dans une transaction (R19) : elle passe à « annulation », sort de sa liste d'attente, et son personnage
 * réservé redevient libre. Une personne inscrite quitte la session et tous les personnages (PJ et PNJ) qu'elle y avait,
 * avec leurs photos ; rien de cela pour une session terminée. Un paiement éventuel reste à traiter à la main (R22 de SPEC-001).
 * Rend les photos à effacer, et si la personne était dans la session.
 */
async function cancelLineInTx(
  tx: Tx,
  registration: { id: string, participantId: string },
  line: { sessionId: string, status: string, session: { status: string } },
  cancelledBy: { id: string } | null
) {
  // Le statut est revérifié dans l'écriture : deux annulations simultanées n'en font qu'une
  const { count } = await tx.registrationSession.updateMany({
    where: { registrationId: registration.id, sessionId: line.sessionId, status: line.status },
    data: { status: LINE.cancelled, cancelledAt: new Date(), cancelledById: cancelledBy?.id ?? null, waitlistPosition: null, retainedById: null }
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette inscription a changé entre-temps : rechargez la page.' })
  }
  await tx.sessionAssignment.updateMany({ where: { sessionId: line.sessionId, reservedRegistrationId: registration.id }, data: { reservedRegistrationId: null } })
  if (line.status !== LINE.confirmed || line.session.status === SESSION_STATUSES.completed) return { photoUrls: [], wasInSession: false }

  const where = { sessionId: line.sessionId, participantId: registration.participantId }
  await tx.sessionParticipant.deleteMany({ where: { ...where, role: SESSION_ROLES.participant } })
  const assignments = await tx.sessionAssignment.findMany({ where, select: { photoUrl: true } })
  await tx.sessionAssignment.updateMany({ where, data: { participantId: null, photoUrl: null } })
  return { photoUrls: assignments.map((assignment) => assignment.photoUrl).filter((url): url is string => Boolean(url)), wasInSession: true }
}

const withdrawalSelect = {
  id: true,
  status: true,
  participantId: true,
  participant: { select: { name: true } },
  period: { select: { gameId: true, game: { select: { title: true } } } },
  sessionLines: { select: { sessionId: true, status: true, session: { select: { name: true, status: true } } } }
} as const

/**
 * Annule la présence d'une personne à une session, par elle-même ou par une organisatrice (R19) : elle reste dans le
 * vivier. Régénération des trombinoscopes et email à l'équipe se font après la réponse : la personne n'attend pas le
 * serveur SMTP.
 */
export async function cancelRegistrationSession(registrationId: string, sessionId: string, cancelledBy: { id: string, name?: string | null } | null) {
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: withdrawalSelect })
  const line = registration.sessionLines.find((candidate) => candidate.sessionId === sessionId)
  if (!line || !CANCELLABLE_LINE_STATUSES.includes(line.status)) {
    throw createError({ statusCode: 409, message: 'Il n’y a pas de présence à annuler pour cette session.' })
  }
  const { photoUrls, wasInSession } = await prisma.$transaction((tx) => cancelLineInTx(tx, registration, line, cancelledBy))
  await deleteUnusedUploads(photoUrls)
  const followUp = afterCancellation(registration, line, wasInSession, cancelledBy)
  followUp.catch((error) => console.error('[annulation] suites non effectuées', { registrationId, error: (error as Error)?.message }))
  return { followUp }
}

/**
 * Sortie du vivier (R5) : ses présences à des sessions à venir sont annulées comme en R19, et son lien personnel ne
 * marche plus. Elle y revient en remplissant de nouveau le questionnaire. L'équipe voit qu'elle est sortie.
 */
export async function leavePool(registrationId: string, leftBy: { id: string, name?: string | null } | null) {
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: withdrawalSelect })
  if (registration.status === REGISTRATION_STATUSES.withdrawn) {
    throw createError({ statusCode: 409, message: 'Cette personne est déjà sortie du vivier.' })
  }
  const lines = registration.sessionLines.filter((line) => CANCELLABLE_LINE_STATUSES.includes(line.status) && line.session.status === SESSION_STATUSES.scheduled)
  const cancelled = await prisma.$transaction(async (tx) => {
    const { count } = await tx.registration.updateMany({
      where: { id: registrationId, status: registration.status },
      data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: new Date(), withdrawnById: leftBy?.id ?? null, tokenHash: null }
    })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Cette inscription a changé entre-temps : rechargez la page.' })
    }
    const results = []
    for (const line of lines) results.push({ line, ...await cancelLineInTx(tx, registration, line, leftBy) })
    return results
  })
  await deleteUnusedUploads(cancelled.flatMap((result) => result.photoUrls))
  const followUp = afterLeaving(registration, cancelled, leftBy)
  followUp.catch((error) => console.error('[sortie du vivier] suites non effectuées', { registrationId, error: (error as Error)?.message }))
  return { followUp }
}

/**
 * Une personne perd sa place sans que l'équipe soit prévenue, puisqu'elle vient d'en décider (R30) : remboursement,
 * remplacement, ou refus de venir à une session reportée. Sur la session d'origine, annulée ou reportée, seule sa ligne
 * change ; sur son report, elle quitte aussi la session comme en R19.
 */
export async function giveUpSeat(sessionId: string, participantId: string, postponedToSessionId?: string | null) {
  await prisma.registrationSession.updateMany({
    where: { sessionId, registration: { participantId }, status: { in: CANCELLABLE_LINE_STATUSES } },
    data: { status: LINE.cancelled, cancelledAt: new Date(), waitlistPosition: null, retainedById: null }
  })
  if (!postponedToSessionId) return
  const registration = await prisma.registration.findFirst({
    where: { participantId, sessionLines: { some: { sessionId: postponedToSessionId, status: { in: CANCELLABLE_LINE_STATUSES } } } },
    select: withdrawalSelect
  })
  const line = registration?.sessionLines.find((candidate) => candidate.sessionId === postponedToSessionId)
  if (!registration || !line) return
  const { photoUrls, wasInSession } = await prisma.$transaction((tx) => cancelLineInTx(tx, registration, line, null))
  await deleteUnusedUploads(photoUrls)
  if (wasInSession) await regenerateTrombinoscopes(postponedToSessionId)
}

async function regenerateTrombinoscopes(sessionId: string) {
  if (!await prisma.sessionTrombinoscope.count({ where: { sessionId } })) return null
  return await generateSessionTrombinoscopes(sessionId, publicAppUrl())
    .then(() => 'regenerated' as const)
    .catch(() => 'failed' as const)
}

// Trombinoscopes à refaire et équipe à prévenir : rien de cela ne doit faire échouer l'annulation
async function afterCancellation(
  registration: { participant: { name: string }, period: { gameId: string, game: { title: string } } },
  line: { sessionId: string, session: { name: string } },
  wasInSession: boolean,
  cancelledBy: { id: string, name?: string | null } | null
) {
  const trombinoscopes = wasInSession ? await regenerateTrombinoscopes(line.sessionId) : null
  return await notifyGameTeam(
    registration.period.gameId,
    registrationWithdrawalEmailText({
      participantName: registration.participant.name,
      gameTitle: registration.period.game.title,
      sessionName: line.session.name,
      withdrawnBy: cancelledBy ? cancelledBy.name || 'Une organisatrice' : null,
      wasInSession,
      trombinoscopes
    }),
    `Annulation : ${registration.participant.name} (${registration.period.game.title})`
  )
}

async function afterLeaving(
  registration: { participant: { name: string }, period: { gameId: string, game: { title: string } } },
  cancelled: Array<{ line: { sessionId: string, session: { name: string } }, wasInSession: boolean }>,
  leftBy: { id: string, name?: string | null } | null
) {
  for (const { line, wasInSession } of cancelled) {
    if (wasInSession) await regenerateTrombinoscopes(line.sessionId)
  }
  const name = registration.participant.name
  const sessions = cancelled.map(({ line }) => line.session.name)
  return await notifyGameTeam(
    registration.period.gameId,
    [
      leftBy
        ? `${leftBy.name || 'Une organisatrice'} a retiré ${name} du vivier du jeu « ${registration.period.game.title} ».`
        : `${name} a quitté le vivier du jeu « ${registration.period.game.title} ».`,
      sessions.length ? `Présences annulées : ${sessions.join(', ')}.` : null,
      cancelled.some((row) => row.wasInSession) ? 'Ses personnages sont libres, et un paiement déjà reçu reste à traiter à la main dans le tableau des paiements de la session.' : null
    ].filter((line) => line !== null).join('\n'),
    `Sortie du vivier : ${name} (${registration.period.game.title})`
  )
}
