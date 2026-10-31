import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { accountIdForEmail } from '~/server/utils/participantAccounts'
import { absoluteAppUrl, publicAppUrl } from '~/server/utils/appUrl'
import { openEmailTransport, sendEmail, type EmailTransport } from '~/server/utils/email'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_STATES, REGISTRATION_SOURCES, REGISTRATION_STATUSES, SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'
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

// Un doublon (période, participant) n'a qu'une inscription : deux invitations simultanées donnent le même refus
export function rethrowAlreadyRegistered(error: unknown): never {
  const { code, meta } = (error || {}) as { code?: string, meta?: unknown }
  if (code === 'P2002' && JSON.stringify(meta ?? {}).includes('participantId')) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà une inscription dans cette période d’inscription' })
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
}, now = new Date()) {
  const session = params.sessionName
    ? `${params.sessionName}${params.sessionDate ? ` (${formatDate(params.sessionDate)})` : ''}`
    : null

  return [
    `Bonjour ${params.participantName},`,
    '',
    `${params.inviterName || 'L’équipe d’organisation'} vous invite à jouer à « ${params.gameTitle} »${session ? `, session ${session}` : ''}.`,
    '',
    'Ce lien personnel vous permet de lire la note d’intention, de donner vos informations et de répondre à l’invitation :',
    params.url,
    '',
    responseDueLine(params.responseDueAt, now),
    'Ce lien vous est propre : ne le transférez pas.'
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
  if (params.status === REGISTRATION_STATUSES.retained) {
    return {
      subject: `Place retenue : ${params.gameTitle}`,
      text: [
        ...greeting,
        `Bonne nouvelle : votre inscription à « ${params.gameTitle} » est retenue pour la session ${sessionLabel(params.sessions[0]!)}.`,
        '',
        `Confirmez votre place par ce lien${params.responseDueAt ? `, avant le ${formatDate(params.responseDueAt)}` : ''} :`,
        params.url,
        '',
        'Sans confirmation à temps, l’équipe pourra proposer votre place à une autre personne. Vous pouvez aussi vous désister par ce lien.',
        ...link
      ].join('\n')
    }
  }
  if (params.status === REGISTRATION_STATUSES.waitlisted) {
    return {
      subject: `Liste d’attente : ${params.gameTitle}`,
      text: [
        ...greeting,
        `Votre inscription à « ${params.gameTitle} » est sur liste d’attente pour ${params.sessions.length > 1 ? 'les sessions' : 'la session'} ${params.sessions.map(sessionLabel).join(', ')}.`,
        'Si une place se libère, l’équipe vous écrira.',
        '',
        'Ce lien vous permet de suivre votre inscription, ou de vous désister :',
        params.url,
        ...link
      ].join('\n')
    }
  }
  return {
    subject: `Inscription : ${params.gameTitle}`,
    text: [
      ...greeting,
      `Votre inscription à « ${params.gameTitle} » n’a pas été retenue cette fois-ci. Merci de votre intérêt pour le jeu.`,
      '',
      'Ce lien vous permet de consulter votre inscription :',
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
  entryMode: true,
  state: true,
  closesAt: true,
  responseDelayDays: true,
  game: { select: { id: true, title: true, ownerId: true } },
  sessions: { select: { sessionId: true, session: { select: { name: true, date: true } } } }
} as const

/**
 * Invite des personnes à une session d'une période d'inscription ouverte (US-003) :
 * des participants du jeu, et/ou une nouvelle personne rapprochée par email (R12).
 * Une personne qui avait décliné ou s'était désistée peut être réinvitée : son inscription repart
 * au statut invitée, avec un nouveau lien (une seule inscription par personne et par période).
 * Les inscriptions sont créées ensemble, puis les emails partent sur une seule connexion SMTP.
 */
export async function inviteToRegistrationPeriod(params: {
  periodId: string
  sessionId: string
  participantIds: string[]
  newParticipant?: { name: string, email: string } | null
  inviter: { id: string, name?: string | null }
}) {
  const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: params.periodId }, select: periodForInvitationSelect })
  if (period.entryMode !== REGISTRATION_ENTRY_MODES.invitation) {
    throw createError({ statusCode: 409, message: 'Cette période d’inscription est en mode formulaire : on s’y inscrit par son lien de diffusion.' })
  }
  if (effectivePeriodState(period) !== REGISTRATION_PERIOD_STATES.open) {
    throw createError({ statusCode: 409, message: 'La période d’inscription doit être ouverte pour inviter' })
  }
  const link = period.sessions.find((session) => session.sessionId === params.sessionId)
  if (!link) {
    throw createError({ statusCode: 400, message: 'Session hors de la période d’inscription' })
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
      message: `Déjà inscrit dans cette période d’inscription : ${active.map((registration) => registration.participant.name).join(', ')}`
    })
  }
  const reinvitedByParticipant = new Map(existing.map((registration) => [registration.participantId, registration.id]))

  const responseDueAt = registrationResponseDueAt(period.responseDelayDays)
  const newParticipant = params.newParticipant
  const slug = newParticipant && !matched ? await generateUniqueSlug('participant', newParticipant.name) : null

  const targets = await prisma.$transaction(async (tx) => {
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
        sessionId: params.sessionId,
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
              confirmedAt: null,
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
    sessionName: link.session.name,
    sessionDate: link.session.date,
    responseDueAt,
    inviterName: params.inviter.name ?? null
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
    select: {
      id: true,
      status: true,
      respondedAt: true,
      sessionId: true,
      announcedStatus: true,
      announcedSessionId: true,
      period: { select: { id: true, gameId: true } }
    }
  })
  if (!registration) {
    throw createError({ statusCode: 404, message: 'Inscription introuvable' })
  }
  return registration
}

