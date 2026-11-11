import { inSentence } from '~/utils/sessionLabels'
import { labelNestedSessions, labelSession, labelSessions, sessionLabelsFor } from '~/server/utils/sessionLabels'
import { gamePhotoInformation } from '~/utils/photoInformation'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { accountIdForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { sendEmail } from '~/server/utils/email'
import { findParticipantByEmail, hashRegistrationToken, notifyGameTeam } from '~/server/utils/registrations'
import { validatedPlaces } from '~/server/utils/sessionPayments'
import { answerAvailability, availabilitySchema } from '~/server/utils/registrationAvailability'
import { replaceAffinities } from '~/server/utils/registrationAffinities'
import { countPlayableCharacters, offeredSessions, takenSeatsWhere } from '~/server/utils/registrationPeriods'
import { joinSession, lockSession } from '~/server/utils/registrationSelection'
import { readZodBody } from '~/server/utils/schemas'
import { REGISTRATION_ANSWERS, REGISTRATION_CANCELLABLE_STATUSES, REGISTRATION_SESSION_STATUSES as LINE, REGISTRATION_STATUSES, SESSION_STATUSES, includesValue } from '~/utils/domain'
import { isUpcomingSession, startOfDay } from '~/utils/registrationPeriods'
import { canConfirmPlace, isResponseOverdue, splitParticipantName, visibleLineStatus } from '~/utils/registrations'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  REGISTRATION_BALANCE_ANY,
  REGISTRATION_AFFINITIES,
  normalizeRegistrationFormDefinition,
  type RegistrationFormDefinition
} from '~/utils/registrationForms'
import { withGameValues } from '~/server/utils/participantValues'

// Même réponse pour un jeton inconnu ou invalidé : on ne dit pas pourquoi (ADR-0018)
export const INVALID_LINK_MESSAGE = 'Ce lien n’est pas valide.'

const TOKEN_PATTERN = /^[\w-]{43}$/

const sessionView = { id: true, date: true, status: true, location: { select: { name: true, address: true } } } as const

const publicRegistrationSelect = {
  id: true,
  status: true,
  source: true,
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
  balancePreference: true,
  affinities: { select: { kind: true, text: true }, orderBy: { position: 'asc' as const } },
  responseDueAt: true,
  respondedAt: true,
  withdrawnById: true,
  // Jeu de l'inscription, que ses lignes reçoivent (US-195)
  gameId: true,
  invitedSession: { select: sessionView },
  sessionLines: {
    orderBy: { session: { date: 'asc' as const } },
    select: {
      sessionId: true,
      status: true,
      answer: true,
      announcedStatus: true,
      cancelledById: true,
      responseDueAt: true,
      confirmedAt: true,
      session: { select: sessionView }
    }
  },
  participant: {
    select: {
      id: true,
      name: true,
      userId: true,
      // Coordonnées du compte, pour préremplir une invitation (US-074)
      user: { select: { phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true, profileUpdatedAt: true } }
    }
  },
  period: {
    select: {
      id: true,
      gameId: true,
      state: true,
      game: { select: { title: true, noteIntention: true, photoRetentionMonths: true, contactEmail: true, owner: { select: { email: true } } } }
    }
  }
} as const

export type PublicRegistration = NonNullable<Awaited<ReturnType<typeof findRegistrationByToken>>>

export async function findRegistrationByToken(token: string | undefined) {
  if (!token || !TOKEN_PATTERN.test(token)) return null

  // Nom tenu par l'équipe du jeu de l'inscription (ADR-0086)
  return await withGameValues(await prisma.registration.findFirst({
    where: { links: { some: { tokenHash: hashRegistrationToken(token) } } },
    select: publicRegistrationSelect
  }))
}

/**
 * Inscription d'une fiche rattachée au compte (US-072, ADR-0041) : même sélection que le lien personnel,
 * sans l'expiration du lien. Une inscription d'une autre fiche répond comme une inconnue.
 */
