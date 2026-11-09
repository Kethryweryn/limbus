import { z, type ZodError, type ZodType } from 'zod'
import { PHOTO_RETENTION_MAX_MONTHS, PHOTO_RETENTION_MIN_MONTHS } from '~/utils/photoInformation'
import { REGISTRATION_DIETARY_MAX_LENGTH } from '~/utils/registrationForms'
import { CHARACTER_RELATION_DESCRIPTION_MAX_LENGTH, CHARACTER_RELATION_LABEL_MAX_LENGTH, CHARACTER_RELATION_TYPE_VALUES } from '~/utils/characterRelations'
import type { H3Event } from 'h3'
import {
  CHARACTER_TYPES,
  INTRIGUE_LEVELS,
  REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS,
  REGISTRATION_PERIOD_STATES,
  REFUND_STATUSES,
  SESSION_ROLES,
  SESSION_STATUSES,
  USER_ROLES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_ACTIONS,
  REGISTRATION_SELECTION_MODES
} from '~/utils/domain'
import { isHttpUrl, isUploadUrl, PHOTO_UPLOAD_PREFIX, RIB_UPLOAD_PREFIX } from '~/utils/urls'
import { ALL_DOCUMENT_ROLES, type DocumentRole } from '~/utils/documentAudiences'
import {
  REGISTRATION_AFFINITIES,
  REGISTRATION_CHOICE_TYPES,
  REGISTRATION_QUESTION_LABEL_MAX_LENGTH,
  REGISTRATION_QUESTION_MAX,
  REGISTRATION_QUESTION_OPTION_MAX,
  REGISTRATION_STANDARD_FIELDS,
  type RegistrationAffinityKey,
  type RegistrationQuestionType,
  type RegistrationStandardFieldKey
} from '~/utils/registrationForms'