type AwaitingLike = { id: string, status: string, respondedAt: Date | null, sessionId: string | null, announcedStatus: string | null, announcedSessionId: string | null }

// Une réponse est attendue (R20) : invitation sans réponse, ou place retenue annoncée pas encore confirmée (ADR-0047)
export function isAwaitingResponse(registration: AwaitingLike) {
  return (registration.status === REGISTRATION_STATUSES.invited && !registration.respondedAt) || canConfirmPlace(registration)
}

export function assertAwaitingResponse(registration: AwaitingLike) {
  if (!isAwaitingResponse(registration)) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu, ou sa place n’est pas annoncée.' })
  }
}

// Condition d'écriture qui revérifie l'attente : une réponse arrivée entre-temps l'emporte
function awaitingResponseWhere(registration: AwaitingLike) {
  return registration.status === REGISTRATION_STATUSES.invited
    ? { id: registration.id, status: REGISTRATION_STATUSES.invited, respondedAt: null }
    : {
        id: registration.id,
        status: REGISTRATION_STATUSES.retained,
        sessionId: registration.sessionId,
        announcedStatus: REGISTRATION_STATUSES.retained,
        announcedSessionId: registration.sessionId
      }
}

const awaitingSelect = { id: true, status: true, respondedAt: true, sessionId: true, announcedStatus: true, announcedSessionId: true } as const

export function assertUnansweredInvitation(registration: { status: string, respondedAt: Date | null }) {
  if (registration.status !== REGISTRATION_STATUSES.invited || registration.respondedAt) {
    throw createError({ statusCode: 409, message: 'Cette invitation a déjà reçu une réponse' })
  }
}

/**
 * Renvoie l'invitation avec un nouveau lien : l'ancien cesse de fonctionner (ADR-0018).
 * L'échéance ne change pas : la prolonger est une action à part (US-005).
 * L'email part à l'adresse de l'inscription : c'est elle qui fait foi (R12).
 * Sert aussi quand la personne a perdu son email d'invitation (bouton « Nouveau lien », US-005).
 */
export async function resendRegistrationInvitation(registrationId: string, inviter: { name?: string | null }) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      ...awaitingSelect,
      email: true,
      responseDueAt: true,
      participant: { select: { name: true } },
      session: { select: { name: true, date: true } },
      period: { select: { game: { select: { title: true } } } }
    }
  })
  assertAwaitingResponse(registration)
  const to = registration.email

  const { token, tokenHash } = createRegistrationToken()
  // Statut revérifié dans l'écriture : une réponse arrivée entre-temps garde son lien
  const { count } = await prisma.registration.updateMany({ where: awaitingResponseWhere(registration), data: { tokenHash } })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu entre-temps.' })
  }

  // Place retenue : l'email de l'annonce, avec le nouveau lien (US-089)
  if (registration.status === REGISTRATION_STATUSES.retained) {
    const email = selectionAnnouncementEmail({
      status: registration.status,
      participantName: registration.participant.name,
      gameTitle: registration.period.game.title,
      sessions: [registration.session!],
      responseDueAt: registration.responseDueAt,
      url: registrationUrl(token)
    })
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
      sessionName: registration.session?.name ?? null,
      sessionDate: registration.session?.date ?? null,
      responseDueAt: registration.responseDueAt,
      inviterName: inviter.name ?? null
    }
  ).finally(() => transport?.close())
  if (!result.sent) {
    throw createError({ statusCode: 502, message: `L’ancien lien est invalidé, mais l’email n’est pas parti : ${result.message}` })
  }
  return { sent: true }
}

/**
 * Relance une invitation sans réponse par un rappel sans lien (US-005, R20) : le lien de
 * l'invitation reste valable. Une invitation jamais partie s'envoie, elle ne se relance pas.
 */