export async function requireMyRegistration(userId: string, id: string | undefined) {
  const registration = id
    ? await withGameValues(await prisma.registration.findFirst({ where: { id, participant: { userId } }, select: publicRegistrationSelect }))
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
 * Ce que permet le lien (R14, ADR-0018), pour le jeu ; ce qu'il permet pour une session est sur sa ligne :
 * - une invitation sans réponse s'accepte ou se décline, même après l'échéance, tant que les orgas ne l'ont pas libérée ;
 * - dans le vivier, la personne modifie ses réponses à tout moment, même vivier fermé, et peut le quitter ;
 * - sortie du vivier, plus rien.
 */
export function registrationPermissions(registration: { status: string }) {
  const invited = registration.status === REGISTRATION_STATUSES.invited
  const inPool = registration.status === REGISTRATION_STATUSES.received
  return { canAccept: invited, canDecline: invited, canEdit: inPool, canLeave: inPool }
}

/**
 * Sessions d'une personne telles qu'elle les voit (R28, ADR-0047) : ce qui lui a été annoncé, sinon sa dernière réponse.
 * Une décision pas encore annoncée ne se voit pas.
 */
export function visibleSessionLines(lines: PublicRegistration['sessionLines'], now = new Date()) {
  return lines.flatMap((line) => {
    const status = visibleLineStatus(line)
    if (!status) return []
    const confirmable = canConfirmPlace(line)
    const toConfirm = confirmable || status === LINE.retained
    return [{
      sessionId: line.sessionId,
      session: line.session,
      status,
      // Une échéance ne se montre qu'avec la place à confirmer
      responseDueAt: toConfirm ? line.responseDueAt : null,
      overdue: confirmable && isResponseOverdue(line, now),
      confirmedAt: status === LINE.confirmed ? line.confirmedAt : null,
      canConfirmPlace: confirmable,
      canCancel: includesValue(REGISTRATION_CANCELLABLE_STATUSES, status) && line.session.status === SESSION_STATUSES.scheduled
    }]
  })
}

// Case cochée pour une session : sa dernière réponse (R28), sauf si elle a annulé depuis : elle peut alors s'y redire disponible (R19)
const saysAvailable = (line: PublicRegistration['sessionLines'][number]) => line.answer === REGISTRATION_ANSWERS.available && visibleLineStatus(line) !== LINE.cancelled

// La personne n'annule que ce qu'elle voit, pour une session à venir : le refus ne révèle rien d'une décision non annoncée (R28)
export function assertCanCancelSession(registration: PublicRegistration, sessionId: string) {
  if (!visibleSessionLines(registration.sessionLines).some((line) => line.sessionId === sessionId && line.canCancel)) {
    throw createError({ statusCode: 409, message: 'Il n’y a pas de présence à annuler pour cette session.' })
  }
}

// Sessions que le questionnaire propose à cette personne (R7), et celle que vise son invitation (R4)
async function proposedSessions(registration: PublicRegistration) {
  const offered = await offeredSessions(registration.period.id)
  const invitedTo = registration.status === REGISTRATION_STATUSES.invited ? registration.invitedSession : null
  return invitedTo && isUpcomingSession(invitedTo) && !offered.some((session) => session.id === invitedTo.id)
    ? [...await labelSessions(prisma, [invitedTo]), ...offered]
    : offered
}

// Disponibilités envoyées par la personne, parmi ce qu'on lui propose (R7) ; aucune n'est obligatoire
export async function readAvailability(event: H3Event, registration: PublicRegistration) {
  const proposed = await proposedSessions(registration)
  return (await readZodBody(event, availabilitySchema(proposed.map((session) => session.id)))).availableSessionIds
}

// Définition à remplir : toujours la version en vigueur (R15). Les anciennes réponses sont reprises, les nouvelles questions
// s'ajoutent, et la version change seulement quand la personne enregistre
async function formForRegistration(registration: PublicRegistration) {
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

// Ce que la page dit d'une personne sortie du vivier, selon qui y a mis fin et quand
export function withdrawalReason(registration: Pick<PublicRegistration, 'charterAcceptedAt' | 'withdrawnById'>) {
  // Elle avait répondu au questionnaire
  if (registration.charterAcceptedAt) return registration.withdrawnById ? 'removed' : 'left'
  // Invitation libérée par l'équipe, ou déclinée
  return registration.withdrawnById ? 'released' : 'declined'
}

// Ses sessions, avec « inscrite validée » calculé des paiements (R18) : mêmes libellés que l'équipe
export async function withValidatedSessions<T extends { sessionId: string, status: string }>(participantId: string, lines: T[]) {
  const isValidated = await validatedPlaces(lines.filter((line) => line.status === LINE.confirmed).map(({ sessionId }) => ({ sessionId, participantId })))
  return lines.map((line) => ({ ...line, validated: line.status === LINE.confirmed && isValidated(line.sessionId, participantId) }))
}

// Données montrées à la personne : les siennes et celles du jeu, jamais celles des autres inscrits
export async function exposePublicRegistration(registration: PublicRegistration, now = new Date()) {
  const game = { title: registration.period.game.title }
  if (registration.status === REGISTRATION_STATUSES.withdrawn) {
    // Refus, invitation libérée, sortie du vivier, ou retrait par l'équipe : seul le message change
    return { status: registration.status, game, withdrawalReason: withdrawalReason(registration) }
  }

  const prefill = splitParticipantName(registration.participant.name)
  const answered = Boolean(registration.respondedAt)
  // Invitation sans réponse d'une personne qui a enregistré ses coordonnées : elles préremplissent le formulaire
  const profile = !answered && registration.participant.user?.profileUpdatedAt ? registration.participant.user : null
  const proposed = await proposedSessions(registration)
  const proposedIds = new Set(proposed.map((session) => session.id))
  return {
    status: registration.status,
    game: { ...game, noteIntention: registration.period.game.noteIntention, photoInformation: gamePhotoInformation(registration.period.game) },
    poolState: registration.period.state,
    responseDueAt: registration.status === REGISTRATION_STATUSES.invited ? registration.responseDueAt : null,
    overdue: registration.status === REGISTRATION_STATUSES.invited && isResponseOverdue(registration, now),
    invitedSession: registration.status === REGISTRATION_STATUSES.invited && registration.invitedSession ? await labelSession(prisma, registration.invitedSession) : null,
    // Statut par session (R17, R28)
    sessions: await labelNestedSessions(prisma, await withValidatedSessions(registration.participantId, visibleSessionLines(registration.sessionLines, now))),
    ...registrationPermissions(registration),
    definition: await registrationFormDefinition(registration),
    // Disponibilités (R7) : absentes s'il n'y a aucune session à proposer
    availability: proposed.length ? { sessions: proposed.map(({ id, label, date }) => ({ id, label, date })) } : null,
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
      // Réponse déjà donnée : « peu importe » se relit comme tel
      balancePreference: registration.balancePreference ?? (answered ? REGISTRATION_BALANCE_ANY : null),
      // Sa dernière réponse (R28) : une décision non annoncée ne se devine pas ici
      availableSessionIds: registration.sessionLines
        .filter((line) => saysAvailable(line) && proposedIds.has(line.sessionId))
        .map((line) => line.sessionId)
    }
  }
}

// Affinités d'une inscription, une liste de lignes par sorte (US-082)
export function groupAffinities(rows: Array<{ kind: string, text: string }>) {
  const grouped = Object.fromEntries([...REGISTRATION_AFFINITIES.map(({ key }) => key), 'refusedRelationTypes'].map((key) => [key, [] as string[]])) as AffinityAnswers
  for (const row of rows) grouped[row.kind as keyof AffinityAnswers]?.push(row.text)
  return grouped
}

export type RegistrationAnswers = {
  affinities?: AffinityAnswers
  questionAnswers?: QuestionAnswers
  // Sessions où la personne est disponible (R7) ; absent, rien ne change
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
  const permissions = registrationPermissions(registration)
  if (!permissions.canAccept && !permissions.canEdit) {
    throw createError({ statusCode: 409, message: 'Votre inscription ne peut plus être modifiée.' })
  }
  return await formForRegistration(registration)
}

/**
 * Enregistre les réponses au questionnaire (R14) : répondre à une invitation fait entrer dans le vivier. Les informations
 * restent sur l'inscription ; seul l'email remonte sur la fiche du participant : c'est l'adresse donnée par la personne
 * qui fait foi pour tous les envois (R12 de SPEC-001). Les disponibilités suivent R29, et l'invitation pour une session
 * inscrite la personne si elle s'y dit disponible (R4).
 * updateAccount : réponse faite connecté au compte rattaché (US-072) ; par le lien personnel, le compte ne change pas
 */
export async function saveRegistrationAnswers(registration: PublicRegistration, versionId: string, allAnswers: RegistrationAnswers, definition: RegistrationFormDefinition, updateAccount = false) {
  const now = new Date()
  const accepting = registration.status === REGISTRATION_STATUSES.invited
  const { affinities, questionAnswers, availableSessionIds, ...answers } = allAnswers
  // Adresse déjà celle d'une autre fiche (une seule fiche par adresse, SPEC-022) : la fiche et l'inscription gardent la
  // leur, jusqu'à ce que la personne prouve que l'autre adresse est la sienne (choix de l'utilisatrice, US-243)
  const other = await findParticipantByEmail(answers.email)
  const addressTaken = Boolean(other && other.id !== registration.participantId)
  const data = {
    ...answers,
    ...(addressTaken ? { email: registration.email } : {}),
    // Réponses aux questions propres au jeu (US-081) ; les affinités sont rangées à part (US-082)
    questionAnswers: questionAnswers ?? {},
    // Le consentement santé n'a de sens qu'avec des allergies déclarées ; il date du dernier enregistrement
    healthConsentAt: answers.dietary ? now : null,
    charterAcceptedAt: registration.charterAcceptedAt ?? now,
    formVersionId: versionId,
    ...(accepting ? { status: REGISTRATION_STATUSES.received, respondedAt: now, invitedSessionId: null } : {})
  }
  const proposed = availableSessionIds ? await proposedSessions(registration) : []
  const seats = accepting && registration.invitedSession ? await countPlayableCharacters(registration.period.gameId) : 0
  // Une adresse gardée (prise par une autre fiche) n'est pas un changement de réponse
  const changed = !accepting && answersDiffer(registration, addressTaken ? { ...allAnswers, email: registration.email } : allAnswers, definition)
  const previouslyChecked = new Set(registration.sessionLines.filter(saysAvailable).map((line) => line.sessionId))

  const outcome = await prisma.$transaction(async (tx) => {
    // Le statut est revérifié dans l'écriture : une libération ou une sortie simultanée l'emporte
    const { count } = await tx.registration.updateMany({ where: { id: registration.id, status: registration.status }, data })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
    }
    // Chaque enregistrement remplace les affinités : une ligne par personne ou relation citée (ADR-0045) ; une ligne
    // inchangée garde son rattachement (ADR-0049)
    await replaceAffinities(tx, registration.id, affinities)

    const kept: string[] = []
    const removed: string[] = []
    for (const session of proposed) {
      const checked = availableSessionIds!.includes(session.id)
      // Une date jamais cochée reste sans réponse (R7)
      if (checked === previouslyChecked.has(session.id)) continue
      const effect = await answerAvailability(tx, registration, session.id, checked, now)
      if (effect === 'kept') kept.push(session.id)
      if (effect === 'removed') removed.push(session.id)
    }

    // Castée ou inscrite pour une session à venir : le repère apparaît, et l'équipe est prévenue (R16)
    const changedLines = changed
      ? await tx.registrationSession.findMany({
          where: { registrationId: registration.id, status: { in: [LINE.retained, LINE.confirmed] }, session: { status: SESSION_STATUSES.scheduled, OR: [{ date: null }, { date: { gte: startOfDay(now) } }] } },
          select: { id: true, sessionId: true }
        })
      : []
    if (changedLines.length) {
      await tx.registrationSession.updateMany({ where: { id: { in: changedLines.map((line) => line.id) } }, data: { answersChangedAt: now } })
    }

    // Invitation pour une session (R4) : inscrite si elle s'y dit disponible et qu'il reste une place
    let fullSession: string | null = null
    const invitedTo = accepting ? registration.invitedSession : null
    if (invitedTo && availableSessionIds?.includes(invitedTo.id)) {
      await lockSession(tx, invitedTo.id)
      if (await tx.registrationSession.count({ where: takenSeatsWhere([invitedTo.id]) }) >= seats) {
        fullSession = invitedTo.id
      } else {
        await tx.registrationSession.update({
          where: { registrationId_sessionId: { registrationId: registration.id, sessionId: invitedTo.id } },
          data: { status: LINE.confirmed, confirmedAt: now, announcedStatus: LINE.confirmed, announcedAt: now }
        })
        await joinSession(tx, registration, invitedTo.id)
      }
    }

    // L'adresse donnée fait foi ; le rattachement au compte la suit (US-070). Prise par une autre fiche : rien ne change
    if (!addressTaken) await tx.participant.update({ where: { id: registration.participantId }, data: { email: answers.email, userId: await accountIdForEmail(answers.email) } })
    return { kept, removed, fullSession, changedSessions: changedLines.map((line) => line.sessionId) }
  })

  // Réponse depuis le compte : elle met aussi à jour ses coordonnées, recopiées ensuite partout (US-074). Pas par
  // le lien personnel, qui peut avoir été transmis
  const linked = updateAccount ? await prisma.participant.findUnique({ where: { id: registration.participantId }, select: { userId: true } }) : null
  if (linked?.userId) await updateProfileFromAnswers(linked.userId, answers, definition)

  const name = registration.participant.name
  const gameTitle = registration.period.game.title
  // Les sessions se lisent par leur libellé, calculé (SPEC-021)
  const labels = await sessionLabelsFor(prisma, [...outcome.kept, ...outcome.removed, ...outcome.changedSessions, ...(outcome.fullSession ? [outcome.fullSession] : [])])
  const labelOf = (id: string) => labels.get(id) ?? 'Session'
  notifyRemovedFromCast(registration, outcome.removed.map(labelOf))
  // Sans recopier les réponses : l'équipe les lit dans Limbus
  if (outcome.changedSessions.length) {
    notifyTeam(registration, `${name} a modifié ses réponses au questionnaire de « ${gameTitle} », alors qu’une place lui est retenue ou confirmée pour ${outcome.changedSessions.map((session) => `« ${labelOf(session)} »`).join(', ')}. Relisez-les depuis la page Inscriptions, et revoyez son casting si besoin.`, `Réponses modifiées : ${name} (${gameTitle})`)
  }
  if (outcome.fullSession) {
    notifyTeam(registration, `${name} a répondu à votre invitation pour la ${inSentence(labelOf(outcome.fullSession))} (${gameTitle}), mais elle est complète : la personne reste pré-inscrite. Créez un personnage pour ajouter une place.`, `Session complète : ${name} (${gameTitle})`)
  }

  return { accepted: accepting, keptSessions: outcome.kept.map(labelOf) }
}

