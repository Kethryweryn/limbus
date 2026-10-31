import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { accountIdForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { sendEmail } from '~/server/utils/email'
import { hashRegistrationToken } from '~/server/utils/registrations'
import { asksAvailability } from '~/server/utils/registrationAvailability'
import { getCurrentRegistrationForm, saveRegistrationFormDefinition, type AffinityAnswers, type QuestionAnswers } from '~/server/utils/registrationForms'
import { REGISTRATION_PERIOD_STATES, REGISTRATION_SOURCES, REGISTRATION_STATUSES, SESSION_ROLES, isClosedSessionStatus } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'
import { isInvitationOverdue, registrationLinkExpired, splitParticipantName } from '~/utils/registrations'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  REGISTRATION_AFFINITIES,
  normalizeRegistrationFormDefinition,
  type RegistrationFormDefinition
} from '~/utils/registrationForms'

// Même réponse pour un jeton inconnu, invalidé ou expiré : on ne dit pas pourquoi (ADR-0018)
export const INVALID_LINK_MESSAGE = 'Ce lien n’est pas valide.'

const TOKEN_PATTERN = /^[\w-]{43}$/

const publicRegistrationSelect = {
  id: true,
  status: true,
  source: true,
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
  questionAnswers: true,
  affinities: { select: { kind: true, text: true }, orderBy: { position: 'asc' as const } },
  availabilities: { select: { sessionId: true } },
  responseDueAt: true,
  respondedAt: true,
  confirmedAt: true,
  withdrawnById: true,
  formVersion: { select: { id: true, definition: true } },
  participant: {
    select: {
      name: true,
      userId: true,
      // Coordonnées du compte, pour préremplir une invitation (US-074)
      user: { select: { phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true, profileUpdatedAt: true } }
    }
  },
  session: { select: { name: true, date: true, location: { select: { name: true, address: true } } } },
  period: {
    select: {
      gameId: true,
      state: true,
      closesAt: true,
      scope: true,
      game: { select: { title: true, noteIntention: true } },
      sessions: { orderBy: { session: { date: 'asc' as const } }, select: { session: { select: { id: true, name: true, date: true, status: true } } } }
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
 * - une inscription reçue par le formulaire aussi : modifiable jusqu'à la clôture, retirée à tout moment (US-085) ;
 * - une inscription désistée ne permet plus rien.
 */
export function registrationPermissions(registration: { status: string, period: { state: string, closesAt: Date | null } }, now = new Date()) {
  const open = effectivePeriodState(registration.period, now) === REGISTRATION_PERIOD_STATES.open
  const invited = registration.status === REGISTRATION_STATUSES.invited
  const active = registration.status === REGISTRATION_STATUSES.confirmed || registration.status === REGISTRATION_STATUSES.received
  return {
    canAccept: invited,
    canDecline: invited,
    canEdit: active && open,
    canWithdraw: active
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
  return await freezeFormVersion(registration.period.gameId, versionId)
}

export async function freezeFormVersion(gameId: string, versionId: string | null) {
  if (versionId) return versionId
  try {
    return (await saveRegistrationFormDefinition(gameId, DEFAULT_REGISTRATION_FORM_DEFINITION)).version!.id
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode !== 409) throw error
    return (await getCurrentRegistrationForm(gameId)).version!.id
  }
}

// Ce que la page dit d'une inscription désistée, selon qui y a mis fin et quand
export function withdrawalReason(registration: Pick<PublicRegistration, 'confirmedAt' | 'withdrawnById'> & { source?: string }) {
  if (registration.confirmedAt) return registration.withdrawnById ? 'removed' : 'withdrawn'
  // Inscription par le formulaire, retirée avant toute sélection (US-085)
  if (registration.source === REGISTRATION_SOURCES.form) return registration.withdrawnById ? 'removed' : 'retracted'
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
  // Invitation sans réponse d'une personne qui a enregistré ses coordonnées : elles préremplissent le formulaire
  const profile = !answered && registration.participant.user?.profileUpdatedAt ? registration.participant.user : null
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
    // Disponibilités d'une inscription par le formulaire à plusieurs sessions (R10)
    availability: registration.status === REGISTRATION_STATUSES.received && asksAvailability(registration.period)
      ? { sessions: registration.period.sessions.map((link) => link.session).filter((session) => !isClosedSessionStatus(session.status)) }
      : null,
    answers: {
      email: registration.email,
      firstName: answered ? registration.firstName : registration.firstName ?? prefill.firstName,
      lastName: answered ? registration.lastName : registration.lastName ?? prefill.lastName,
      facebookName: registration.facebookName,
      phone: registration.phone ?? profile?.phone ?? null,
      emergencyContactName: registration.emergencyContactName ?? profile?.emergencyContactName ?? null,
      emergencyContactPhone: registration.emergencyContactPhone ?? profile?.emergencyContactPhone ?? null,
      dietary: registration.dietary ?? profile?.dietary ?? null,
      healthConsent: Boolean(registration.healthConsentAt ?? profile?.healthConsentAt),
      charterAccepted: Boolean(registration.charterAcceptedAt),
      affinities: groupAffinities(registration.affinities),
      questionAnswers: (registration.questionAnswers ?? {}) as QuestionAnswers,
      availableSessionIds: registration.availabilities.map((availability) => availability.sessionId)
    }
  }
}

// Affinités d'une inscription, une liste de lignes par sorte (US-082)
export function groupAffinities(rows: Array<{ kind: string, text: string }>) {
  const grouped = Object.fromEntries(REGISTRATION_AFFINITIES.map(({ key }) => [key, [] as string[]])) as AffinityAnswers
  for (const row of rows) grouped[row.kind as keyof AffinityAnswers]?.push(row.text)
  return grouped
}

export type RegistrationAnswers = {
  affinities?: AffinityAnswers
  questionAnswers?: QuestionAnswers
  // Inscription par le formulaire : sessions où la personne est disponible (R10) ; absent, rien ne change
  availableSessionIds?: string[]
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
// updateAccount : réponse faite connecté au compte rattaché (US-072) ; par le lien personnel, le compte ne change pas
export async function saveRegistrationAnswers(registration: PublicRegistration, versionId: string, allAnswers: RegistrationAnswers, definition: RegistrationFormDefinition, updateAccount = false) {
  const now = new Date()
  const accepting = registration.status === REGISTRATION_STATUSES.invited
  const { affinities, questionAnswers, availableSessionIds, ...answers } = allAnswers
  const data = {
    ...answers,
    // Réponses aux questions propres au jeu (US-081) ; les affinités sont rangées à part (US-082)
    questionAnswers: questionAnswers ?? {},
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
    // Chaque enregistrement remplace les affinités : une ligne par personne ou relation citée (ADR-0045)
    await tx.registrationAffinity.deleteMany({ where: { registrationId: registration.id } })
    const rows = Object.entries(affinities ?? {}).flatMap(([kind, lines]) => lines.map((text, position) => ({ registrationId: registration.id, kind, text, position })))
    if (rows.length) await tx.registrationAffinity.createMany({ data: rows })
    if (availableSessionIds) {
      await tx.registrationAvailability.deleteMany({ where: { registrationId: registration.id } })
      if (availableSessionIds.length) {
        await tx.registrationAvailability.createMany({ data: availableSessionIds.map((sessionId) => ({ registrationId: registration.id, sessionId })) })
      }
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

  // Réponse depuis le compte : elle met aussi à jour ses coordonnées, recopiées ensuite partout (US-074). Pas par
  // le lien personnel, qui peut avoir été transmis
  const linked = updateAccount ? await prisma.participant.findUnique({ where: { id: registration.participantId }, select: { userId: true } }) : null
  if (linked?.userId) await updateProfileFromAnswers(linked.userId, answers, definition)

  return { accepted: accepting }
}

// Coordonnées du compte reprises d'une réponse faite connectée ; un champ que ce formulaire ne demande pas ne les touche pas
export async function updateProfileFromAnswers(userId: string, answers: RegistrationAnswers, definition: RegistrationFormDefinition) {
  const now = new Date()
  const asked = normalizeRegistrationFormDefinition(definition).standardFields
  const answeredName = [answers.firstName, answers.lastName].filter(Boolean).join(' ').trim()
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(answeredName ? { name: answeredName } : {}),
      ...(asked.phone.asked ? { phone: answers.phone } : {}),
      ...(asked.emergencyContact.asked ? { emergencyContactName: answers.emergencyContactName, emergencyContactPhone: answers.emergencyContactPhone } : {}),
      ...(asked.dietary.asked ? { dietary: answers.dietary, healthConsentAt: answers.dietary ? now : null } : {}),
      profileUpdatedAt: now
    }
  })
  await syncProfileToParticipants(userId)
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