export async function remindRegistration(registrationId: string) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      ...awaitingSelect,
      email: true,
      invitationSentAt: true,
      announcedAt: true,
      responseDueAt: true,
      participant: { select: { name: true } },
      session: { select: { name: true } },
      period: { select: { game: { select: { title: true } } } }
    }
  })
  assertAwaitingResponse(registration)
  const retained = registration.status === REGISTRATION_STATUSES.retained
  // Place retenue : le lien est dans l'email de l'annonce (US-089)
  const sentAt = retained ? registration.announcedAt : registration.invitationSentAt
  if (!sentAt) {
    throw createError({ statusCode: 409, message: 'L’email d’invitation n’est jamais parti : envoyez-le plutôt que de relancer.' })
  }

  const result = await sendEmail({
    to: registration.email,
    subject: retained ? `Rappel – place retenue : ${registration.period.game.title}` : `Rappel – invitation : ${registration.period.game.title}`,
    text: registrationReminderEmailText({
      participantName: registration.participant.name,
      gameTitle: registration.period.game.title,
      sessionName: registration.session?.name ?? null,
      invitationSentAt: sentAt,
      responseDueAt: registration.responseDueAt,
      retained
    })
  }).catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'erreur SMTP' }))
  if (!result.sent) {
    const reason = 'reason' in result && result.reason !== 'smtp_disabled' ? result.reason : 'envoi d’emails désactivé'
    throw createError({ statusCode: 502, message: `Le rappel n’est pas parti : ${reason}.` })
  }
  await prisma.registration.update({ where: { id: registration.id }, data: { lastRemindedAt: new Date() } })
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

/** Prolonge l'échéance d'une invitation sans réponse, ou d'une place retenue, jusqu'à la date choisie (US-005, US-089, R20). */
export async function extendRegistrationDeadline(registrationId: string, responseDueAt: Date) {
  assertNewResponseDueAt(responseDueAt)
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId }, select: awaitingSelect })
  assertAwaitingResponse(registration)
  const { count } = await prisma.registration.updateMany({ where: awaitingResponseWhere(registration), data: { responseDueAt } })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu entre-temps.' })
  }
  return { responseDueAt }
}

/**
 * Libère la place d'une invitation sans réponse (US-005, R20) : l'inscription passe à désistée,
 * avec l'organisatrice comme autrice. Le lien ne permet plus de répondre ; il affiche seulement
 * que la place a été réattribuée faute de réponse. La personne peut être réinvitée (R16).
 */
export async function releaseRegistration(registration: AwaitingLike, releasedBy: { id: string }) {
  assertAwaitingResponse(registration)
  const { count } = await prisma.registration.updateMany({
    where: awaitingResponseWhere(registration),
    data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: new Date(), withdrawnById: releasedBy.id }
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu entre-temps.' })
  }
  return { success: true }
}

/**
 * Signale les personnes confirmées qui ne sont plus participantes de leur session (ADR-0021) :
 * retirées à la main de l'écran de session, sans passer par le désistement.
 */
export async function withSessionPresence<T extends { status: string, sessionId: string | null, participant: { id: string } }>(registrations: T[]) {
  const confirmed = registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.confirmed && registration.sessionId)
  const present = confirmed.length
    ? await prisma.sessionParticipant.findMany({
        where: {
          role: SESSION_ROLES.participant,
          sessionId: { in: [...new Set(confirmed.map((registration) => registration.sessionId!))] },
          participantId: { in: [...new Set(confirmed.map((registration) => registration.participant.id))] }
        },
        select: { sessionId: true, participantId: true }
      })
    : []
  const keys = new Set(present.map((row) => `${row.sessionId}:${row.participantId}`))
  return registrations.map((registration) => ({
    ...registration,
    missingFromSession: registration.status === REGISTRATION_STATUSES.confirmed
      && Boolean(registration.sessionId)
      && !keys.has(`${registration.sessionId}:${registration.participant.id}`)
  }))
}

export function registrationWithdrawalEmailText(params: {
  participantName: string
  gameTitle: string
  sessionName: string | null
  withdrawnBy: string | null
  trombinoscopes: 'regenerated' | 'failed' | null
}) {
  const session = params.sessionName ? ` de la session ${params.sessionName}` : ''
  return [
    params.withdrawnBy
      ? `${params.withdrawnBy} a retiré ${params.participantName}${session} du jeu « ${params.gameTitle} ».`
      : `${params.participantName} s’est désisté·e${session} du jeu « ${params.gameTitle} ».`,
    '',
    'La personne ne fait plus partie des participants de la session, et ses personnages (PJ et PNJ) sont libres.',
    params.trombinoscopes === 'regenerated'
      ? 'Les trombinoscopes de la session ont été régénérés sans elle : renvoyez-les si vous les aviez déjà envoyés.'
      : params.trombinoscopes === 'failed'
        ? 'Les trombinoscopes de la session n’ont pas pu être régénérés : relancez leur génération depuis la session.'
        : null,
    'Un paiement déjà reçu n’est pas modifié : il reste visible dans le tableau des paiements de la session, à traiter à la main.'
  ].filter((line) => line !== null).join('\n')
}

