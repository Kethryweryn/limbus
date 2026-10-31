import { z, type ZodError, type ZodType } from 'zod'
import { REGISTRATION_DIETARY_MAX_LENGTH } from '~/utils/registrationForms'
import type { H3Event } from 'h3'
import {
  CHARACTER_TYPES,
  DOCUMENT_AUDIENCES,
  INTRIGUE_LEVELS,
  REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS,
  REGISTRATION_ENTRY_MODES,
  REGISTRATION_PERIOD_STATES,
  REFUND_STATUSES,
  SESSION_ROLES,
  SESSION_STATUSES,
  USER_ROLES,
  REGISTRATION_PERIOD_SCOPES,
  REGISTRATION_REPLAY_POLICIES
} from '~/utils/domain'
import { isHttpUrl, isUploadUrl, PHOTO_UPLOAD_PREFIX, RIB_UPLOAD_PREFIX } from '~/utils/urls'
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
const externalUrl = optionalText.refine((value) => !value || isHttpUrl(value), 'URL http(s) attendue')
const uploadOrExternalUrl = (prefix: string) => optionalText.refine(
  (value) => !value || isHttpUrl(value) || isUploadUrl(value, prefix),
  'URL http(s) ou fichier téléversé attendu'
)
const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`)
// Les emails de compte sont stockés en minuscules : la connexion ne dépend pas de la casse saisie
const accountEmail = () => requiredText('Email').toLowerCase().email('Invalid email')
const requiredId = (field: string) => z.string().trim().min(1, `${field} is required`)
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
const documentAudience = z.enum([
  DOCUMENT_AUDIENCES.targeted,
  DOCUMENT_AUDIENCES.everyone,
  DOCUMENT_AUDIENCES.organizers,
  DOCUMENT_AUDIENCES.npcs,
  DOCUMENT_AUDIENCES.kitchen
])
const timelineTime = z.string().trim().regex(/^\d{2}:\d{2}$/, 'Time must use HH:mm format')
const userRole = z.enum([USER_ROLES.admin, USER_ROLES.user])
const optionalEmail = z.string().trim().default('').refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Invalid email'
)

export async function readZodBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  return await readValidatedBody(event, (body) => {
    const result = schema.safeParse(body)
    if (result.success) return result.data

    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: formatZodError(result.error)
    })
  })
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
}

export const createGameSchema = z.object({
  title: requiredText('Title'),
  description: optionalText,
  teaserUrl: externalUrl,
  noteIntention: optionalText,
  publicPage: optionalBoolean,
  // Ce que la page publique montre en plus de la présentation (US-086)
  publicShowSessions: optionalBoolean,
  publicShowRegistration: optionalBoolean,
  singlePjPerParticipant: optionalBoolean
})

export const updateGameSchema = z.object({
  title: requiredText('Title').optional(),
  description: optionalText,
  teaserUrl: externalUrl,
  noteIntention: optionalText,
  published: optionalBoolean,
  publicPage: optionalBoolean,
  // Ce que la page publique montre en plus de la présentation (US-086)
  publicShowSessions: optionalBoolean,
  publicShowRegistration: optionalBoolean,
  singlePjPerParticipant: optionalBoolean
})

export const createCharacterSchema = z.object({
  name: requiredText('Name'),
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
  gameId: requiredId('Game'),
  factionIds: z.array(requiredId('Faction')).optional().default([])
})

export const updateCharacterSchema = z.object({
  name: requiredText('Name').optional(),
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
  gameId: requiredId('Game').optional(),
  factionIds: z.array(requiredId('Faction')).optional()
})

export const factionSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: externalUrl,
  costumeIndications: optionalText,
  showInTrombinoscope: optionalBoolean,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([])
})

export const intrigueSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  description: optionalText,
  level: intrigueLevel.default(INTRIGUE_LEVELS.minor),
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([])
})

export const participantSchema = z.object({
  name: requiredText('Name'),
  email: optionalText,
  phone: optionalText,
  // Une note par jeu (US-069) : { idDuJeu: texte }, pour les seuls jeux accessibles
  gameNotes: z.record(z.string(), z.string().nullable()).optional().default({}),
  gameIds: z.array(requiredId('Game')).optional().default([])
})

// Création d'une fiche : au moins un jeu (US-036)
export const participantCreateSchema = participantSchema.extend({
  gameIds: z.array(requiredId('Game')).min(1, 'Choisissez au moins un jeu')
})

export const locationSchema = z.object({
  name: requiredText('Name'),
  address: optionalText,
  notes: optionalText,
  gameId: requiredId('Game')
})

export const itemSchema = z.object({
  name: requiredText('Name'),
  description: optionalText,
  // Absente : 1 à la création, valeur actuelle à la modification (US-014)
  quantity: z.coerce.number().int('La quantité doit être un nombre entier').min(1, 'La quantité doit être d’au moins 1').optional(),
  locationText: optionalText,
  locationCharacterId: optionalText,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  intrigueIds: z.array(requiredId('Intrigue')).optional().default([])
})

export const documentSchema = z.object({
  title: requiredText('Title'),
  content: optionalText,
  documentUrl: externalUrl,
  audience: documentAudience.optional().default(DOCUMENT_AUDIENCES.targeted),
  readyToSend: optionalBoolean,
  gameId: requiredId('Game'),
  characterId: optionalText,
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([])
}).refine((value) => Boolean(value.content?.trim() || value.documentUrl?.trim()), {
  message: 'Content or document URL is required',
  path: ['content']
})

export const timelineEventSchema = z.object({
  name: requiredText('Name'),
  description: optionalText,
  day: z.coerce.number().int().min(1),
  time: timelineTime,
  requiredResponsibles: z.coerce.number().int().min(0).optional().default(0),
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([]),
  intrigueIds: z.array(requiredId('Intrigue')).optional().default([]),
  itemIds: z.array(requiredId('Item')).optional().default([])
})

// Report d'une session sur une nouvelle session (US-022)
export const sessionPostponeSchema = z.object({
  name: requiredText('Name'),
  date: optionalText,
  locationId: optionalText
})

export const sessionTimelineSchema = z.object({
  assignments: z.array(z.object({
    timelineEventId: requiredId('TimelineEvent'),
    participantIds: z.array(requiredId('Participant')).optional().default([])
  })).optional().default([])
})

export const sessionDocumentSendSchema = z.object({
  documentIds: z.array(requiredId('Document')).optional().default([])
})

export const emailTestSchema = z.object({
  emails: z.array(requiredText('Email').email('Invalid email'))
    .min(1, 'At least one email is required')
    .max(10, 'Too many recipients'),
  documentIds: z.array(requiredId('Document')).optional().default([]),
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
    targetCharacterId: requiredId('Character'),
    included: z.boolean(),
    faceKnown: z.boolean(),
    displayName: optionalText,
    note: optionalText
  })).default([])
})

export const sessionAssignmentSchema = z.object({
  characterId: requiredId('Character'),
  participantId: optionalText,
  photoUrl: uploadOrExternalUrl(PHOTO_UPLOAD_PREFIX),
  notes: optionalText
})

export const sessionParticipantSchema = z.object({
  participantId: requiredId('Participant'),
  role: sessionParticipantRole
})

export const sessionSchema = z.object({
  name: requiredText('Name'),
  gameId: requiredId('Game'),
  date: optionalText,
  locationId: optionalText,
  status: sessionStatus.optional().default(SESSION_STATUSES.scheduled),
  published: optionalBoolean,
  assignments: z.array(sessionAssignmentSchema).optional(),
  participants: z.array(sessionParticipantSchema).optional().default([])
})

// Schémas des inscriptions (SPEC-001) : messages en français, affichés tels quels dans l'interface
const frenchText = (label: string) => z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`)