function notifyTeam(registration: PublicRegistration, text: string, subject: string) {
  void notifyGameTeam(registration.period.gameId, text, subject)
    .catch((error) => console.error('[inscription] équipe non prévenue', { registrationId: registration.id, error: (error as Error)?.message }))
}

// Retenue sans annonce puis plus disponible (R29) : l'équipe le sait, la personne n'apprend pas qu'elle était retenue
function notifyRemovedFromCast(registration: PublicRegistration, sessionLabelList: string[]) {
  if (!sessionLabelList.length) return
  const name = registration.participant.name
  const gameTitle = registration.period.game.title
  notifyTeam(registration, `${name} n’est plus disponible pour ${sessionLabelList.map((session) => `« ${session} »`).join(', ')} (${gameTitle}) : la personne est retirée du cast, et le personnage qui lui était réservé est libre.`, `Plus disponible : ${name} (${gameTitle})`)
}

/**
 * Réponse à une demande de disponibilités pour une session (R11, R29). Une session proposée accepte toute réponse. Une
 * session refermée depuis accepte encore « Pas disponible » d'une personne qui y a une ligne, et ne la fait pas revenir.
 */
export async function answerSessionAvailability(registration: PublicRegistration, sessionId: string, available: boolean) {
  if (!registrationPermissions(registration).canEdit) {
    throw createError({ statusCode: 409, message: 'Votre inscription ne peut plus être modifiée.' })
  }
  const proposed = (await proposedSessions(registration)).some((session) => session.id === sessionId)
  const line = registration.sessionLines.find((candidate) => candidate.sessionId === sessionId)
  const comesBack = line?.status === LINE.unavailable || line?.status === LINE.cancelled
  if (!proposed && (line?.session.status !== SESSION_STATUSES.scheduled || (available && comesBack))) {
    throw createError({ statusCode: 409, message: 'Cette session n’est plus proposée.' })
  }
  const effect = await prisma.$transaction(async (tx) => {
    // Une sortie du vivier simultanée l'emporte ; la version de la personne suit ses réponses : un assistant qui l'a lue
    // avant ne les écrase pas
    const { count } = await tx.registration.updateMany({ where: { id: registration.id, status: registration.status }, data: { updatedAt: new Date() } })
    if (!count) {
      throw createError({ statusCode: 409, message: 'Votre inscription a changé entre-temps : rechargez la page.' })
    }
    return await answerAvailability(tx, registration, sessionId, available)
  })
  if (effect === 'removed') notifyRemovedFromCast(registration, [(await labelSession(prisma, line!.session)).label])
  return effect
}