// Prévient l'équipe du jeu (propriétaire et co-organisatrices) ; un échec d'envoi n'annule pas le désistement
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

/**
 * Désistement d'une personne confirmée, par son lien ou par une organisatrice (US-006, ADR-0021) :
 * - l'inscription passe à désistée, et quitte ses listes d'attente (ADR-0047) ;
 * - la personne quitte la session et tous les personnages (PJ et PNJ) qu'elle y avait, qui restent sans joueur ;
 * - ses photos d'attribution partent avec, le fichier aussi s'il ne sert plus ;
 * - les trombinoscopes déjà générés pour la session sont régénérés sans elle ;
 * - un paiement éventuel est gardé, à traiter à la main (R22).
 * Régénération et email aux organisateurs se font après la réponse : la personne n'attend pas le serveur SMTP.
 */
// Désistement possible (R13, R16) : tout sauf une invitation, qui se décline, et une inscription déjà désistée
export const WITHDRAWABLE_STATUSES: string[] = [
  REGISTRATION_STATUSES.received,
  REGISTRATION_STATUSES.retained,
  REGISTRATION_STATUSES.waitlisted,
  REGISTRATION_STATUSES.rejected,
  REGISTRATION_STATUSES.confirmed
]

export async function withdrawRegistration(registrationId: string, withdrawnBy: { id: string, name?: string | null } | null) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      sessionId: true,
      participantId: true,
      participant: { select: { name: true } },
      session: { select: { name: true, status: true } },
      period: { select: { gameId: true, game: { select: { title: true } } } }
    }
  })
  if (!WITHDRAWABLE_STATUSES.includes(registration.status)) {
    throw createError({ statusCode: 409, message: 'Cette inscription ne peut pas faire l’objet d’un désistement.' })
  }

  const photoUrls = await prisma.$transaction(async (tx) => {
    // Le statut est revérifié dans l'écriture : deux désistements simultanés n'en font qu'un
    const { count } = await tx.registration.updateMany({
      where: { id: registration.id, status: registration.status },
      data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: new Date(), withdrawnById: withdrawnBy?.id ?? null }
    })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Cette inscription a changé entre-temps : rechargez la page.' })
    }
    await tx.registrationWaitlistEntry.deleteMany({ where: { registrationId: registration.id } })
    // Seule une personne confirmée est dans la session ; pas celle d'une session terminée, revenue au vivier (ADR-0047)
    const sessionId = registration.status === REGISTRATION_STATUSES.confirmed && registration.session?.status !== SESSION_STATUSES.completed
      ? registration.sessionId
      : null
    if (!sessionId) return []

    const where = { sessionId, participantId: registration.participantId }
    await tx.sessionParticipant.deleteMany({ where: { ...where, role: SESSION_ROLES.participant } })
    const assignments = await tx.sessionAssignment.findMany({ where, select: { photoUrl: true } })
    await tx.sessionAssignment.updateMany({ where, data: { participantId: null, photoUrl: null } })
    return assignments.map((assignment) => assignment.photoUrl).filter((url): url is string => Boolean(url))
  })

  await deleteUnusedUploads(photoUrls)
  const followUp = afterWithdrawal(registration, withdrawnBy)
  followUp.catch((error) => console.error('[désistement] suites non effectuées', { registrationId: registration.id, error: (error as Error)?.message }))
  return { followUp }
}

// Trombinoscopes à refaire et équipe à prévenir : rien de cela ne doit faire échouer le désistement
async function afterWithdrawal(
  registration: { sessionId: string | null, participant: { name: string }, session: { name: string } | null, period: { gameId: string, game: { title: string } } },
  withdrawnBy: { id: string, name?: string | null } | null
) {
  let trombinoscopes: 'regenerated' | 'failed' | null = null
  if (registration.sessionId && await prisma.sessionTrombinoscope.count({ where: { sessionId: registration.sessionId } })) {
    trombinoscopes = await generateSessionTrombinoscopes(registration.sessionId, publicAppUrl())
      .then(() => 'regenerated' as const)
      .catch(() => 'failed' as const)
  }
  return await notifyGameTeam(
    registration.period.gameId,
    registrationWithdrawalEmailText({
      participantName: registration.participant.name,
      gameTitle: registration.period.game.title,
      sessionName: registration.session?.name ?? null,
      withdrawnBy: withdrawnBy ? withdrawnBy.name || 'Une organisatrice' : null,
      trombinoscopes
    }),
    `Désistement : ${registration.participant.name} (${registration.period.game.title})`
  )
}