const registrationPeriodSessionSchema = z.object({
  sessionId: frenchText('La session'),
  // Absent : le nombre de personnages PJ du jeu (R5)
  seats: z.number({ error: 'Le nombre de places doit être un nombre entier' })
    .int('Le nombre de places doit être un nombre entier')
    .min(0, 'Le nombre de places ne peut pas être négatif')
    .max(1000, 'Pas plus de 1000 places')
    .optional().nullable()
})

const registrationPeriodState = z.enum([
  REGISTRATION_PERIOD_STATES.draft,
  REGISTRATION_PERIOD_STATES.open,
  REGISTRATION_PERIOD_STATES.closed
], { error: 'État de période inconnu' })
const registrationClosesAt = optionalText.refine((value) => !value || !Number.isNaN(new Date(value).getTime()), 'Date de clôture invalide')
const registrationResponseDelay = z.number({ error: 'Le délai de réponse doit être un nombre de jours' })
  .int('Le délai de réponse doit être un nombre entier de jours')
  .min(1, 'Le délai de réponse est d’au moins 1 jour')
  .max(90, 'Le délai de réponse est de 90 jours au plus')
// Au moins une session pour une période de sessions précises, aucune pour l'inscription permanente (R1, R30)
const registrationPeriodSessions = z.array(registrationPeriodSessionSchema)
  .refine((sessions) => new Set(sessions.map((session) => session.sessionId)).size === sessions.length, 'Une session est choisie deux fois')
  .default([])

