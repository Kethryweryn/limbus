// Station Meridian, jeu de test « avant les sessions » : page publique, périodes d'inscription, questionnaire,
// sélection, tirage, affinités et relations (US-152, ADR-0066)
import { computeDraw, type DrawSessionInput, type DrawSettings } from '../../utils/registrationDraw'
import { REGISTRATION_STANDARD_FIELDS, type QuestionAnswers, type RegistrationFormDefinition } from '../../utils/registrationForms'
import {
  REGISTRATION_ENTRY_MODES as ENTRY,
  REGISTRATION_PERIOD_SCOPES,
  REGISTRATION_PERIOD_STATES as STATE,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES as SELECTION,
  REGISTRATION_SOURCES as SOURCE,
  REGISTRATION_STATUSES as STATUS,
  SESSION_ROLES,
  SESSION_STATUSES
} from '../../utils/domain'
import type { Prisma } from '../../generated/prisma/client'
import type { Db, StageContext } from './db'
import { daysFromNow } from './options'

// Générées pour que les repères du questionnaire aient assez de réponses. Toutes restent en example.test.
const FIRST_NAMES = ['Adèle', 'Bruno', 'Cécile', 'Damien', 'Estelle', 'Fabien', 'Gaëlle', 'Hector', 'Irène', 'Jules', 'Karine', 'Loïc', 'Maud', 'Nathan', 'Odile', 'Paul', 'Quentin']
const LAST_NAMES = ['Arnaud', 'Barbier']
const GENERATED_PEOPLE = LAST_NAMES.flatMap((lastName, lastIndex) => FIRST_NAMES.map((firstName, firstIndex) => {
  const local = `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const number = String(lastIndex * FIRST_NAMES.length + firstIndex + 1).padStart(2, '0')
  return { name: `${firstName} ${lastName}`, email: `${local}@example.test`, phone: `07 00 00 00 ${number}` }
}))

// Les comptes de test et les personnes sans compte qui reçoivent leurs emails, en plus des personnes générées
export const MERIDIAN_EXTRA_PEOPLE = [
  { name: 'Camille Bernard', email: 'camille.bernard@example.test', phone: '06 11 22 33 01' },
  { name: 'Lucie Moreau', email: 'lucie.moreau@example.test', phone: '06 11 22 33 02' },
  { name: 'Nicolas Martin', email: 'nicolas.martin@example.test', phone: '06 11 22 33 03' },
  { name: 'Sarah Petit', email: 'sarah.petit@example.test', phone: '06 11 22 33 04' },
  { name: 'Manon Richard', email: 'manon.richard@example.test', phone: '06 11 22 33 06' },
  ...GENERATED_PEOPLE
]

const ROLE_OPTIONS = ['Scientifique', 'Sécurité', 'Technique', 'Politique']
const THEME_OPTIONS = ['Science', 'Paranoïa', 'Coopération', 'Romance']

const BASE_QUESTIONS: NonNullable<RegistrationFormDefinition['questions']> = [
  { id: 'q-role', label: 'Quel type de rôle préférez-vous ?', type: 'single', required: true, options: ROLE_OPTIONS },
  // Presque tout le monde répond « Oui » : la question ne départage pas
  { id: 'q-enquete', label: 'Aimez-vous mener une enquête ?', type: 'single', required: false, options: ['Oui', 'Non'] }
]

const QUESTIONS: NonNullable<RegistrationFormDefinition['questions']> = [
  ...BASE_QUESTIONS,
  { id: 'q-tension', label: 'À quel point aimez-vous les situations de tension ?', type: 'scale', required: false, options: [] },
  // Dit presque la même chose que la précédente : les deux questions font doublon
  { id: 'q-pression', label: 'À quel point aimez-vous jouer sous la pression ?', type: 'scale', required: false, options: [] },
  { id: 'q-themes', label: 'Quels thèmes vous attirent ?', type: 'multiple', required: false, options: THEME_OPTIONS, shuffleOptions: true },
  // Volontairement mal écrite, pour la relecture : « d'accord », deux idées en une, quantifieur vague
  { id: 'q-nuit', label: 'Êtes-vous d\'accord pour jouer souvent de nuit et en extérieur ?', type: 'single', required: false, options: ['Oui', 'Non'] },
  { id: 'q-attentes', label: 'Qu\'attendez-vous de ce jeu ?', type: 'text', required: false, options: [] }
]

const STANDARD_FIELDS = Object.fromEntries(REGISTRATION_STANDARD_FIELDS.map(({ key }) =>
  [key, { asked: true, required: key === 'firstName' || key === 'lastName' }]
)) as RegistrationFormDefinition['standardFields']

const AFFINITIES = {
  wantWith: { asked: true, required: false },
  notWith: { asked: true, required: false },
  refusedRelations: { asked: true, required: false },
  avoid: { asked: true, required: false }
}

// Deux versions du formulaire : une inscription ancienne garde les questions de la première
export const MERIDIAN_FORM_DEFINITIONS: RegistrationFormDefinition[] = [
  { standardFields: STANDARD_FIELDS, questions: BASE_QUESTIONS },
  { standardFields: STANDARD_FIELDS, affinities: AFFINITIES, balance: { asked: true, required: false }, questions: QUESTIONS }
]

// Les réponses dépendent du rang de la personne, pour que deux rechargements donnent le même questionnaire
function answersFor(rank: number, fullForm: boolean): QuestionAnswers {
  // Beaucoup de scientifiques et de personnes en sécurité, peu de politiques : les rôles ne sont pas demandés également
  const role = ROLE_OPTIONS[[0, 0, 1, 0, 2, 1, 0, 3][rank % 8]!]!
  const answers: QuestionAnswers = { 'q-role': role, 'q-enquete': rank % 10 === 9 ? 'Non' : 'Oui' }
  if (!fullForm) return answers

  const tension = (rank * 3) % 5 + 1
  return {
    ...answers,
    'q-tension': tension,
    'q-pression': Math.min(5, tension + (rank % 7 === 6 ? 1 : 0)),
    'q-themes': THEME_OPTIONS.filter((_, index) => (rank >> index) % 2 === 0 || index === 0),
    'q-nuit': rank % 3 === 0 ? 'Non' : 'Oui',
    'q-attentes': rank % 4 === 0 ? 'Du jeu sous tension, sans temps mort.' : null
  }
}

export async function createMeridianStage(db: Db, context: StageContext) {
  const { gameId, title, ownerId, locationId, characters, people, profiles, makeSlug } = context
  const character = (name: string) => characters.find((row) => row.name === name)!.id

  await db.game.update({
    where: { id: gameId },
    data: {
      publicPage: true,
      publicShowSessions: true,
      publicShowRegistration: true,
      balanceAttribute: 'Ton du personnage',
      balanceValues: ['Posé', 'Tendu']
    }
  })

  const balanceValues: Array<[string, string]> = [
    ['Dr Lena Kovacs', 'Posé'], ['Eli Chen', 'Posé'], ['Jonas Pike', 'Posé'],
    ['Milo Varga', 'Tendu'], ['Samira Okonkwo', 'Tendu'], ['Nadia Sol', 'Tendu']
  ]
  for (const [name, balanceValue] of balanceValues) {
    await db.character.update({ where: { id: character(name) }, data: { balanceValue } })
  }

  await db.characterRelation.createMany({
    data: [
      { gameId, type: 'romance', fromCharacterId: character('Eli Chen'), fromLabel: 'Son compagnon', fromVisible: true, toCharacterId: character('Milo Varga'), toLabel: 'Son compagnon', toVisible: true },
      { gameId, type: 'rivalry', fromCharacterId: character('Samira Okonkwo'), fromLabel: 'Sa rivale', fromVisible: true, toCharacterId: character('Nadia Sol'), toLabel: 'Sa rivale', toVisible: false, description: 'Elles se disputent le contrôle de la station.' },
      { gameId, type: 'family', fromCharacterId: character('Dr Lena Kovacs'), fromLabel: 'Son frère', fromVisible: true, toCharacterId: character('Jonas Pike'), toLabel: 'Sa sœur', toVisible: true }
    ]
  })

  const form = await db.registrationForm.create({
    data: {
      gameId,
      versions: {
        create: MERIDIAN_FORM_DEFINITIONS.map((definition, index) => ({ number: index + 1, definition: definition as object }))
      }
    },
    select: { versions: { orderBy: { number: 'asc' }, select: { id: true } } }
  })
  const [oldVersionId, formVersionId] = form.versions.map((version) => version.id) as [string, string]

  // Eli et Jonas reçoivent exactement les mêmes liens : le questionnaire ne peut pas les distinguer
  const links: Array<[string, string, string]> = [
    ['q-role', 'Scientifique', 'Dr Lena Kovacs'], ['q-role', 'Scientifique', 'Eli Chen'], ['q-role', 'Scientifique', 'Jonas Pike'],
    ['q-role', 'Sécurité', 'Samira Okonkwo'],
    ['q-role', 'Technique', 'Milo Varga'],
    ['q-role', 'Politique', 'Nadia Sol'],
    ['q-tension', '', 'Samira Okonkwo'],
    ['q-pression', '', 'Milo Varga'],
    ['q-themes', 'Science', 'Dr Lena Kovacs'], ['q-themes', 'Science', 'Eli Chen'], ['q-themes', 'Science', 'Jonas Pike'],
    ['q-themes', 'Paranoïa', 'Samira Okonkwo'],
    ['q-themes', 'Coopération', 'Dr Lena Kovacs'],
    ['q-themes', 'Romance', 'Milo Varga']
  ]
  await db.registrationQuestionLink.createMany({
    data: links.map(([questionId, option, name]) => ({ gameId, questionId, option, characterId: character(name) }))
  })
  await db.registrationOptionExpectation.createMany({
    data: [
      { gameId, questionId: 'q-role', option: 'Scientifique', share: 0.25 },
      { gameId, questionId: 'q-role', option: 'Sécurité', share: 0.25 },
      { gameId, questionId: 'q-role', option: 'Technique', share: 0.25 },
      { gameId, questionId: 'q-role', option: 'Politique', share: 0.25 }
    ]
  })

  const castRows = characters.map((row) => ({ characterId: row.id }))
  const createSession = (name: string, days: number, poolSeats?: number) => db.session.create({
    data: {
      name: `${title} - ${name}`,
      slug: makeSlug(`${title}-${name}`),
      date: daysFromNow(days),
      gameId,
      locationId,
      status: SESSION_STATUSES.scheduled,
      published: true,
      poolSeats,
      assignments: { create: castRows }
    },
    select: { id: true }
  })
  const drawSession = await createSession('Session du tirage', 45)
  const chosenSession = await createSession('Session à la main', 80)
  const invitationSession = await createSession('Session sur invitation', 110)
  const mixedSession = await createSession('Session mixte', 140)
  const draftSession = await createSession('Session en préparation', 170)
  const poolSessions = [await createSession('Soirée du vivier', 200, 6), await createSession('Week-end du vivier', 230, 8)]

  const SEATS = 6
  // Le lien public reste le même d'un rechargement à l'autre
  const createPeriod = (
    name: string,
    fields: {
      key: string
      entryMode: string, selectionMode: string, state: string, sessionId?: string, permanent?: boolean, organizerPicks?: number, replayPolicy?: string, weightBalance?: boolean, weightNotDrawnBefore?: boolean, waitlistSize?: number, closesInDays?: number }
  ) => db.registrationPeriod.create({
    data: {
      gameId,
      name,
      publicId: `essai-meridian-${fields.key}`,
      scope: fields.permanent ? REGISTRATION_PERIOD_SCOPES.game : REGISTRATION_PERIOD_SCOPES.sessions,
      entryMode: fields.entryMode,
      selectionMode: fields.selectionMode,
      state: fields.state,
      closesAt: fields.closesInDays === undefined ? null : daysFromNow(fields.closesInDays),
      // Page publique en production : une inscription extérieure ne doit prévenir personne (ADR-0066)
      notifyTeam: false,
      organizerPicks: fields.organizerPicks ?? null,
      replayPolicy: fields.replayPolicy ?? REGISTRATION_REPLAY_POLICIES.allowed,
      weightBalance: fields.weightBalance ?? false,
      weightNotDrawnBefore: fields.weightNotDrawnBefore ?? false,
      waitlistSize: fields.waitlistSize ?? 3,
      sessions: fields.sessionId ? { create: { sessionId: fields.sessionId, seats: SEATS } } : undefined
    },
    select: { id: true }
  })
  const drawPeriod = await createPeriod('Première vague, au tirage', { key: 'tirage', entryMode: ENTRY.form, selectionMode: SELECTION.random, state: STATE.closed, sessionId: drawSession.id, closesInDays: -5 })
  const chosenPeriod = await createPeriod('Deuxième vague, à la main', { key: 'main', entryMode: ENTRY.form, selectionMode: SELECTION.chosen, state: STATE.open, sessionId: chosenSession.id, closesInDays: 30, replayPolicy: REGISTRATION_REPLAY_POLICIES.flagged })
  const invitationPeriod = await createPeriod('Sur invitation', { key: 'invitation', entryMode: ENTRY.invitation, selectionMode: SELECTION.chosen, state: STATE.open, sessionId: invitationSession.id, closesInDays: 60 })
  const mixedPeriod = await createPeriod('Vague mixte', { key: 'mixte', entryMode: ENTRY.form, selectionMode: SELECTION.mixed, state: STATE.open, sessionId: mixedSession.id, closesInDays: 90, organizerPicks: 2, weightBalance: true, weightNotDrawnBefore: true })
  await createPeriod('Prochaine vague, en préparation', { key: 'preparation', entryMode: ENTRY.form, selectionMode: SELECTION.chosen, state: STATE.draft, sessionId: draftSession.id })
  const poolPeriod = await createPeriod('Inscription permanente', { key: 'permanente', entryMode: ENTRY.form, selectionMode: SELECTION.random, state: STATE.open, permanent: true })

  let nextRank = 0
  const createRegistration = async (
    periodId: string,
    fictionalEmail: string,
    fields: {
      status?: string
      source?: string
      sessionId?: string
      answered?: boolean
      oldForm?: boolean
      announced?: boolean
      extra?: Partial<Prisma.RegistrationUncheckedCreateInput>
    } = {}
  ) => {
    const person = people.get(fictionalEmail)!
    const status = fields.status ?? STATUS.received
    const answered = fields.answered ?? true
    const rank = nextRank++
    const [firstName, ...lastName] = person.name.split(' ')
    const profile = profiles.get(fictionalEmail)
    const dietary = profile ? profile.dietary : rank % 6 === 0 ? 'Sans gluten' : null
    const preferences = ['Posé', 'Tendu', null]
    const registration = await db.registration.create({
      data: {
        periodId,
        participantId: person.id,
        sessionId: fields.sessionId,
        status,
        source: fields.source ?? SOURCE.form,
        invitedById: fields.source === SOURCE.invitation ? ownerId : undefined,
        email: person.email!,
        ...(answered
          ? {
              formVersionId: fields.oldForm ? oldVersionId : formVersionId,
              firstName,
              lastName: lastName.join(' '),
              phone: profile?.phone ?? `07 00 00 01 ${String(rank % 100).padStart(2, '0')}`,
              emergencyContactName: profile?.emergencyContactName ?? 'Contact d\'urgence',
              emergencyContactPhone: profile?.emergencyContactPhone ?? '07 00 00 02 00',
              dietary,
              healthConsentAt: dietary ? daysFromNow(-10) : null,
              charterAcceptedAt: daysFromNow(-10),
              respondedAt: daysFromNow(-10),
              questionAnswers: answersFor(rank, !fields.oldForm),
              balancePreference: fields.oldForm ? null : preferences[rank % 3]
            }
          : {}),
        ...(fields.announced
          ? { announcedStatus: status, announcedSessionId: fields.sessionId, announcedAt: daysFromNow(-3) }
          : {}),
        ...fields.extra
      },
      select: { id: true }
    })
    return registration.id
  }

  // Première vague : un vrai tirage, jamais annoncé, donc encore annulable
  const generatedEmails = GENERATED_PEOPLE.map((person) => person.email)
  const drawCandidates: string[] = []
  for (const [index, email] of generatedEmails.slice(0, 14).entries()) {
    drawCandidates.push(await createRegistration(drawPeriod.id, email, { oldForm: index < 4 }))
  }
  const input: DrawSessionInput = {
    sessionId: drawSession.id,
    freeSeats: SEATS,
    reserves: null,
    candidates: drawCandidates.map((registrationId) => ({ registrationId, weight: 1, preference: null }))
  }
  const seed = 'graine-du-jeu-de-test'
  const waitlistSize = 3
  const result = await computeDraw(seed, [input], waitlistSize)
  const settings: DrawSettings = {
    selectionMode: SELECTION.random,
    weightNotDrawnBefore: false,
    weightBalance: false,
    balanceAttribute: null,
    waitlistSize,
    excludedReplayers: [],
    sessions: [input]
  }
  const drawn = result.sessions[0]!
  await db.registration.updateMany({ where: { id: { in: drawn.retained } }, data: { status: STATUS.retained, sessionId: drawSession.id } })
  await db.registration.updateMany({ where: { id: { in: drawn.waitlisted } }, data: { status: STATUS.waitlisted } })
  await db.registration.updateMany({ where: { id: { in: result.rejected } }, data: { status: STATUS.rejected } })
  await db.registrationWaitlistEntry.createMany({
    data: drawn.waitlisted.map((registrationId, index) => ({ registrationId, sessionId: drawSession.id, position: index + 1 }))
  })
  await db.registrationDraw.create({
    data: { periodId: drawPeriod.id, seed, settings: settings as object, result: result as object, createdById: ownerId }
  })

  // Deuxième vague : chaque statut, avec des décisions annoncées et d'autres encore à annoncer
  const retainedByHand = { retainedById: ownerId }
  const camille = await createRegistration(chosenPeriod.id, 'camille.bernard@example.test')
  const hugo = await createRegistration(chosenPeriod.id, 'hugo.fontaine@example.test')
  const lucie = await createRegistration(chosenPeriod.id, 'lucie.moreau@example.test', {
    status: STATUS.retained, sessionId: chosenSession.id, announced: true,
    extra: { ...retainedByHand, responseDueAt: daysFromNow(5) }
  })
  const nicolas = await createRegistration(chosenPeriod.id, 'nicolas.martin@example.test', { status: STATUS.retained, sessionId: chosenSession.id, extra: retainedByHand })
  await createRegistration(chosenPeriod.id, 'raphael.chevalier@example.test', { status: STATUS.retained, sessionId: chosenSession.id, extra: retainedByHand })
  await createRegistration(chosenPeriod.id, 'sarah.petit@example.test', {
    status: STATUS.confirmed, sessionId: chosenSession.id, announced: true,
    extra: { ...retainedByHand, confirmedAt: daysFromNow(-1) }
  })
  const manon = await createRegistration(chosenPeriod.id, 'manon.richard@example.test', { status: STATUS.waitlisted, announced: true })
  const otherWaiting = await createRegistration(chosenPeriod.id, generatedEmails[14]!, { status: STATUS.waitlisted })
  await db.registrationWaitlistEntry.createMany({
    data: [manon, otherWaiting].map((registrationId, index) => ({ registrationId, sessionId: chosenSession.id, position: index + 1 }))
  })
  await createRegistration(chosenPeriod.id, 'mehdi.laurent@example.test', { status: STATUS.rejected, announced: true })
  await createRegistration(chosenPeriod.id, 'clara.rousseau@example.test', { status: STATUS.withdrawn, extra: { withdrawnAt: daysFromNow(-2) } })
  // A joué la session terminée du jeu : signalée comme rejoueuse
  const amandine = await createRegistration(chosenPeriod.id, 'amandine.blanc@example.test')
  const lea = await createRegistration(chosenPeriod.id, 'lea.mercier@example.test')
  for (const email of generatedEmails.slice(15, 19)) await createRegistration(chosenPeriod.id, email)

  const affinity = (registrationId: string, kind: string, text: string, target?: string) => ({
    registrationId,
    kind,
    text,
    position: 0,
    targetParticipantId: target ? people.get(target)!.id : null
  })
  await db.registrationAffinity.createMany({
    data: [
      // Camille veut jouer avec Hugo, qui ne veut pas jouer avec elle : la sélection le signale
      affinity(camille, 'wantWith', 'Hugo Fontaine', 'hugo.fontaine@example.test'),
      affinity(hugo, 'notWith', 'Camille Bernard', 'camille.bernard@example.test'),
      // Tous les deux retenus dans la même session : alerte dans la sélection
      affinity(nicolas, 'notWith', 'Raphaël Chevalier', 'raphael.chevalier@example.test'),
      // Pas encore rattachée : l'équipe doit retrouver la personne
      affinity(lucie, 'wantWith', 'Sarah P.'),
      // Rattachée à personne du jeu
      { ...affinity(lea, 'avoid', 'Une personne hors du jeu'), targetUnknown: true },
      affinity(amandine, 'refusedRelations', 'Les scènes de trahison'),
      affinity(amandine, 'refusedRelationTypes', 'romance')
    ]
  })

  // Sur invitation : à envoyer, envoyée, acceptée et refusée
  const invited = { source: SOURCE.invitation, answered: false }
  await createRegistration(invitationPeriod.id, 'sarah.petit@example.test', { ...invited, status: STATUS.invited })
  await createRegistration(invitationPeriod.id, 'nicolas.martin@example.test', {
    ...invited, status: STATUS.invited,
    extra: { invitationSentAt: daysFromNow(-2), responseDueAt: daysFromNow(5) }
  })
  await createRegistration(invitationPeriod.id, 'maelle.renaud@example.test', {
    source: SOURCE.invitation, status: STATUS.confirmed, sessionId: invitationSession.id,
    extra: { invitationSentAt: daysFromNow(-6), confirmedAt: daysFromNow(-4) }
  })
  await createRegistration(invitationPeriod.id, 'baptiste.collet@example.test', {
    ...invited, status: STATUS.withdrawn,
    extra: { invitationSentAt: daysFromNow(-6), withdrawnAt: daysFromNow(-4) }
  })

  // Les confirmées occupent leur place dans la session, comme après une vraie confirmation
  for (const [sessionId, email] of [[chosenSession.id, 'sarah.petit@example.test'], [invitationSession.id, 'maelle.renaud@example.test']] as const) {
    await db.session.update({
      where: { id: sessionId },
      data: { participants: { create: { participantId: people.get(email)!.id, role: SESSION_ROLES.participant } } }
    })
  }

  for (const email of generatedEmails.slice(19, 27)) await createRegistration(mixedPeriod.id, email)
  // Retenue à la main, pas encore annoncée : Camille la voit encore comme reçue (ADR-0047)
  await createRegistration(mixedPeriod.id, 'camille.bernard@example.test', { status: STATUS.retained, sessionId: mixedSession.id, extra: retainedByHand })

  for (const [index, email] of generatedEmails.slice(27).entries()) {
    const registrationId = await createRegistration(poolPeriod.id, email)
    // Une personne sur deux peut venir aux deux sessions
    const available = index % 2 === 0 ? poolSessions : [poolSessions[index % 4 === 1 ? 0 : 1]!]
    await db.registrationAvailability.createMany({
      data: available.map((session) => ({ registrationId, sessionId: session.id }))
    })
  }
}
