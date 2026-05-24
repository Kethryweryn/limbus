import { z, type ZodError, type ZodType } from 'zod'
import type { H3Event } from 'h3'
import {
  CHARACTER_TYPES,
  DOCUMENT_AUDIENCES,
  INTRIGUE_LEVELS,
  SESSION_ROLES,
  SESSION_STATUSES,
  USER_ROLES
} from '~/utils/domain'

const optionalText = z.string().trim().optional().nullable()
const optionalBoolean = z.boolean().optional()
const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`)
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
const userRole = z.enum([USER_ROLES.admin, USER_ROLES.organizer])
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
      statusMessage: 'Invalid request body',
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
  teaserUrl: optionalText,
  noteIntention: optionalText,
  publicPage: optionalBoolean
})

export const updateGameSchema = z.object({
  title: requiredText('Title').optional(),
  description: optionalText,
  teaserUrl: optionalText,
  noteIntention: optionalText,
  published: optionalBoolean,
  publicPage: optionalBoolean
})

export const createCharacterSchema = z.object({
  name: requiredText('Name'),
  type: characterType.default(CHARACTER_TYPES.pj),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  sheetReadyToSend: optionalBoolean,
  costumeIndications: optionalText,
  excludeFromTrombinoscope: optionalBoolean,
  trombinoscopeFaceHidden: optionalBoolean,
  trombinoscopePhotoUrl: optionalText,
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
  backgroundDocumentUrl: optionalText,
  sheetReadyToSend: optionalBoolean,
  costumeIndications: optionalText,
  excludeFromTrombinoscope: optionalBoolean,
  trombinoscopeFaceHidden: optionalBoolean,
  trombinoscopePhotoUrl: optionalText,
  trombinoscopeNote: optionalText,
  trombinoscopeDisplayName: optionalText,
  gameId: requiredId('Game').optional(),
  factionIds: z.array(requiredId('Faction')).optional(),
  published: optionalBoolean
})

export const factionSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  showInTrombinoscope: optionalBoolean,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  published: optionalBoolean
})

export const intrigueSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  description: optionalText,
  level: intrigueLevel.default(INTRIGUE_LEVELS.minor),
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([]),
  readyToSend: optionalBoolean,
  published: optionalBoolean
})

export const participantSchema = z.object({
  name: requiredText('Name'),
  email: optionalText,
  phone: optionalText,
  notes: optionalText,
  gameIds: z.array(requiredId('Game')).optional().default([]),
  published: optionalBoolean
})

export const locationSchema = z.object({
  name: requiredText('Name'),
  address: optionalText,
  notes: optionalText,
  gameId: requiredId('Game'),
  published: optionalBoolean
})

export const itemSchema = z.object({
  name: requiredText('Name'),
  description: optionalText,
  locationText: optionalText,
  locationCharacterId: optionalText,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  intrigueIds: z.array(requiredId('Intrigue')).optional().default([]),
  published: optionalBoolean
})

export const documentSchema = z.object({
  title: requiredText('Title'),
  content: optionalText,
  documentUrl: optionalText,
  audience: documentAudience.optional().default(DOCUMENT_AUDIENCES.targeted),
  readyToSend: optionalBoolean,
  gameId: requiredId('Game'),
  characterId: optionalText,
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([]),
  published: optionalBoolean
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
  itemIds: z.array(requiredId('Item')).optional().default([]),
  published: optionalBoolean
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
  emails: z.array(requiredText('Email').email('Invalid email')).min(1, 'At least one email is required'),
  documentIds: z.array(requiredId('Document')).optional().default([]),
  characterId: optionalText,
  participantId: optionalText
})

export const sessionPaymentSettingsSchema = z.object({
  paymentRibUrl: optionalText,
  paymentLinkUrl: optionalText
})

export const sessionPaymentStatusSchema = z.object({
  paid: z.boolean()
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
  photoUrl: optionalText,
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

export const loginSchema = z.object({
  email: requiredText('Email'),
  password: requiredText('Password')
})

export const userCreateSchema = z.object({
  email: requiredText('Email').email('Invalid email'),
  name: requiredText('Name'),
  password: requiredText('Password').min(8, 'Password must contain at least 8 characters'),
  role: userRole.default(USER_ROLES.organizer)
})

export const userUpdateSchema = z.object({
  email: requiredText('Email').email('Invalid email').optional(),
  name: requiredText('Name').optional(),
  password: requiredText('Password').min(8, 'Password must contain at least 8 characters').optional(),
  role: userRole.optional()
})

export const adminModeSchema = z.object({
  enabled: z.boolean()
})

export const gameInvitationCreateSchema = z.object({
  email: requiredText('Email').email('Invalid email')
})

export const invitationRegistrationSchema = z.object({
  token: requiredText('Token'),
  email: requiredText('Email').email('Invalid email'),
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