const optionalText = z.string().trim().optional().nullable()
const optionalBoolean = z.boolean().optional()
// Les URL sont affichées en lien ou en iframe : http(s) uniquement, sinon un javascript: s'exécuterait au clic
const externalUrl = optionalText.refine((value) => !value || isHttpUrl(value), 'Le lien doit commencer par https:// (ou http://)')
const uploadOrExternalUrl = (prefix: string) => optionalText.refine(
  (value) => !value || isHttpUrl(value) || isUploadUrl(value, prefix),
  'Le lien doit commencer par https:// (ou http://), ou être un fichier téléversé'
)
// Champ obligatoire : « Le nom est obligatoire », jamais un nom de champ anglais (US-210)
const requiredText = (label: string) => z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`)
// Les emails de compte sont stockés en minuscules : la connexion ne dépend pas de la casse saisie
const accountEmail = () => requiredText('L’email').toLowerCase().email('Email invalide')
const requiredId = requiredText
const sessionStatus = z.enum([
  SESSION_STATUSES.scheduled,
  SESSION_STATUSES.postponed,
  SESSION_STATUSES.cancelled,
  SESSION_STATUSES.completed
])
const intrigueLevel = z.enum([
  INTRIGUE_LEVELS.mainStory,
  INTRIGUE_LEVELS.mainCharacter,
  INTRIGUE_LEVELS.major,
  INTRIGUE_LEVELS.minor
])
const characterType = z.enum([CHARACTER_TYPES.pj, CHARACTER_TYPES.pnj])
const sessionParticipantRole = z.enum([
  SESSION_ROLES.participant,
  SESSION_ROLES.organizer,
  SESSION_ROLES.npc,
  SESSION_ROLES.kitchen
])
export const documentRoleSchema = z.enum(ALL_DOCUMENT_ROLES as [DocumentRole, ...DocumentRole[]])
const timelineTime = z.string().trim().regex(/^\d{2}:\d{2}$/, 'L’heure doit être au format HH:MM')
const userRole = z.enum([USER_ROLES.admin, USER_ROLES.user])
const optionalEmail = z.string().trim().default('').refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Email invalide'
)

export async function readZodBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  return await readValidatedBody(event, (body) => parseZod(schema, body))
}

/** Valide une valeur déjà lue (outils des assistants d'IA, US-126) : même refus 400 que readZodBody. */
export function parseZod<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  throw createError({
    statusCode: 400,
    message: 'Requête invalide',
    data: formatZodError(result.error)
  })
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
}

// Attribut d'équilibre des personnages (US-091) : un nom et ses valeurs, sans doublon
const balanceAttribute = z.string().trim().max(100, 'Nom d’attribut trop long').optional().nullable()
const balanceValues = z.array(z.string().trim().min(1, 'Valeur vide').max(100, 'Valeur trop longue')).max(20, 'Vingt valeurs au plus')
  .refine((values) => new Set(values).size === values.length, 'Une valeur est donnée deux fois')
  .optional()
const balanceValue = z.string().trim().max(100).optional().nullable()

// Colonne obligatoire : une description vidée (null) devient un texte vide ; absente, elle ne change pas
const gameDescription = optionalText.transform((value) => value === null ? '' : value)

export const createGameSchema = z.object({
  title: requiredText('Le titre'),
  description: gameDescription,
  teaserUrl: externalUrl,
  noteIntention: optionalText,
  publicPage: optionalBoolean,
  // Ce que la page publique montre en plus de la présentation (US-086)
  publicShowSessions: optionalBoolean,
  publicShowRegistration: optionalBoolean,
  singlePjPerParticipant: optionalBoolean,
  balanceAttribute,
  balanceValues,
  // Photos des participants (US-107) : durée de conservation et adresse pour en demander le retrait
  photoRetentionMonths: z.number().int().min(PHOTO_RETENTION_MIN_MONTHS).max(PHOTO_RETENTION_MAX_MONTHS).optional().nullable(),
  contactEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email('Adresse de contact invalide')]).optional().nullable()
})

export const updateGameSchema = z.object({
  title: requiredText('Le titre').optional(),
  description: gameDescription,
  teaserUrl: externalUrl,
  noteIntention: optionalText,
  published: optionalBoolean,
  publicPage: optionalBoolean,
  // Ce que la page publique montre en plus de la présentation (US-086)
  publicShowSessions: optionalBoolean,
  publicShowRegistration: optionalBoolean,
  singlePjPerParticipant: optionalBoolean,
  balanceAttribute,
  balanceValues,
  // Photos des participants (US-107) : durée de conservation et adresse pour en demander le retrait
  photoRetentionMonths: z.number().int().min(PHOTO_RETENTION_MIN_MONTHS).max(PHOTO_RETENTION_MAX_MONTHS).optional().nullable(),
  contactEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email('Adresse de contact invalide')]).optional().nullable()
})

export const createCharacterSchema = z.object({
  name: requiredText('Le nom'),
  type: characterType.default(CHARACTER_TYPES.pj),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: externalUrl,
  sheetReadyToSend: optionalBoolean,
  costumeIndications: optionalText,
  excludeFromTrombinoscope: optionalBoolean,
  trombinoscopeFaceHidden: optionalBoolean,
  trombinoscopePhotoUrl: uploadOrExternalUrl(PHOTO_UPLOAD_PREFIX),
  trombinoscopeNote: optionalText,
  trombinoscopeDisplayName: optionalText,
  balanceValue,
  gameId: requiredId('Le jeu'),
  factionIds: z.array(requiredId('Le groupe')).optional().default([])
})

export const updateCharacterSchema = z.object({
  name: requiredText('Le nom').optional(),
  type: characterType.optional(),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: externalUrl,
  sheetReadyToSend: optionalBoolean,
  costumeIndications: optionalText,
  excludeFromTrombinoscope: optionalBoolean,
  trombinoscopeFaceHidden: optionalBoolean,
  trombinoscopePhotoUrl: uploadOrExternalUrl(PHOTO_UPLOAD_PREFIX),
  trombinoscopeNote: optionalText,
  trombinoscopeDisplayName: optionalText,
  balanceValue,
  gameId: requiredId('Le jeu').optional(),
  factionIds: z.array(requiredId('Le groupe')).optional()
})

export const factionSchema = z.object({
  name: requiredText('Le nom'),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: externalUrl,
  costumeIndications: optionalText,
  showInTrombinoscope: optionalBoolean,
  gameId: requiredId('Le jeu'),
  characterIds: z.array(requiredId('Le personnage')).optional().default([])
})

export const intrigueSchema = z.object({
  name: requiredText('Le nom'),
  pitch: optionalText,
  description: optionalText,
  level: intrigueLevel.default(INTRIGUE_LEVELS.minor),
  gameId: requiredId('Le jeu'),
  characterIds: z.array(requiredId('Le personnage')).optional().default([]),
  factionIds: z.array(requiredId('Le groupe')).optional().default([])
})

// Relation entre deux personnages (US-097, ADR-0050)
const relationLabel = z.string().trim().max(CHARACTER_RELATION_LABEL_MAX_LENGTH, 'Libellé trop long').optional().nullable().transform((value) => value || null)
export const characterRelationSchema = z.object({
  type: z.enum(CHARACTER_RELATION_TYPE_VALUES, { error: 'Type de relation inconnu' }),
  description: z.string().trim().max(CHARACTER_RELATION_DESCRIPTION_MAX_LENGTH, 'Description trop longue').optional().nullable().transform((value) => value || null),
  fromCharacterId: requiredId('Le personnage'),
  fromLabel: relationLabel,
  fromVisible: z.boolean().optional().default(false),
  toCharacterId: requiredId('Le personnage'),
  toLabel: relationLabel,
  toVisible: z.boolean().optional().default(false)
}).refine((body) => body.fromCharacterId !== body.toCharacterId, { path: ['toCharacterId'], message: 'Un personnage ne peut pas être relié à lui-même' })

// Liens du questionnaire vers les personnages, factions et intrigues (US-098, ADR-0050) : la liste complète du jeu
export const registrationQuestionLinksSchema = z.object({
  links: z.array(z.object({
    questionId: requiredId('La question'),
    option: z.string().trim().max(REGISTRATION_QUESTION_LABEL_MAX_LENGTH).optional().default(''),
    characterId: z.string().min(1).nullable().optional(),
    factionId: z.string().min(1).nullable().optional(),
    intrigueId: z.string().min(1).nullable().optional()
  }).refine((link) => [link.characterId, link.factionId, link.intrigueId].filter(Boolean).length === 1, 'Un lien vise un seul personnage, une faction ou une intrigue'))
    .max(2000, 'Trop de liens')
})

// Proportions attendues des options (US-141, ADR-0062) : la liste complète du jeu
export const registrationOptionExpectationsSchema = z.object({
  expectations: z.array(z.object({
    questionId: requiredId('La question'),
    option: z.string().trim().min(1).max(REGISTRATION_QUESTION_LABEL_MAX_LENGTH),
    share: z.number().min(0, 'Une part va de 0 à 100 %').max(1, 'Une part va de 0 à 100 %')
  })).max(2000, 'Trop de proportions')
})

export const participantSchema = z.object({
  name: requiredText('Le nom'),
  email: optionalText,
  phone: optionalText,
  // Une note par jeu (US-069) : { idDuJeu: texte }, pour les seuls jeux accessibles
  gameNotes: z.record(z.string(), z.string().nullable()).optional().default({}),
  gameIds: z.array(requiredId('Le jeu')).optional().default([])
})

// Création d'une fiche : au moins un jeu (US-036)
export const participantCreateSchema = participantSchema.extend({
  gameIds: z.array(requiredId('Le jeu')).min(1, 'Choisissez au moins un jeu')
})

export const locationSchema = z.object({
  name: requiredText('Le nom'),
  address: optionalText,
  notes: optionalText,
  gameId: requiredId('Le jeu')
})

export const itemSchema = z.object({
  name: requiredText('Le nom'),
  description: optionalText,
  // Absente : 1 à la création, valeur actuelle à la modification (US-014)
  quantity: z.coerce.number().int('La quantité doit être un nombre entier').min(1, 'La quantité doit être d’au moins 1').optional(),
  locationText: optionalText,
  locationCharacterId: optionalText,
  gameId: requiredId('Le jeu'),
  characterIds: z.array(requiredId('Le personnage')).optional().default([]),
  intrigueIds: z.array(requiredId('L’intrigue')).optional().default([])
})

// Public : rôles cochés et sélection avancée (US-187, ADR-0072). Une écriture d'avant, avec l'ancien public ou le champ
// unique « Personnage », vient d'une page périmée : refusée plutôt qu'enregistrée sans public (US-193)
const outdatedDocumentField = z.undefined({ error: 'Cette page est d’une ancienne version : rechargez-la avant d’enregistrer.' }).optional()
export const documentSchema = z.object({
  title: requiredText('Le titre'),
  content: optionalText,
  documentUrl: externalUrl,
  audiences: z.array(documentRoleSchema).optional().default([]),
  audience: outdatedDocumentField,
  characterId: outdatedDocumentField,
  readyToSend: optionalBoolean,
  gameId: requiredId('Le jeu'),
  characterIds: z.array(requiredId('Le personnage')).optional().default([]),
  factionIds: z.array(requiredId('Le groupe')).optional().default([])
}).refine((value) => Boolean(value.content?.trim() || value.documentUrl?.trim()), {
  message: 'Renseignez un corps ou un document lié.',
  path: ['content']
}).transform(({ audience: _audience, characterId: _characterId, audiences, characterIds, ...value }) => ({
  ...value,
  audiences: [...new Set(audiences)],
  characterIds: [...new Set(characterIds)]
}))

export const timelineEventSchema = z.object({
  name: requiredText('Le nom'),
  description: optionalText,
  day: z.coerce.number().int().min(1),
  time: timelineTime,
  requiredResponsibles: z.coerce.number().int().min(0).optional().default(0),
  gameId: requiredId('Le jeu'),
  characterIds: z.array(requiredId('Le personnage')).optional().default([]),
  factionIds: z.array(requiredId('Le groupe')).optional().default([]),
  intrigueIds: z.array(requiredId('L’intrigue')).optional().default([]),
  itemIds: z.array(requiredId('L’objet')).optional().default([])
})

// Report d'une session sur une nouvelle session (US-022)
export const sessionPostponeSchema = z.object({
  name: requiredText('Le nom'),
  date: optionalText,
  locationId: optionalText
})

export const sessionTimelineSchema = z.object({
  assignments: z.array(z.object({
    timelineEventId: requiredId('L’événement'),
    participantIds: z.array(requiredId('La personne')).optional().default([])
  })).optional().default([])
})

export const sessionDocumentSendSchema = z.object({
  documentIds: z.array(requiredId('Le document')).optional().default([])
})

export const emailTestSchema = z.object({
  emails: z.array(requiredText('L’email').email('Email invalide'))
    .min(1, 'Indiquez au moins un email')
    .max(10, 'Dix adresses au plus'),
  documentIds: z.array(requiredId('Le document')).optional().default([]),
  characterId: optionalText,
  participantId: optionalText
})

export const sessionPaymentSettingsSchema = z.object({
  paymentRibUrl: uploadOrExternalUrl(RIB_UPLOAD_PREFIX),
  paymentLinkUrl: externalUrl,
  // Date limite de désistement (US-040) : absente, elle est gardée ; vide, elle est retirée
  withdrawalDeadline: z.string().trim().nullable().optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), 'Date limite invalide')
    .transform((value) => value === undefined ? undefined : value ? new Date(value) : null)
})

// Remboursement d'un paiement (US-023) : null efface le choix
export const sessionPaymentRefundSchema = z.object({
  status: z.enum([REFUND_STATUSES.toRefund, REFUND_STATUSES.refunded, REFUND_STATUSES.carriedOver]).nullable()
})

export const sessionPaymentStatusSchema = z.object({
  paid: z.boolean(),
  // Date du clic (US-048) : un paiement validé hors ligne garde sa date ; jamais dans le futur
  paidAt: z.string().optional()
    .refine((value) => !value || (!Number.isNaN(new Date(value).getTime()) && new Date(value).getTime() <= Date.now() + 5 * 60 * 1000), 'Date de paiement invalide')
    .transform((value) => value ? new Date(value) : undefined)
})

// Renvoi de la version à jour (US-030) : à une personne, ou à celles dont la version est dépassée
export const documentResendSchema = z.object({
  kind: z.enum(['document', 'character_sheet', 'trombinoscope']),
  documentId: optionalText,
  participantId: optionalText,
  characterId: optionalText
})

export const sessionPaymentSendSchema = z.object({
  reminder: z.boolean().optional().default(false),
  participantId: optionalText
})

export const characterTrombinoscopeSchema = z.object({
  entries: z.array(z.object({
    targetCharacterId: requiredId('Le personnage'),
    included: z.boolean(),
    faceKnown: z.boolean(),
    displayName: optionalText,
    note: optionalText
  })).default([])
})

export const sessionAssignmentSchema = z.object({
  characterId: requiredId('Le personnage'),
  participantId: optionalText,
  photoUrl: uploadOrExternalUrl(PHOTO_UPLOAD_PREFIX),
  notes: optionalText,
  // Cadenas et réservation (US-100) ; absents, la ligne garde ceux enregistrés
  locked: optionalBoolean,
  reservedRegistrationId: optionalText
})

// Assistant de casting (US-101) : le cast en cours d'édition
export const castingAssistantSchema = z.object({
  assignments: z.array(z.object({
    characterId: requiredId('Le personnage'),
    participantId: optionalText,
    reservedRegistrationId: optionalText,
    locked: optionalBoolean
  })).max(1000).optional().default([])
})

export const sessionParticipantSchema = z.object({
  participantId: requiredId('La personne'),
  role: sessionParticipantRole
})

export const sessionSchema = z.object({
  name: requiredText('Le nom'),
  gameId: requiredId('Le jeu'),
  date: optionalText,
  locationId: optionalText,
  status: sessionStatus.optional().default(SESSION_STATUSES.scheduled),
  published: optionalBoolean,
  assignments: z.array(sessionAssignmentSchema).optional(),
  participants: z.array(sessionParticipantSchema).optional().default([])
})

// Schémas des inscriptions (SPEC-001) : messages en français, affichés tels quels dans l'interface

const registrationPeriodState = z.enum([
  REGISTRATION_PERIOD_STATES.draft,
  REGISTRATION_PERIOD_STATES.open,
  REGISTRATION_PERIOD_STATES.closed
], { error: 'État du vivier inconnu' })
const registrationResponseDelay = z.number({ error: 'Le délai de réponse doit être un nombre de jours' })
  .int('Le délai de réponse doit être un nombre entier de jours')
  .min(1, 'Le délai de réponse est d’au moins 1 jour')
  .max(90, 'Le délai de réponse est de 90 jours au plus')

const registrationSelectionMode = z.enum(
  [REGISTRATION_SELECTION_MODES.chosen, REGISTRATION_SELECTION_MODES.random, REGISTRATION_SELECTION_MODES.mixed],
  { error: 'Mode de sélection inconnu' }
)
const registrationWaitlistSize = z.number().int('Taille de liste d’attente invalide').min(0, 'Taille de liste d’attente invalide').max(1000, 'Taille de liste d’attente invalide')
// Mode mixte : places que chaque organisatrice retient elle-même par session (US-092)
const registrationOrganizerPicks = z.number().int('Nombre invalide').min(0, 'Nombre invalide').max(1000, 'Nombre invalide').nullable().optional()

const registrationReplayPolicy = z.enum(
  [REGISTRATION_REPLAY_POLICIES.allowed, REGISTRATION_REPLAY_POLICIES.flagged, REGISTRATION_REPLAY_POLICIES.excluded],
  { error: 'Réglage des rejoueurs inconnu' }
)

// Le vivier d'un jeu (SPEC-018) : ni portée, ni mode d'entrée, ni date de clôture
export const registrationPeriodSchema = z.object({
  gameId: requiredText('Le jeu'),
  state: registrationPeriodState.default(REGISTRATION_PERIOD_STATES.draft),
  responseDelayDays: registrationResponseDelay.default(REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS),
  notifyTeam: z.boolean().default(false),
  replayPolicy: registrationReplayPolicy.default(REGISTRATION_REPLAY_POLICIES.allowed)
})

// Modification : un champ absent est conservé, jamais remis à sa valeur par défaut
export const registrationPeriodUpdateSchema = z.object({
  gameId: requiredText('Le jeu'),
  state: registrationPeriodState.optional(),
  responseDelayDays: registrationResponseDelay.optional(),
  notifyTeam: z.boolean().optional(),
  replayPolicy: registrationReplayPolicy.optional()
})

// Ouverture et sélection d'une session du vivier (R6, R22) : un champ absent est conservé
export const registrationSessionSettingsSchema = z.object({
  open: z.boolean().optional(),
  selectionMode: registrationSelectionMode.optional(),
  organizerPicks: registrationOrganizerPicks,
  weightNotDrawnBefore: z.boolean().optional(),
  weightBalance: z.boolean().optional(),
  waitlistSize: registrationWaitlistSize.optional()
})

// La session d'une action sur une personne du vivier (relance, annulation…) ; absente, l'action vaut pour le jeu
export const registrationTargetSchema = z.object({
  sessionId: z.string().min(1).nullable().optional()
}).default({})

// La session d'une action de la personne (confirmer, annuler) : toujours donnée
export const registrationSessionTargetSchema = z.object({
  sessionId: requiredText('La session')
})

// Tirage d'une session (R22)
export const registrationDrawSchema = registrationSessionTargetSchema

export const castAnnouncementSchema = z.object({
  includeWaitlist: z.boolean().default(false)
})

export const registrationLineAnnouncementSchema = registrationSessionTargetSchema.extend({
  action: z.enum(['send', 'ignore'], { error: 'Action inconnue' })
})

export const registrationAvailabilityAnswerSchema = registrationSessionTargetSchema.extend({
  available: z.boolean({ error: 'Réponse invalide' })
})

// Demande de disponibilités : `registrationIds` limite l'envoi aux personnes pour qui il a échoué
export const availabilityRequestSchema = z.object({
  registrationIds: z.array(z.string()).max(5000).optional()
})

export const registrationSelectionSchema = z.object({
  action: z.enum(REGISTRATION_SELECTION_ACTIONS, { error: 'Décision inconnue' }),
  sessionId: requiredText('La session')
})

// Rattachement d'une ligne d'affinité (US-095) : une personne du jeu, « inconnue », ou rien pour détacher
export const affinityLinkSchema = z.object({
  targetParticipantId: z.string().min(1).nullable().optional(),
  unknown: z.boolean().optional()
}).refine((body) => !(body.unknown && body.targetParticipantId), { path: ['unknown'], message: 'Une ligne inconnue ne vise personne' })

// Nouvel ordre de la liste d'attente d'une session (R19)
export const registrationWaitlistOrderSchema = z.object({
  sessionId: requiredText('La session'),
  registrationIds: z.array(z.string().min(1)).max(1000)
})

// Places d'une session de l'inscription permanente (US-090) ; null : le nombre de personnages PJ
export const registrationPoolSeatsSchema = z.object({
  sessionId: requiredText('La session'),
  seats: z.number().int('Nombre de places invalide').min(0, 'Nombre de places invalide').max(1000, 'Nombre de places invalide').nullable()
})

// Invitations à rejoindre le vivier (R4), éventuellement pour une session : des participants du jeu et/ou une nouvelle personne
export const registrationInvitationSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
  participantIds: z.array(requiredText('Le participant')).optional().default([])
    .refine((ids) => new Set(ids).size === ids.length, 'Une personne est choisie deux fois'),
  newParticipant: z.object({
    name: requiredText('Le nom'),
    email: requiredText('L’email').toLowerCase().max(254, 'Email trop long').email('Email invalide')
  }).optional().nullable()
}).refine((body) => body.participantIds.length > 0 || body.newParticipant, 'Choisissez au moins une personne à inviter')

// Prolongation de l'échéance d'une invitation sans réponse, à une date choisie (US-005, R20)
export const registrationExtensionSchema = z.object({
  sessionId: z.string().min(1).nullable().optional(),
  responseDueAt: requiredText('La nouvelle échéance')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date d’échéance invalide')
    .transform((value) => new Date(value))
})

// Email d'annulation relu par l'organisation (US-025) ; « emails » pour un test
export const cancellationEmailSchema = z.object({
  subject: requiredText('Le sujet').max(200),
  text: requiredText('Le texte').max(10_000)
})

export const cancellationEmailTestSchema = cancellationEmailSchema.extend({
  emails: z.array(requiredText('L’email').email('Email invalide')).min(1, 'Indiquez au moins un email').max(10, 'Dix adresses au plus')
})

// Réponse au lien de confirmation de présence (US-024)
export const attendanceAnswerSchema = z.object({
  answer: z.enum(['confirmed', 'declined'], { error: 'Réponse invalide' })
})

const registrationFieldSetting = z.object({ asked: z.boolean(), required: z.boolean() })

// Question propre au jeu (US-081) : sans id, c'est une nouvelle question, et le serveur lui en donne un
const registrationQuestion = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/, 'Question invalide').optional(),
  label: z.string().trim().min(1, 'Le libellé de la question est obligatoire').max(REGISTRATION_QUESTION_LABEL_MAX_LENGTH, 'Libellé trop long'),
  type: z.enum(['text', 'single', 'multiple', 'scale'] as const satisfies readonly RegistrationQuestionType[], { error: 'Sorte de question invalide' }),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().max(REGISTRATION_QUESTION_LABEL_MAX_LENGTH, 'Option trop longue')).max(REGISTRATION_QUESTION_OPTION_MAX, 'Trop d’options').default([]),
  // Question à choix : ordre des options tiré au hasard à chaque affichage (US-146)
  shuffleOptions: z.boolean().optional()
}).refine((question) => !REGISTRATION_CHOICE_TYPES.includes(question.type) || question.options.filter(Boolean).length >= 2, {
  message: 'Une question à choix demande au moins deux options',
  path: ['options']
})

export const registrationFormDefinitionSchema = z.object({
  standardFields: z.object(
    Object.fromEntries(REGISTRATION_STANDARD_FIELDS.map(({ key }) => [key, registrationFieldSetting])) as
      Record<RegistrationStandardFieldKey, typeof registrationFieldSetting>
  ),
  // Affinités et questions (US-081, US-082) ; absentes, rien n'est demandé
  affinities: z.object(
    Object.fromEntries(REGISTRATION_AFFINITIES.map(({ key }) => [key, registrationFieldSetting.optional()])) as
      Record<RegistrationAffinityKey, z.ZodOptional<typeof registrationFieldSetting>>
  ).optional(),
  // Question d'équilibre (US-091) : demandée ou non ; son libellé et ses valeurs viennent du jeu
  balance: registrationFieldSetting.optional(),
  questions: z.array(registrationQuestion).max(REGISTRATION_QUESTION_MAX, 'Trop de questions').optional()
    .refine((questions) => {
      const ids = (questions ?? []).map((question) => question.id).filter(Boolean)
      return new Set(ids).size === ids.length
    }, { message: 'Question en double' }),
  // Version sur laquelle l'éditeur s'appuie (null : formulaire jamais enregistré) ; absente, pas de contrôle
  baseVersionNumber: z.number().int().min(1).nullable().optional()
})

export const loginSchema = z.object({
  email: requiredText('L’email').toLowerCase(),
  password: requiredText('Le mot de passe')
})

// Plus de mot de passe choisi par l'administratrice : la personne reçoit un lien (US-065)
export const userCreateSchema = z.object({
  email: accountEmail(),
  name: requiredText('Le nom'),
  role: userRole.default(USER_ROLES.user)
})

export const userUpdateSchema = z.object({
  email: accountEmail().optional(),
  name: requiredText('Le nom').optional(),
  role: userRole.optional(),
  disabled: z.boolean().optional(),
  storageQuotaMb: z.number().int().min(0).max(1_000_000).optional()
})

const newPassword = () => requiredText('Le mot de passe').min(8, 'Le mot de passe doit faire au moins 8 caractères')

// Inscription libre (US-061) : website est le champ piège, invisible pour une personne
const termsAccepted = () => z.literal(true, { error: 'Acceptez les conditions d’utilisation pour créer votre compte.' })

export const signupSchema = z.object({
  name: requiredText('Le nom'),
  email: accountEmail(),
  password: newPassword(),
  website: z.string().optional(),
  // Conditions d'utilisation (US-111) : la case est obligatoire
  termsAccepted: termsAccepted()
})

export const accountTokenSchema = z.object({
  token: requiredText('Le lien')
})

export const passwordForgottenSchema = z.object({
  email: accountEmail()
})

export const passwordResetSchema = z.object({
  token: requiredText('Le lien'),
  password: newPassword()
})

export const accountUpdateSchema = z.object({
  name: requiredText('Le nom')
})

export const accountEmailSchema = z.object({
  email: accountEmail(),
  password: requiredText('Le mot de passe')
})

// Mes coordonnées (US-074) : consentement exigé dès qu'une allergie est déclarée, comme à l'inscription (R14)
export const accountProfileSchema = z.object({
  phone: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  dietary: z.string().trim().max(REGISTRATION_DIETARY_MAX_LENGTH, 'Texte trop long').optional().nullable(),
  healthConsent: z.boolean().optional().default(false)
}).refine((profile) => !profile.dietary || profile.healthConsent, {
  message: 'Le consentement est nécessaire pour enregistrer des allergies ou intolérances',
  path: ['healthConsent']
})

// Effacer son compte (US-077) : le mot de passe est redemandé
export const accountDeleteSchema = z.object({
  password: requiredText('Le mot de passe')
})

export const accountPasswordSchema = z.object({
  currentPassword: requiredText('Le mot de passe'),
  password: newPassword()
})

// Transfert d'un jeu à une co-organisatrice (US-060)
export const gameTransferSchema = z.object({
  userId: requiredId('Le compte')
})

// Refus de l'usage de sa photo (US-109)
export const photoRefusalSchema = z.object({
  refused: z.boolean()
})

export const adminModeSchema = z.object({
  enabled: z.boolean()
})

export const gameInvitationCreateSchema = z.object({
  email: requiredText('L’email').email('Email invalide')
})

// Legs d'une copie du jeu (SPEC-002)
export const gameBequestSchema = z.object({
  email: requiredText('L’email').toLowerCase().max(254, 'Email trop long').email('Email invalide')
})

// L'adresse est celle de l'invitation (US-064) : un email envoyé est ignoré
export const invitationRegistrationSchema = z.object({
  token: requiredText('Le lien'),
  name: requiredText('Le nom'),
  password: requiredText('Le mot de passe').min(8, 'Le mot de passe doit faire au moins 8 caractères'),
  termsAccepted: termsAccepted()
})

export const invitationAcceptSchema = z.object({
  token: requiredText('Le lien')
})

export const smtpSettingsSchema = z.object({
  enabled: z.boolean().optional().default(false),
  host: z.string().trim().default(''),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().optional().default(false),
  username: optionalText,
  password: z.string().optional().nullable(),
  fromEmail: optionalEmail,
  fromName: optionalText
}).superRefine((value, ctx) => {
  if (!value.enabled) return

  if (!value.host) {
    ctx.addIssue({
      code: 'custom',
      path: ['host'],
      message: 'Le serveur SMTP est obligatoire quand l’envoi est activé'
    })
  }
  if (!value.fromEmail) {
    ctx.addIssue({
      code: 'custom',
      path: ['fromEmail'],
      message: 'L’email d’expédition est obligatoire quand l’envoi est activé'
    })
  }
})

export const smtpTestSchema = z.object({
  to: requiredText('Le destinataire').email('Invalid recipient email')
})

// Tarifs d'une session et versements (US-031 à US-033, ADR-0032) : montants en euros, stockés en centimes
const euros = (label: string) => z.number({ error: `${label} est obligatoire` }).finite().max(100_000, `${label} est trop élevé`)

export const sessionTariffSchema = z.object({
  name: requiredText('Le nom').max(120),
  amount: euros('Le montant').min(0, 'Le montant ne peut pas être négatif'),
  defaultRole: z.enum(['pj', 'pnj', 'organizer', 'kitchen']).optional().nullable(),
  baseTariffId: optionalText
})

export const sessionPaymentTariffSchema = z.object({
  tariffId: z.string().trim().min(1).nullable()
})

export const sessionPaymentInstalmentSchema = z.object({
  amount: euros('Le montant').positive('Le montant doit être positif'),
  receivedAt: optionalText
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), 'Date de versement invalide')
    .transform((value) => value ? new Date(value) : null)
})

// Paiement d'une personne partie (US-039) et place offerte (US-041)
export const sessionPaymentDepartureSchema = z.object({
  status: z.enum(['to_refund', 'refunded', 'kept', 'transferred']).nullable(),
  transferToParticipantId: optionalText
})

export const sessionPaymentOfferedSchema = z.object({
  offered: z.boolean()
})


// Page « Autoriser » d'un assistant d'IA (US-121) : droits et jeux choisis
export const aiAuthorizationDecisionSchema = z.object({
  allow: z.boolean(),
  canWrite: z.boolean(),
  gameIds: z.array(requiredId('Le jeu')).max(200)
})

// Jeux d'une autorisation, changés depuis le compte (US-123)
export const aiAuthorizationGamesSchema = z.object({
  gameIds: z.array(requiredId('Le jeu')).max(200)
})

// Réglage de la propriétaire : les co-organisatrices peuvent brancher leur assistant sur le jeu (US-123)
export const gameAiSettingsSchema = z.object({
  aiForCoorganizers: z.boolean()
})
