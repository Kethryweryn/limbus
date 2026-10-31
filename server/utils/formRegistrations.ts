import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuthUser } from '~/server/utils/auth'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { sendEmail } from '~/server/utils/email'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { accountIdForEmail } from '~/server/utils/participantAccounts'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { createRegistrationToken, findParticipantByEmail, hashRegistrationToken, notifyGameTeam } from '~/server/utils/registrations'
import { freezeFormVersion, updateProfileFromAnswers, type RegistrationAnswers } from '~/server/utils/publicRegistrations'
import { getCurrentRegistrationForm, registrationAnswerSchema, type AffinityAnswers, type QuestionAnswers } from '~/server/utils/registrationForms'
import { readZodBody } from '~/server/utils/schemas'
import { asksAvailability, availabilitySchema } from '~/server/utils/registrationAvailability'
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_SCOPES, REGISTRATION_PERIOD_STATES, REGISTRATION_SOURCES, REGISTRATION_STATUSES, SESSION_STATUSES, isClosedSessionStatus } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'
import { splitParticipantName } from '~/utils/registrations'
import { youtubeVideoId } from '~/utils/urls'

// Formulaire public d'une période en mode formulaire (US-084, US-085, ADR-0046)

const DAY_MS = 24 * 60 * 60 * 1000
export const REGISTRATION_REQUEST_TTL_MS = 7 * DAY_MS
const PUBLIC_ID_PATTERN = /^[\w-]{1,32}$/
const TOKEN_PATTERN = /^[\w-]{43}$/

const sessionSelect = { id: true, name: true, date: true, status: true, location: { select: { name: true, address: true } } } as const

export const formPeriodSelect = {
  id: true,
  gameId: true,
  name: true,
  scope: true,
  entryMode: true,
  state: true,
  closesAt: true,
  notifyTeam: true,
  publicId: true,
  game: { select: { id: true, title: true, slug: true, noteIntention: true, teaserUrl: true, ownerId: true } },
  sessions: { orderBy: { session: { date: 'asc' as const } }, select: { session: { select: sessionSelect } } }
} as const

type FormPeriod = NonNullable<Awaited<ReturnType<typeof findFormPeriod>>>

// Une période en brouillon, ou en mode invitation, répond comme un lien inconnu (R32)
export async function findFormPeriod(publicId: string | undefined) {
  if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) return null
  const period = await prisma.registrationPeriod.findUnique({ where: { publicId }, select: formPeriodSelect })
  if (!period || period.entryMode !== REGISTRATION_ENTRY_MODES.form || period.state === REGISTRATION_PERIOD_STATES.draft) return null
  return period
}

export async function requireFormPeriod(publicId: string | undefined) {
  const period = await findFormPeriod(publicId)
  if (!period) {
    throw createError({ statusCode: 404, message: 'Ce lien d’inscription n’est pas valide.' })
  }
  return period
}

/**
 * Sessions que le formulaire montre : celles de la période ; pour l'inscription permanente, pour information,
 * les sessions à venir du jeu qui n'ont pas leur propre période (R30, R31)
 */
export async function formPeriodSessions(period: Pick<FormPeriod, 'scope' | 'gameId' | 'sessions'>, now = new Date()) {
  // Une session annulée ou terminée n'est plus proposée
  if (period.scope !== REGISTRATION_PERIOD_SCOPES.game) return period.sessions.map((link) => link.session).filter((session) => !isClosedSessionStatus(session.status))
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return await prisma.session.findMany({
    where: { gameId: period.gameId, registrationPeriodLink: null, status: SESSION_STATUSES.scheduled, OR: [{ date: null }, { date: { gte: today } }] },
    orderBy: { date: 'asc' },
    select: sessionSelect
  })
}

// Compte connecté à l'adresse confirmée, sinon personne : le formulaire reste ouvert à tous
export async function optionalAccount(event: H3Event) {
  try {
    return await requireAuthUser(event)
  } catch {
    return null
  }
}

async function accountPrefill(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true }
  })
  const { firstName, lastName } = splitParticipantName(user.name)
  return {
    email: user.email,
    firstName,
    lastName,
    phone: user.phone,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    dietary: user.dietary,
    healthConsent: Boolean(user.dietary && user.healthConsentAt)
  }
}

// Ce que le lien de diffusion montre : le jeu, la période et le formulaire, jamais rien des autres inscrits
export async function exposeFormPeriod(period: FormPeriod, account: { id: string } | null, now = new Date()) {
  const form = await getCurrentRegistrationForm(period.gameId)
  return {
    publicId: period.publicId,
    name: period.name,
    state: effectivePeriodState(period, now) === REGISTRATION_PERIOD_STATES.open ? 'open' : 'closed',
    permanent: period.scope === REGISTRATION_PERIOD_SCOPES.game,
    closesAt: period.closesAt,
    game: { title: period.game.title, noteIntention: period.game.noteIntention },
    sessions: await formPeriodSessions(period, now),
    asksAvailability: asksAvailability(period),
    definition: form.definition,
    ogImageUrl: youtubeVideoId(period.game.teaserUrl) ? absoluteAppUrl(`/api/public/periods/${period.publicId}/teaser-thumbnail`) : null,
    url: absoluteAppUrl(`/i/${period.publicId}`),
    account: account ? await accountPrefill(account.id) : null
  }
}

