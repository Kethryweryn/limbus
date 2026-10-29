import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { accountIdForEmail } from '~/server/utils/participantAccounts'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { sendEmail } from '~/server/utils/email'
import { hashRegistrationToken } from '~/server/utils/registrations'
import { getCurrentRegistrationForm, saveRegistrationFormDefinition } from '~/server/utils/registrationForms'
import { REGISTRATION_PERIOD_STATES, REGISTRATION_STATUSES, SESSION_ROLES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'
import { isInvitationOverdue, registrationLinkExpired, splitParticipantName } from '~/utils/registrations'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  normalizeRegistrationFormDefinition,
  type RegistrationFormDefinition
} from '~/utils/registrationForms'

// Même réponse pour un jeton inconnu, invalidé ou expiré : on ne dit pas pourquoi (ADR-0018)
export const INVALID_LINK_MESSAGE = 'Ce lien n’est pas valide.'

const TOKEN_PATTERN = /^[\w-]{43}$/

const publicRegistrationSelect = {
  id: true,
  status: true,
  sessionId: true,
  participantId: true,
  email: true,
  firstName: true,
  lastName: true,
  facebookName: true,
  phone: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  dietary: true,
  healthConsentAt: true,
  charterAcceptedAt: true,
  responseDueAt: true,
  respondedAt: true,
  confirmedAt: true,
  withdrawnById: true,
  formVersion: { select: { id: true, definition: true } },
  participant: { select: { name: true } },
  session: { select: { name: true, date: true, location: { select: { name: true, address: true } } } },
  period: {
    select: {
      gameId: true,
      state: true,
      closesAt: true,
      game: { select: { title: true, noteIntention: true } },
      sessions: { select: { session: { select: { date: true } } } }
    }
  }
} as const

export type PublicRegistration = NonNullable<Awaited<ReturnType<typeof findRegistrationByToken>>>

export async function findRegistrationByToken(token: string | undefined) {
  if (!token || !TOKEN_PATTERN.test(token)) return null

  const registration = await prisma.registration.findUnique({
    where: { tokenHash: hashRegistrationToken(token) },
    select: publicRegistrationSelect
  })
  if (!registration) return null

  const sessionDates = [registration.session?.date, ...registration.period.sessions.map((link) => link.session.date)]
  if (registrationLinkExpired(sessionDates)) return null
  return registration
}

/**
 * Inscription d'une fiche rattachée au compte (US-072, ADR-0041) : même sélection que le lien personnel,
 * sans l'expiration du lien. Une inscription d'une autre fiche répond comme une inconnue.
 */
export async function requireMyRegistration(userId: string, id: string | undefined) {
  const registration = id
    ? await prisma.registration.findFirst({ where: { id, participant: { userId } }, select: publicRegistrationSelect })
    : null
  if (!registration) {
    throw createError({ statusCode: 404, message: 'Inscription introuvable' })
  }
  return registration
}

// Vue d'une inscription depuis le compte : l'adresse montrée est celle du compte, que la réponse enregistrera
export async function exposeMyRegistration(registration: PublicRegistration, accountEmail: string) {
  const exposed = await exposePublicRegistration(registration)
  return 'answers' in exposed ? { ...exposed, answers: { ...exposed.answers, email: accountEmail } } : exposed
}

export async function requireRegistrationByToken(token: string | undefined) {
  const registration = await findRegistrationByToken(token)
  if (!registration) {
    throw createError({ statusCode: 404, message: INVALID_LINK_MESSAGE })
  }
  return registration
}

/**
 * Ce que permet le lien (R13, R20, ADR-0018) :
 * - une invitation sans réponse s'accepte ou se décline, même après l'échéance ou la clôture,
 *   tant que les orgas n'ont pas libéré la place (elle serait alors désistée) ;
 * - une inscription confirmée se modifie jusqu'à la clôture, et se désiste même après (US-006) ;
 * - une inscription désistée ne permet plus rien.
 */
export function registrationPermissions(registration: { status: string, period: { state: string, closesAt: Date | null } }, now = new Date()) {
  const open = effectivePeriodState(registration.period, now) === REGISTRATION_PERIOD_STATES.open
  const invited = registration.status === REGISTRATION_STATUSES.invited
  const confirmed = registration.status === REGISTRATION_STATUSES.confirmed
  return {
    canAccept: invited,
    canDecline: invited,
    canEdit: confirmed && open,
    canWithdraw: confirmed
  }
}