// Objet aux clés triées, listes vides retirées : deux réponses identiques se comparent à l'identique
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== 'object') return value === '' ? null : value ?? null
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null && item !== '' && !(Array.isArray(item) && !item.length))
    .sort(([left], [right]) => left.localeCompare(right))
  return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]))
}

// Ce que la personne envoie diffère-t-il de ce qui est enregistré ? Ses disponibilités suivent leurs propres règles (R29),
// et la réponse à une question retirée du questionnaire n'est pas un changement de sa part (R15)
function answersDiffer(registration: PublicRegistration, { affinities, questionAnswers, availableSessionIds: _availability, ...fields }: RegistrationAnswers, definition: RegistrationFormDefinition) {
  const saved = Object.fromEntries(Object.keys(fields).map((key) => [key, registration[key as keyof PublicRegistration]]))
  const asked = new Set(definition.questions?.map((question) => question.id))
  const savedAnswers = Object.fromEntries(Object.entries((registration.questionAnswers ?? {}) as QuestionAnswers).filter(([id]) => asked.has(id)))
  const before = { ...saved, questionAnswers: savedAnswers, affinities: groupAffinities(registration.affinities) }
  const after = { ...fields, questionAnswers: questionAnswers ?? {}, affinities: affinities ?? {} }
  return JSON.stringify(canonical(before)) !== JSON.stringify(canonical(after))
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

// Décliner une invitation sans réponse : la personne n'entre pas dans le vivier
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

export function registrationConfirmationEmailText(params: {
  firstName: string | null
  gameTitle: string
  url: string
}) {
  return [
    `Bonjour${params.firstName ? ` ${params.firstName}` : ''},`,
    '',
    `Vos réponses au questionnaire de « ${params.gameTitle} » sont enregistrées.`,
    '',
    'Ce lien personnel vous permet de revoir et de modifier vos réponses à tout moment :',
    params.url,
    '',
    'Ce lien vous est propre : ne le transférez pas.'
  ].join('\n')
}

// L'email de confirmation n'empêche pas la réponse : un échec est seulement signalé.
// url : le lien personnel, ou l'espace « Je participe » pour une réponse faite depuis le compte (US-072)
export async function sendRegistrationConfirmationEmail(registration: PublicRegistration, answers: RegistrationAnswers, url: string) {
  try {
    const result = await sendEmail({
      to: answers.email,
      subject: `Réponses enregistrées : ${registration.period.game.title}`,
      text: registrationConfirmationEmailText({ firstName: answers.firstName, gameTitle: registration.period.game.title, url })
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