const registrationReplayPolicy = z.enum(
  [REGISTRATION_REPLAY_POLICIES.allowed, REGISTRATION_REPLAY_POLICIES.flagged, REGISTRATION_REPLAY_POLICIES.excluded],
  { error: 'Réglage des rejoueurs inconnu' }
)

export const registrationPeriodSchema = z.object({
  name: frenchText('Le nom'),
  gameId: frenchText('Le jeu'),
  // Formulaire public et inscription permanente (US-083) ; le mode ne change plus après la création
  entryMode: z.enum([REGISTRATION_ENTRY_MODES.invitation, REGISTRATION_ENTRY_MODES.form], { error: 'Mode d’entrée inconnu' }).default(REGISTRATION_ENTRY_MODES.invitation),
  scope: z.enum([REGISTRATION_PERIOD_SCOPES.sessions, REGISTRATION_PERIOD_SCOPES.game], { error: 'Portée inconnue' }).default(REGISTRATION_PERIOD_SCOPES.sessions),
  state: registrationPeriodState.default(REGISTRATION_PERIOD_STATES.draft),
  closesAt: registrationClosesAt,
  responseDelayDays: registrationResponseDelay.default(REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS),
  notifyTeam: z.boolean().default(false),
  replayPolicy: registrationReplayPolicy.default(REGISTRATION_REPLAY_POLICIES.allowed),
  sessions: registrationPeriodSessions
}).superRefine((period, context) => {
  if (period.scope === REGISTRATION_PERIOD_SCOPES.game) {
    if (period.entryMode !== REGISTRATION_ENTRY_MODES.form) {
      context.addIssue({ code: 'custom', path: ['entryMode'], message: 'L’inscription permanente est toujours en mode formulaire' })
    }
    if (period.sessions.length) {
      context.addIssue({ code: 'custom', path: ['sessions'], message: 'L’inscription permanente couvre tout le jeu : ne choisissez pas de session' })
    }
  } else if (!period.sessions.length) {
    context.addIssue({ code: 'custom', path: ['sessions'], message: 'Choisissez au moins une session' })
  }
})

// Modification : un champ absent est conservé, jamais remis à sa valeur par défaut ; closesAt à null retire la date
export const registrationPeriodUpdateSchema = z.object({
  name: frenchText('Le nom'),
  gameId: frenchText('Le jeu'),
  state: registrationPeriodState.optional(),
  closesAt: registrationClosesAt,
  responseDelayDays: registrationResponseDelay.optional(),
  notifyTeam: z.boolean().optional(),
  replayPolicy: registrationReplayPolicy.optional(),
  sessions: registrationPeriodSessions
})

// Décision de sélection sur une inscription (US-087) ; la session est demandée pour retenir et la liste d'attente
export const registrationSelectionSchema = z.object({
  action: z.enum(['retain', 'waitlist', 'unwaitlist', 'reject', 'reset'], { error: 'Décision inconnue' }),
  sessionId: z.string().min(1).nullable().optional()
}).refine((body) => !['retain', 'waitlist', 'unwaitlist'].includes(body.action) || body.sessionId, { path: ['sessionId'], message: 'Choisissez la session' })

// Nouvel ordre de la liste d'attente d'une session (R19)
export const registrationWaitlistOrderSchema = z.object({
  sessionId: frenchText('La session'),
  registrationIds: z.array(z.string().min(1)).max(1000)
})

// Places d'une session de l'inscription permanente (US-090) ; null : le nombre de personnages PJ
export const registrationPoolSeatsSchema = z.object({
  sessionId: frenchText('La session'),
  seats: z.number().int('Nombre de places invalide').min(0, 'Nombre de places invalide').max(1000, 'Nombre de places invalide').nullable()
})

// Invitations d'une session de la période (US-003) : des participants du jeu et/ou une nouvelle personne
export const registrationInvitationSchema = z.object({
  sessionId: frenchText('La session'),
  participantIds: z.array(frenchText('Le participant')).optional().default([])
    .refine((ids) => new Set(ids).size === ids.length, 'Une personne est choisie deux fois'),
  newParticipant: z.object({
    name: frenchText('Le nom'),
    email: frenchText('L’email').toLowerCase().max(254, 'Email trop long').email('Email invalide')
  }).optional().nullable()
}).refine((body) => body.participantIds.length > 0 || body.newParticipant, 'Choisissez au moins une personne à inviter')