// Définition à remplir : celle que l'inscription a déjà remplie (R9), sinon la version en vigueur
async function formForRegistration(registration: PublicRegistration) {
  if (registration.formVersion) {
    return {
      versionId: registration.formVersion.id,
      definition: normalizeRegistrationFormDefinition(registration.formVersion.definition as RegistrationFormDefinition)
    }
  }
  const current = await getCurrentRegistrationForm(registration.period.gameId)
  return { versionId: current.version?.id ?? null, definition: current.definition }
}

export async function registrationFormDefinition(registration: PublicRegistration) {
  return (await formForRegistration(registration)).definition
}

/**
 * Version figée par une réponse validée : sans formulaire enregistré, la définition par défaut devient la
 * version 1. Deux premières réponses simultanées se partagent cette version au lieu de se gêner.
 */
export async function frozenFormVersionId(registration: PublicRegistration, versionId: string | null) {
  if (versionId) return versionId
  const gameId = registration.period.gameId
  try {
    return (await saveRegistrationFormDefinition(gameId, DEFAULT_REGISTRATION_FORM_DEFINITION)).version!.id
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode !== 409) throw error
    return (await getCurrentRegistrationForm(gameId)).version!.id
  }
}

// Ce que la page dit d'une inscription désistée, selon qui y a mis fin et quand
export function withdrawalReason(registration: Pick<PublicRegistration, 'confirmedAt' | 'withdrawnById'>) {
  if (registration.confirmedAt) return registration.withdrawnById ? 'removed' : 'withdrawn'
  return registration.withdrawnById ? 'released' : 'declined'
}

// Données montrées à la personne : les siennes et celles du jeu, jamais celles des autres inscrits
export async function exposePublicRegistration(registration: PublicRegistration, now = new Date()) {
  const game = { title: registration.period.game.title }
  if (registration.status === REGISTRATION_STATUSES.withdrawn) {
    // Refus, désistement, place réattribuée faute de réponse, ou retrait par l'équipe : seul le message change
    return { status: registration.status, game, withdrawalReason: withdrawalReason(registration) }
  }

  const prefill = splitParticipantName(registration.participant.name)
  const answered = Boolean(registration.respondedAt)
  return {
    status: registration.status,
    game: { ...game, noteIntention: registration.period.game.noteIntention },
    session: registration.session,
    periodState: effectivePeriodState(registration.period, now),
    closesAt: registration.period.closesAt,
    responseDueAt: registration.responseDueAt,
    overdue: isInvitationOverdue(registration, now),
    confirmedAt: registration.confirmedAt,
    ...registrationPermissions(registration, now),
    definition: await registrationFormDefinition(registration),
    answers: {
      email: registration.email,
      firstName: answered ? registration.firstName : registration.firstName ?? prefill.firstName,
      lastName: answered ? registration.lastName : registration.lastName ?? prefill.lastName,
      facebookName: registration.facebookName,
      phone: registration.phone,
      emergencyContactName: registration.emergencyContactName,
      emergencyContactPhone: registration.emergencyContactPhone,
      dietary: registration.dietary,
      healthConsent: Boolean(registration.healthConsentAt),
      charterAccepted: Boolean(registration.charterAcceptedAt)
    }
  }
}

export type RegistrationAnswers = {
  email: string
  firstName: string | null
  lastName: string | null
  facebookName: string | null
  phone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  dietary: string | null
}

// Définition qui valide la réponse ; rien n'est écrit tant que la réponse n'est pas validée
export async function answerFormDefinition(registration: PublicRegistration) {
  const { status } = registration
  const permissions = registrationPermissions(registration)
  if (status === REGISTRATION_STATUSES.invited ? !permissions.canAccept : !permissions.canEdit) {
    throw createError({ statusCode: 409, message: 'Votre inscription ne peut plus être modifiée.' })
  }
  return await formForRegistration(registration)
}

/**
 * Accepte l'invitation (statut confirmée) ou modifie une inscription confirmée.
 * L'acceptation crée le SessionParticipant dans la même transaction (ADR-0021, R22).
 * Les informations restent sur l'inscription (R14) ; seul l'email remonte sur la fiche du participant :
 * c'est l'adresse donnée par la personne qui fait foi pour tous les envois (R12).
 */
