// Station Meridian, jeu de test « avant les sessions » : page publique, vivier, questionnaire, sélection session par
// session, tirage, affinités et relations (US-152, ADR-0066, SPEC-018)
import { computeDraw, type DrawSessionInput, type DrawSettings } from '../../utils/registrationDraw'
import { REGISTRATION_STANDARD_FIELDS, type QuestionAnswers, type RegistrationFormDefinition } from '../../utils/registrationForms'
import {
  REGISTRATION_ANSWERS as ANSWER,
  REGISTRATION_PERIOD_STATES as STATE,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_MODES as SELECTION,
  REGISTRATION_SESSION_STATUSES as LINE,
  REGISTRATION_SOURCES as SOURCE,
  REGISTRATION_STATUSES as STATUS,
  SESSION_ROLES,
  SESSION_STATUSES
} from '../../utils/domain'
import type { Prisma } from '../../generated/prisma/client'
import type { Db, StageContext } from './db'
import { daysFromNow } from './options'
import type { AffinityKind, RegistrationSessionStatus, RegistrationSource, RegistrationStatus } from '../../generated/prisma/enums'

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
  // Le contact d'urgence est toujours obligatoire (US-181)
  [key, { asked: true, required: key === 'firstName' || key === 'lastName' || key === 'emergencyContact' }]
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
  const createSession = (name: string, days: number) => db.session.create({
    data: {
      name: `${title} - ${name}`,
      slug: makeSlug(`${title}-${name}`),
      date: daysFromNow(days),
      gameId,
      locationId,
      status: SESSION_STATUSES.scheduled,
      published: true,
      assignments: { create: castRows }
    },
    select: { id: true }
  })
  const drawSession = await createSession('Session du tirage', 45)
  const chosenSession = await createSession('Session à la main', 80)
  const invitationSession = await createSession('Session sur invitation', 110)
  const mixedSession = await createSession('Session mixte', 140)
  const draftSession = await createSession('Session en préparation', 170)
  const poolSessions = [await createSession('Soirée du vivier', 200), await createSession('Week-end du vivier', 230)]

  // Un seul vivier par jeu ; le lien public reste le même d'un rechargement à l'autre
  const { id: periodId } = await db.registrationPeriod.create({
    data: {
      gameId,
      publicId: 'essai-meridian-vivier',
      state: STATE.open,
      // Page publique en production : une inscription extérieure ne doit prévenir personne (ADR-0066)
      notifyTeam: false,
      replayPolicy: REGISTRATION_REPLAY_POLICIES.flagged
    },
    select: { id: true }
  })
  const SEATS = await db.character.count({ where: { gameId, type: 'pj' } })
  const linkSession = (sessionId: string, open: boolean, settings: Partial<Prisma.RegistrationPeriodSessionUncheckedCreateInput> = {}) =>
    db.registrationPeriodSession.create({ data: { gameId, periodId, sessionId, open, waitlistSize: 3, ...settings } })
  await linkSession(drawSession.id, false, { selectionMode: SELECTION.random })
  await linkSession(chosenSession.id, true)
  await linkSession(invitationSession.id, false)
  await linkSession(mixedSession.id, true, { selectionMode: SELECTION.mixed, organizerPicks: 2, weightBalance: true, weightNotDrawnBefore: true })
  await linkSession(draftSession.id, false)
  // La première a déjà reçu une demande : « Relancer » écrit aux personnes sans réponse (R12)
  await linkSession(poolSessions[0]!.id, true, { lastRequestedAt: daysFromNow(-3) })
  await linkSession(poolSessions[1]!.id, true)

  let nextRank = 0
  const createRegistration = async (
    fictionalEmail: string,
    fields: {
      status?: RegistrationStatus
      source?: RegistrationSource
      answered?: boolean
      oldForm?: boolean
      extra?: Partial<Prisma.RegistrationUncheckedCreateInput>
    } = {}
  ) => {
    const person = people.get(fictionalEmail)!
    const answered = fields.answered ?? true
    const rank = nextRank++
    const [firstName, ...lastName] = person.name.split(' ')
    const profile = profiles.get(fictionalEmail)
    const dietary = profile ? profile.dietary : rank % 6 === 0 ? 'Sans gluten' : null
    const preferences = ['Posé', 'Tendu', null]
    const registration = await db.registration.create({
      data: {
        gameId,
        periodId,
        participantId: person.id,
        status: fields.status ?? STATUS.received,
        source: fields.source ?? SOURCE.form,
        invitedById: fields.source === SOURCE.invitation ? ownerId : undefined,
        email: person.email!,
        ...(answered
          ? {
              formVersionId: fields.oldForm ? oldVersionId : formVersionId,
              firstName,
              lastName: lastName.join(' '),
              phone: profile?.phone ?? `07 00 00 01 ${String(rank % 100).padStart(2, '0')}`,
              // Un vrai nom, comme celui qu'une personne donnerait (US-182) : pas un libellé qu'on confondrait avec le champ
              emergencyContactName: profile?.emergencyContactName ?? `Proche de ${firstName}`,
              emergencyContactPhone: profile?.emergencyContactPhone ?? '07 00 00 02 00',
              dietary,
              healthConsentAt: dietary ? daysFromNow(-10) : null,
              charterAcceptedAt: daysFromNow(-10),
              respondedAt: daysFromNow(-10),
              questionAnswers: answersFor(rank, !fields.oldForm),
              balancePreference: fields.oldForm ? null : preferences[rank % 3]
            }
          : {}),
        ...fields.extra
      },
      select: { id: true }
    })
    return registration.id
  }

  // Statut d'une personne pour une session (R17) : par défaut, elle a répondu qu'elle y était disponible
  const addLine = (registrationId: string, sessionId: string, status: RegistrationSessionStatus, extra: Partial<Prisma.RegistrationSessionUncheckedCreateInput> = {}) =>
    db.registrationSession.create({
      data: { gameId, registrationId, sessionId, status, answer: ANSWER.available, answeredAt: daysFromNow(-10), ...extra }
    })
  const announced = (status: RegistrationSessionStatus) => ({ announcedStatus: status, announcedAt: daysFromNow(-3) })
  const retainedByHand = { retainedById: ownerId }

  // Session du tirage : un vrai tirage, jamais annoncé, donc encore annulable
  const generatedEmails = GENERATED_PEOPLE.map((person) => person.email)
  const drawCandidates: string[] = []
  for (const [index, email] of generatedEmails.slice(0, 14).entries()) {
    const registrationId = await createRegistration(email, { oldForm: index < 4 })
    drawCandidates.push(registrationId)
    await addLine(registrationId, drawSession.id, LINE.preregistered)
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
  await db.registrationSession.updateMany({ where: { sessionId: drawSession.id, registrationId: { in: drawn.retained } }, data: { status: LINE.retained } })
  for (const [index, registrationId] of drawn.waitlisted.entries()) {
    await db.registrationSession.updateMany({ where: { sessionId: drawSession.id, registrationId }, data: { status: LINE.waitlisted, waitlistPosition: index + 1 } })
  }
  await db.registrationDraw.create({
    data: { gameId, periodId, sessionId: drawSession.id, seed, settings: settings as object, result: result as object, createdById: ownerId }
  })

  // Session à la main : chaque statut, avec des décisions annoncées et d'autres encore à annoncer
  const camille = await createRegistration('camille.bernard@example.test')
  await addLine(camille, chosenSession.id, LINE.preregistered)
  const hugo = await createRegistration('hugo.fontaine@example.test')
  await addLine(hugo, chosenSession.id, LINE.preregistered)
  const lucie = await createRegistration('lucie.moreau@example.test')
  // Ses réponses ont changé depuis : le repère attend d'être marqué comme lu (R16)
  await addLine(lucie, chosenSession.id, LINE.retained, { ...retainedByHand, ...announced(LINE.retained), responseDueAt: daysFromNow(5), answersChangedAt: daysFromNow(-1) })
  const nicolas = await createRegistration('nicolas.martin@example.test')
  await addLine(nicolas, chosenSession.id, LINE.retained, retainedByHand)
  const raphael = await createRegistration('raphael.chevalier@example.test')
  await addLine(raphael, chosenSession.id, LINE.retained, retainedByHand)
  const maelle = await createRegistration('maelle.renaud@example.test')
  await addLine(maelle, chosenSession.id, LINE.confirmed, { ...retainedByHand, ...announced(LINE.retained), confirmedAt: daysFromNow(-1) })
  const manon = await createRegistration('manon.richard@example.test')
  await addLine(manon, chosenSession.id, LINE.waitlisted, { ...announced(LINE.waitlisted), waitlistPosition: 1 })
  const otherWaiting = await createRegistration(generatedEmails[14]!)
  await addLine(otherWaiting, chosenSession.id, LINE.waitlisted, { waitlistPosition: 2 })
  // A répondu « pas disponible » : l'équipe distingue un refus d'une absence de réponse (R11)
  const mehdi = await createRegistration('mehdi.laurent@example.test')
  await addLine(mehdi, chosenSession.id, LINE.unavailable, { answer: ANSWER.unavailable })
  // Sortie du vivier (R5)
  const clara = await createRegistration('clara.rousseau@example.test', { status: STATUS.withdrawn, extra: { withdrawnAt: daysFromNow(-2) } })
  await addLine(clara, chosenSession.id, LINE.cancelled, { cancelledAt: daysFromNow(-2) })
  // A joué la session terminée du jeu : signalée comme rejoueuse
  const amandine = await createRegistration('amandine.blanc@example.test')
  await addLine(amandine, chosenSession.id, LINE.preregistered)
  const lea = await createRegistration('lea.mercier@example.test')
  await addLine(lea, chosenSession.id, LINE.preregistered)
  for (const email of generatedEmails.slice(15, 19)) await addLine(await createRegistration(email), chosenSession.id, LINE.preregistered)

  const affinity = (registrationId: string, kind: AffinityKind, text: string, target?: string) => ({
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

  // Invitations : pour une session, à envoyer ; au vivier, envoyée ; inscrite par son invitation
  const invited = { source: SOURCE.invitation, answered: false, status: STATUS.invited }
  await createRegistration('sarah.petit@example.test', { ...invited, extra: { invitedSessionId: invitationSession.id } })
  await createRegistration('baptiste.collet@example.test', { ...invited, extra: { invitationSentAt: daysFromNow(-2), responseDueAt: daysFromNow(5) } })
  const invitedPlayer = await createRegistration(generatedEmails[19]!, { source: SOURCE.invitation, extra: { invitationSentAt: daysFromNow(-6) } })
  await addLine(invitedPlayer, invitationSession.id, LINE.confirmed, { ...announced(LINE.confirmed), confirmedAt: daysFromNow(-4) })

  // Les inscrites occupent leur place dans la session, comme après une vraie confirmation
  const inscribed = [[chosenSession.id, 'maelle.renaud@example.test'], [invitationSession.id, generatedEmails[19]!]] as const
  for (const [sessionId, email] of inscribed) {
    await db.session.update({
      where: { id: sessionId },
      data: { participants: { create: { participantId: people.get(email)!.id, role: SESSION_ROLES.participant } } }
    })
  }

  // Maëlle a payé : inscrite validée ; l'autre inscrite reste « inscrite » (R18)
  await db.sessionPayment.create({ data: { gameId, sessionId: chosenSession.id, participantId: people.get('maelle.renaud@example.test')!.id, paidAt: daysFromNow(-1) } })

  for (const email of generatedEmails.slice(20, 27)) await addLine(await createRegistration(email), mixedSession.id, LINE.preregistered)
  // Retenue à la main, pas encore annoncée, et pré-inscrite ailleurs : Camille se voit encore pré-inscrite (R17, R28)
  await addLine(camille, mixedSession.id, LINE.retained, { ...retainedByHand })

  for (const [index, email] of generatedEmails.slice(27).entries()) {
    const registrationId = await createRegistration(email)
    // Une personne sur deux peut venir aux deux sessions ; certaines ne répondent rien : simplement intéressées
    if (index % 5 === 4) continue
    const available = index % 2 === 0 ? poolSessions : [poolSessions[index % 4 === 1 ? 0 : 1]!]
    for (const session of available) await addLine(registrationId, session.id, LINE.preregistered)
  }
}