type StoredAnswers = RegistrationAnswers & { affinities: AffinityAnswers, questionAnswers: QuestionAnswers, availableSessionIds: string[] }

// Une demande non confirmée sous 7 jours disparaît (R11) : à chaque envoi du formulaire et à chaque connexion
export async function purgeRegistrationRequests(now = new Date()) {
  await prisma.registrationRequest.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - REGISTRATION_REQUEST_TTL_MS) } } })
}

function requestEmailText(params: { gameTitle: string, url: string }) {
  return [
    'Bonjour,',
    '',
    `Vous venez de vous inscrire à « ${params.gameTitle} ». Pour que l’équipe d’organisation reçoive votre inscription, confirmez votre adresse en ouvrant ce lien :`,
    params.url,
    '',
    'Ce même lien vous permet ensuite de consulter, modifier ou retirer votre inscription. Il vous est propre : ne le transférez pas.',
    '',
    'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message : sans confirmation, elle est supprimée sous 7 jours.'
  ].join('\n')
}

/**
 * Envoi du formulaire (US-084). Connectée, la personne est inscrite aussitôt ; sinon une demande attend la
 * confirmation de l'email, et la réponse est la même que l'adresse soit déjà inscrite ou non.
 */
export async function submitFormRegistration(event: H3Event, publicId: string | undefined) {
  setHeader(event, 'Cache-Control', 'no-store')
  // Par lien et par IP, avec un plafond large par IP : un groupe inscrit depuis le même wifi ne se bloque pas
  const windowMs = 10 * 60 * 1000
  assertRateLimit(event, { name: 'public-form-submit', limit: 10, windowMs, keyParts: [String(publicId).slice(0, 32)] })
  assertRateLimit(event, { name: 'public-form-submit-ip', limit: 100, windowMs })
  const period = await requireFormPeriod(publicId)
  if (effectivePeriodState(period) !== REGISTRATION_PERIOD_STATES.open) {
    throw createError({ statusCode: 409, message: 'Les inscriptions sont closes.' })
  }

  // Champ piège : invisible pour une personne, rempli par un robot, qui reçoit la même réponse sans effet
  const raw = await readBody<Record<string, unknown> | null>(event).catch(() => null)
  const form = await getCurrentRegistrationForm(period.gameId)
  const { charterAccepted: _charterAccepted, healthConsent: _healthConsent, ...answers } = await readZodBody(event, registrationAnswerSchema(form.definition))
  const { availableSessionIds } = await readZodBody(event, availabilitySchema(period))
  const account = await optionalAccount(event)
  if (typeof raw?.website === 'string' && raw.website.trim()) {
    return { received: Boolean(account), emailSent: !account }
  }

  const versionId = await freezeFormVersion(period.gameId, form.version?.id ?? null)
  if (account) {
    const stored = { ...answers, email: account.email, availableSessionIds }
    const result = await receiveRegistration(period, stored, versionId, null)
    // Déjà inscrite à un autre statut : rien n'a changé, ni l'inscription ni ses coordonnées
    if (!result?.applied) return { received: false, emailSent: false, alreadyRegistered: true }
    await updateProfileFromAnswers(account.id, stored, form.definition)
    return { received: true, emailSent: false }
  }

  await purgeRegistrationRequests()
  const { token, tokenHash } = createRegistrationToken()
  await prisma.registrationRequest.create({
    data: { periodId: period.id, email: answers.email, answers: { ...answers, availableSessionIds }, formVersionId: versionId, tokenHash }
  })
  const emailSent = await sendEmail({
    to: answers.email,
    subject: `Confirmez votre inscription : ${period.game.title}`,
    text: requestEmailText({ gameTitle: period.game.title, url: absoluteAppUrl(`/inscription/${token}`) })
  }).then((result) => result.sent, () => false)
  return { received: false, emailSent }
}

/**
 * Confirmation de l'email (US-085) : la demande devient l'inscription, et son jeton le lien personnel.
 * null pour un jeton inconnu ou une demande expirée.
 */
export async function confirmRegistrationRequest(token: string | undefined, now = new Date()) {
  if (!token || !TOKEN_PATTERN.test(token)) return null
  const request = await prisma.registrationRequest.findUnique({
    where: { tokenHash: hashRegistrationToken(token) },
    select: { id: true, email: true, answers: true, formVersionId: true, tokenHash: true, createdAt: true, period: { select: formPeriodSelect } }
  })
  if (!request || request.createdAt.getTime() < now.getTime() - REGISTRATION_REQUEST_TTL_MS) return null
  const answers = { ...(request.answers as StoredAnswers), email: request.email }
  return await receiveRegistration(request.period, answers, request.formVersionId, request.tokenHash, request.id)
}