// Prolongation de l'échéance d'une invitation sans réponse, à une date choisie (US-005, R20)
export const registrationExtensionSchema = z.object({
  responseDueAt: frenchText('La nouvelle échéance')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date d’échéance invalide')
    .transform((value) => new Date(value))
})

// Email d'annulation relu par l'organisation (US-025) ; « emails » pour un test
export const cancellationEmailSchema = z.object({
  subject: requiredText('Subject').max(200),
  text: requiredText('Text').max(10_000)
})

export const cancellationEmailTestSchema = cancellationEmailSchema.extend({
  emails: z.array(requiredText('Email').email('Invalid email')).min(1).max(10)
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
  options: z.array(z.string().trim().max(REGISTRATION_QUESTION_LABEL_MAX_LENGTH, 'Option trop longue')).max(REGISTRATION_QUESTION_OPTION_MAX, 'Trop d’options').default([])
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
  questions: z.array(registrationQuestion).max(REGISTRATION_QUESTION_MAX, 'Trop de questions').optional()
    .refine((questions) => {
      const ids = (questions ?? []).map((question) => question.id).filter(Boolean)
      return new Set(ids).size === ids.length
    }, { message: 'Question en double' }),
  // Version sur laquelle l'éditeur s'appuie (null : formulaire jamais enregistré) ; absente, pas de contrôle
  baseVersionNumber: z.number().int().min(1).nullable().optional()
})

export const loginSchema = z.object({
  email: requiredText('Email').toLowerCase(),
  password: requiredText('Password')
})

// Plus de mot de passe choisi par l'administratrice : la personne reçoit un lien (US-065)
export const userCreateSchema = z.object({
  email: accountEmail(),
  name: requiredText('Name'),
  role: userRole.default(USER_ROLES.user)
})

export const userUpdateSchema = z.object({
  email: accountEmail().optional(),
  name: requiredText('Name').optional(),
  role: userRole.optional(),
  disabled: z.boolean().optional(),
  storageQuotaMb: z.number().int().min(0).max(1_000_000).optional()
})

const newPassword = () => requiredText('Password').min(8, 'Le mot de passe doit faire au moins 8 caractères')

// Inscription libre (US-061) : website est le champ piège, invisible pour une personne
export const signupSchema = z.object({
  name: requiredText('Name'),
  email: accountEmail(),
  password: newPassword(),
  website: z.string().optional()
})

export const accountTokenSchema = z.object({
  token: requiredText('Token')
})

export const passwordForgottenSchema = z.object({
  email: accountEmail()
})

export const passwordResetSchema = z.object({
  token: requiredText('Token'),
  password: newPassword()
})

export const accountUpdateSchema = z.object({
  name: requiredText('Name')
})

export const accountEmailSchema = z.object({
  email: accountEmail(),
  password: requiredText('Password')
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
  password: requiredText('Password')
})

export const accountPasswordSchema = z.object({
  currentPassword: requiredText('Password'),
  password: newPassword()
})

// Transfert d'un jeu à une co-organisatrice (US-060)
export const gameTransferSchema = z.object({
  userId: requiredId('User')
})

export const adminModeSchema = z.object({
  enabled: z.boolean()
})

export const gameInvitationCreateSchema = z.object({
  email: requiredText('Email').email('Invalid email')
})

// Legs d'une copie du jeu (SPEC-002)
export const gameBequestSchema = z.object({
  email: frenchText('L’email').toLowerCase().max(254, 'Email trop long').email('Email invalide')
})

// L'adresse est celle de l'invitation (US-064) : un email envoyé est ignoré
export const invitationRegistrationSchema = z.object({
  token: requiredText('Token'),
  name: requiredText('Name'),
  password: requiredText('Password').min(8, 'Password must contain at least 8 characters')
})

export const invitationAcceptSchema = z.object({
  token: requiredText('Token')
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
      message: 'Host is required when SMTP is enabled'
    })
  }
  if (!value.fromEmail) {
    ctx.addIssue({
      code: 'custom',
      path: ['fromEmail'],
      message: 'Sender email is required when SMTP is enabled'
    })
  }
})

export const smtpTestSchema = z.object({
  to: requiredText('Recipient').email('Invalid recipient email')
})

// Tarifs d'une session et versements (US-031 à US-033, ADR-0032) : montants en euros, stockés en centimes
const euros = (label: string) => z.number({ error: `${label} est obligatoire` }).finite().max(100_000, `${label} est trop élevé`)

export const sessionTariffSchema = z.object({
  name: frenchText('Le nom').max(120),
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