export async function saveRegistrationAnswers(registration: PublicRegistration, versionId: string, answers: RegistrationAnswers) {
  const now = new Date()
  const accepting = registration.status === REGISTRATION_STATUSES.invited
  const data = {
    ...answers,
    // Le consentement santé n'a de sens qu'avec des allergies déclarées ; il date du dernier enregistrement
    healthConsentAt: answers.dietary ? now : null,
    charterAcceptedAt: registration.charterAcceptedAt ?? now,
    formVersionId: versionId,
    ...(accepting ? { status: REGISTRATION_STATUSES.confirmed, respondedAt: now, confirmedAt: now } : {})
  }

  await prisma.$transaction(async (tx) => {
    // Le statut est revérifié dans l'écriture : une libération ou un désistement simultané l'emporte
    const { count } = await tx.registration.updateMany({ where: { id: registration.id, status: registration.status }, data })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
    }
    // L'adresse donnée fait foi ; le rattachement au compte la suit (US-070)
    await tx.participant.update({ where: { id: registration.participantId }, data: { email: answers.email, userId: await accountIdForEmail(answers.email) } })
    if (accepting && registration.sessionId) {
      await tx.sessionParticipant.upsert({
        where: {
          sessionId_participantId_role: {
            sessionId: registration.sessionId,
            participantId: registration.participantId,
            role: SESSION_ROLES.participant
          }
        },
        update: {},
        create: { sessionId: registration.sessionId, participantId: registration.participantId, role: SESSION_ROLES.participant }
      })
    }
  })

  return { accepted: accepting }
}

// Décliner une invitation sans réponse : l'inscription passe à désistée, sans formulaire (R16)
export async function declineRegistration(registration: PublicRegistration) {
  if (!registrationPermissions(registration).canDecline) {
    throw createError({ statusCode: 409, message: 'Cette invitation a déjà reçu une réponse.' })
  }
  const now = new Date()
  const { count } = await prisma.registration.updateMany({
    where: { id: registration.id, status: REGISTRATION_STATUSES.invited },
    data: { status: REGISTRATION_STATUSES.withdrawn, respondedAt: now, withdrawnAt: now }
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
  }
}

const formatDate = (value: Date) => value.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export function registrationConfirmationEmailText(params: {
  firstName: string | null
  gameTitle: string
  sessionName: string | null
  sessionDate: Date | null
  url: string
}) {
  const session = params.sessionName
    ? ` pour la session ${params.sessionName}${params.sessionDate ? ` (${formatDate(params.sessionDate)})` : ''}`
    : ''
  return [
    `Bonjour${params.firstName ? ` ${params.firstName}` : ''},`,
    '',
    `Votre inscription à « ${params.gameTitle} »${session} est confirmée.`,
    '',
    'Ce lien personnel vous permet de consulter et de modifier vos informations jusqu’à la clôture des inscriptions :',
    params.url,
    '',
    'Ce lien vous est propre : ne le transférez pas.'
  ].join('\n')
}

// L'email de confirmation n'empêche pas la confirmation : un échec est seulement signalé.
// url : le lien personnel, ou l'espace « Je participe » pour une réponse faite depuis le compte (US-072)
export async function sendRegistrationConfirmationEmail(registration: PublicRegistration, answers: RegistrationAnswers, url: string) {
  try {
    const result = await sendEmail({
      to: answers.email,
      subject: `Inscription confirmée : ${registration.period.game.title}`,
      text: registrationConfirmationEmailText({
        firstName: answers.firstName,
        gameTitle: registration.period.game.title,
        sessionName: registration.session?.name ?? null,
        sessionDate: registration.session?.date ?? null,
        url
      })
    })
    return result.sent
  } catch {
    return false
  }
}

/**
 * En-têtes et débit des routes du lien personnel : pas de cache ni d'indexation, pas de jeton dans
 * le Referer (ADR-0018), et une limite par IP (ADR-0013 : compteur en mémoire, un seul processus).
 */
export function guardPublicRegistrationRequest(event: H3Event, kind: 'read' | 'write') {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Robots-Tag', 'noindex')
  // Par lien et par IP, avec un plafond large par IP : plusieurs joueurs derrière un même wifi
  // ne se bloquent pas entre eux, et un balayage de jetons reste freiné
  const token = String(getRouterParam(event, 'token') || '').slice(0, 64)
  const windowMs = 10 * 60 * 1000
  if (kind === 'read') {
    assertRateLimit(event, { name: 'public-registration-read', limit: 60, windowMs, keyParts: [token] })
    assertRateLimit(event, { name: 'public-registration-read-ip', limit: 600, windowMs })
  } else {
    assertRateLimit(event, { name: 'public-registration-write', limit: 20, windowMs, keyParts: [token] })
    assertRateLimit(event, { name: 'public-registration-write-ip', limit: 100, windowMs })
  }
}