const RESTARTABLE: string[] = [REGISTRATION_STATUSES.received, REGISTRATION_STATUSES.withdrawn]

/**
 * Inscription reçue (ADR-0046) : la personne est rapprochée de sa fiche par son email (R12), sinon une fiche est
 * créée dans le jeu. Une inscription reçue ou désistée repart avec les nouvelles réponses ; à un autre statut,
 * elle ne change pas et seul le lien personnel est renouvelé. requestId : la demande confirmée, supprimée ici.
 */
async function receiveRegistration(period: FormPeriod, answers: StoredAnswers, formVersionId: string | null, tokenHash: string | null, requestId?: string) {
  const { affinities, questionAnswers, availableSessionIds, ...standard } = answers
  const email = standard.email
  const matched = await findParticipantByEmail(period.game, email)
  const name = [standard.firstName, standard.lastName].filter(Boolean).join(' ').trim() || email.split('@')[0]!
  const slug = matched ? null : await generateUniqueSlug('participant', name)
  const userId = await accountIdForEmail(email)
  const now = new Date()
  // Disponibilités encore valides : une session retirée de la période entre l'envoi et la confirmation est ignorée
  const sessionIds = new Set(period.sessions.map((link) => link.session.id))
  const availability = asksAvailability(period) ? availableSessionIds.filter((id) => sessionIds.has(id)) : []

  const result = await prisma.$transaction(async (tx) => {
    if (requestId) {
      // Une demande ne se confirme qu'une fois : deux ouvertures simultanées du lien n'en font qu'une
      const { count } = await tx.registrationRequest.deleteMany({ where: { id: requestId } })
      if (!count) return null
    }
    const participant = matched
      ? await tx.participant.update({ where: { id: matched.id }, data: { email, userId }, select: { id: true, name: true } })
      : await tx.participant.create({ data: { name, slug: slug!, email, userId }, select: { id: true, name: true } })
    await tx.participantGame.upsert({
      where: { participantId_gameId: { participantId: participant.id, gameId: period.gameId } },
      update: {},
      create: { participantId: participant.id, gameId: period.gameId }
    })

    const existing = await tx.registration.findUnique({ where: { periodId_participantId: { periodId: period.id, participantId: participant.id } }, select: { id: true, status: true } })
    const data = {
      ...standard,
      status: REGISTRATION_STATUSES.received,
      healthConsentAt: standard.dietary ? now : null,
      charterAcceptedAt: now,
      formVersionId,
      questionAnswers,
      respondedAt: now,
      confirmedAt: null,
      withdrawnAt: null,
      withdrawnById: null,
      // Une nouvelle inscription : rien ne lui a encore été annoncé (ADR-0047)
      announcedStatus: null,
      announcedSessionId: null,
      announcedAt: null,
      ...(tokenHash ? { tokenHash } : {})
    }
    let registrationId: string
    let applied = true
    if (!existing) {
      registrationId = (await tx.registration.create({
        data: { ...data, periodId: period.id, participantId: participant.id, source: REGISTRATION_SOURCES.form },
        select: { id: true }
      })).id
    } else if (RESTARTABLE.includes(existing.status)) {
      registrationId = (await tx.registration.update({ where: { id: existing.id }, data, select: { id: true } })).id
    } else {
      applied = false
      registrationId = existing.id
      if (tokenHash) await tx.registration.update({ where: { id: existing.id }, data: { tokenHash } })
    }

    if (applied) {
      await tx.registrationAffinity.deleteMany({ where: { registrationId } })
      const rows = Object.entries(affinities ?? {}).flatMap(([kind, lines]) => lines.map((text, position) => ({ registrationId, kind, text, position })))
      if (rows.length) await tx.registrationAffinity.createMany({ data: rows })
      await tx.registrationAvailability.deleteMany({ where: { registrationId } })
      if (availability.length) await tx.registrationAvailability.createMany({ data: availability.map((sessionId) => ({ registrationId, sessionId })) })
    }
    return { registrationId, applied, participantName: participant.name }
  })

  // Après la réponse : la personne n'attend pas le serveur SMTP, et un échec ne change rien à son inscription
  if (result?.applied && period.notifyTeam) {
    void notifyGameTeam(
      period.gameId,
      [
        `${result.participantName} s’est inscrit·e à « ${period.game.title} » (période « ${period.name} »).`,
        '',
        `Son inscription est reçue : retrouvez-la dans les inscriptions du jeu, ${absoluteAppUrl('/registrations')}.`
      ].join('\n'),
      `Nouvelle inscription : ${result.participantName} (${period.game.title})`
    ).catch((error) => console.error('[inscription] équipe non prévenue', { periodId: period.id, error: (error as Error)?.message }))
  }
  return result
}

